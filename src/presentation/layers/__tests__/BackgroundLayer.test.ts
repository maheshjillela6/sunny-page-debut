import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * BackgroundLayer rendering tests.
 * We mock PixiJS + engine singletons so the tests run in jsdom.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Minimal mock Container / Graphics
class MockContainer {
  label = '';
  children: any[] = [];
  sortableChildren = false;
  zIndex = 0;
  position = { set: vi.fn() };
  scale = { set: vi.fn() };
  addChild(c: any) { this.children.push(c); return c; }
  removeChild(c: any) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    return c;
  }
  removeChildren() { this.children = []; }
  destroy() { this.children = []; }
}

class MockGraphics extends MockContainer {
  clear() { return this; }
  rect() { return this; }
  fill() { return this; }
  ellipse() { return this; }
  circle() { return this; }
  moveTo() { return this; }
  lineTo() { return this; }
  stroke() { return this; }
}

class MockSprite extends MockContainer {
  anchor = { set: vi.fn() };
  x = 0;
  y = 0;
  constructor(public texture?: any) { super(); }
}

const EMPTY_TEX = Symbol('EMPTY');
const REAL_TEX = { width: 1920, height: 1080 };

// pixi.js mock
vi.mock('pixi.js', () => ({
  Container: MockContainer,
  Graphics: MockGraphics,
  Sprite: MockSprite,
  Texture: { EMPTY: EMPTY_TEX },
}));

// gsap mock (starfield animations)
vi.mock('gsap', () => ({ default: { to: vi.fn() }, __esModule: true }));

// pixiFactory mock
vi.mock('../../../runtime/pixi/factory/PixiFactory', () => ({
  pixiFactory: {
    container: (opts: any) => {
      const c = new MockContainer();
      c.label = opts?.label ?? '';
      return c;
    },
  },
}));

// TextureCache mock – controlled per-test
const textureCacheMap = new Map<string, any>();
vi.mock('../../../runtime/pixi/assets/TextureCache', () => ({
  TextureCache: {
    getInstance: () => ({
      getSync: (key: string) => textureCacheMap.get(key) ?? null,
    }),
  },
}));

// SpineFactory mock – controlled per-test
let spineEnabled = true;
const spineLoadedKeys = new Set<string>();
vi.mock('../../../runtime/pixi/spine/SpineFactory', () => ({
  SpineFactory: {
    getInstance: () => ({
      isSpineEnabled: () => spineEnabled,
      isSpineLoaded: (k: string) => spineLoadedKeys.has(k),
      createSpineInstance: (k: string) => {
        if (!spineLoadedKeys.has(k)) return null;
        const s: any = new MockContainer();
        s.x = 0;
        s.y = 0;
        s.skeleton = { data: { animations: [{ name: 'Bg' }] } };
        s.state = { setAnimation: vi.fn() };
        return s;
      },
    }),
  },
}));

// EventBus mock
const eventHandlers = new Map<string, Function>();
vi.mock('../../../platform/events/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      on: (evt: string, fn: Function) => { eventHandlers.set(evt, fn); },
      off: vi.fn(),
      emit: vi.fn(),
    }),
  },
}));

// LayerConfigManager mock – controlled per-test
let mockLayerConfig: any = {};
vi.mock('../config/LayerConfigManager', () => ({
  LayerConfigManager: {
    getInstance: () => ({
      getBackgroundConfig: () => Promise.resolve(mockLayerConfig),
    }),
  },
}));

// LayerContainer / StageRoot mocks
vi.mock('../../../runtime/pixi/containers/LayerContainer', () => ({
  LayerContainer: class extends MockContainer {
    constructor(opts: any) {
      super();
      this.label = opts?.name ?? '';
    }
  },
}));

vi.mock('../../../runtime/pixi/stage/StageRoot', () => ({
  StageLayer: { BACKGROUND: 0 },
}));

vi.mock('../../../runtime/pixi/core/PixiRuntime', () => ({
  VIRTUAL_WIDTH: 1280,
  VIRTUAL_HEIGHT: 720,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BackgroundLayer – multi-candidate rendering', () => {
  beforeEach(() => {
    textureCacheMap.clear();
    spineLoadedKeys.clear();
    spineEnabled = true;
    mockLayerConfig = {};
    eventHandlers.clear();
  });

  async function createLayer() {
    // Dynamic import so mocks are in place
    const { BackgroundLayer } = await import('../BackgroundLayer');
    const layer = new BackgroundLayer();
    // Wait a tick for the async refreshBackground in constructor
    await new Promise((r) => setTimeout(r, 50));
    return layer;
  }

  it('renders only an image when spine is not loaded', async () => {
    textureCacheMap.set('background', REAL_TEX);
    mockLayerConfig = {
      base: {
        candidates: [
          { type: 'image', key: 'background', scaleMode: 'cover', zIndex: 0 },
          { type: 'spine', key: 'bgambient', fillScreen: true, zIndex: 1 },
        ],
      },
    };

    const layer = await createLayer();
    // baseContainer is the first child
    const baseContainer = (layer as any).children[0];
    // Only the image sub-container should be present (spine not loaded)
    expect(baseContainer.children.length).toBe(1);
    expect(baseContainer.children[0].label).toContain('image');
  });

  it('renders only spine when image texture is missing', async () => {
    spineLoadedKeys.add('bgambient');
    mockLayerConfig = {
      base: {
        candidates: [
          { type: 'image', key: 'background', scaleMode: 'cover', zIndex: 0 },
          { type: 'spine', key: 'bgambient', fillScreen: true, zIndex: 1 },
        ],
      },
    };

    const layer = await createLayer();
    const baseContainer = (layer as any).children[0];
    expect(baseContainer.children.length).toBe(1);
    expect(baseContainer.children[0].label).toContain('spine');
  });

  it('renders BOTH image and spine when both assets are available', async () => {
    textureCacheMap.set('background', REAL_TEX);
    spineLoadedKeys.add('bgambient');
    mockLayerConfig = {
      base: {
        candidates: [
          { type: 'image', key: 'background', scaleMode: 'cover', zIndex: 0 },
          { type: 'spine', key: 'bgambient', fillScreen: true, zIndex: 1 },
        ],
      },
    };

    const layer = await createLayer();
    const baseContainer = (layer as any).children[0];
    // Both candidates should be rendered
    expect(baseContainer.children.length).toBe(2);

    // Verify z-ordering: image at 0, spine at 1
    const imageChild = baseContainer.children.find((c: any) => c.label.includes('image'));
    const spineChild = baseContainer.children.find((c: any) => c.label.includes('spine'));
    expect(imageChild).toBeDefined();
    expect(spineChild).toBeDefined();
    expect(imageChild.zIndex).toBe(0);
    expect(spineChild.zIndex).toBe(1);
  });

  it('respects custom zIndex ordering from config', async () => {
    textureCacheMap.set('background', REAL_TEX);
    spineLoadedKeys.add('bgambient');
    // Reverse order: spine behind image
    mockLayerConfig = {
      base: {
        candidates: [
          { type: 'spine', key: 'bgambient', fillScreen: true, zIndex: 0 },
          { type: 'image', key: 'background', scaleMode: 'cover', zIndex: 10 },
        ],
      },
    };

    const layer = await createLayer();
    const baseContainer = (layer as any).children[0];
    expect(baseContainer.children.length).toBe(2);

    const spineChild = baseContainer.children.find((c: any) => c.label.includes('spine'));
    const imageChild = baseContainer.children.find((c: any) => c.label.includes('image'));
    expect(spineChild.zIndex).toBe(0);
    expect(imageChild.zIndex).toBe(10);
  });

  it('renders fallback when no candidates match', async () => {
    mockLayerConfig = {
      base: {
        candidates: [
          { type: 'image', key: 'missing', scaleMode: 'cover' },
        ],
        fallback: { type: 'graphics', kind: 'solid', color: '#0f0f23' },
      },
    };

    const layer = await createLayer();
    const baseContainer = (layer as any).children[0];
    // No sub-containers added
    expect(baseContainer.children.length).toBe(0);
    // Fallback graphics should have been drawn (non-empty)
    // Just verify the layer didn't throw
    expect(layer).toBeDefined();
  });
});
