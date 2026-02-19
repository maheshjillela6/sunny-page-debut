import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * TitleLayer config-driven rendering tests.
 * Verifies: Game config → Shared defaults → Hardcoded fallbacks
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

class MockContainer {
  label = '';
  children: any[] = [];
  sortableChildren = false;
  zIndex = 0;
  x = 0;
  y = 0;
  position = { set: vi.fn() };
  scale = { set: vi.fn() };
  anchor = { set: vi.fn() };
  addChild(c: any) { this.children.push(c); return c; }
  removeChild(c: any) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    return c;
  }
  removeChildren() { this.children = []; }
  destroy(_opts?: any) { this.children = []; }
}

class MockGraphics extends MockContainer {
  clear() { return this; }
  rect() { return this; }
  fill() { return this; }
  circle() { return this; }
  roundRect() { return this; }
  stroke() { return this; }
  moveTo() { return this; }
  lineTo() { return this; }
  poly() { return this; }
}

class MockText extends MockContainer {
  text = '';
  style: any;
  constructor(opts?: any) {
    super();
    this.text = opts?.text ?? '';
    this.style = opts?.style ?? {};
  }
}

vi.mock('pixi.js', () => ({
  Container: MockContainer,
  Graphics: MockGraphics,
  Text: MockText,
  TextStyle: class {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fill: any;
    letterSpacing: number;
    constructor(opts: any) {
      this.fontFamily = opts?.fontFamily ?? 'Arial';
      this.fontSize = opts?.fontSize ?? 16;
      this.fontWeight = opts?.fontWeight ?? 'normal';
      this.fill = opts?.fill;
      this.letterSpacing = opts?.letterSpacing ?? 0;
    }
  },
}));

vi.mock('../../../runtime/pixi/containers/LayerContainer', () => ({
  LayerContainer: class extends MockContainer {
    constructor(opts: any) {
      super();
      this.label = opts?.name ?? '';
    }
  },
}));

vi.mock('../../../runtime/pixi/stage/StageRoot', () => ({
  StageLayer: { TITLE: 900 },
}));

vi.mock('../../../runtime/pixi/core/PixiRuntime', () => ({
  VIRTUAL_WIDTH: 1280,
}));

// PixiFactory mock - captures parameters for assertions
const createdCircles: any[] = [];
const createdRects: any[] = [];
const createdPolygons: any[] = [];

vi.mock('../../../runtime/pixi/factory/PixiFactory', () => ({
  PixiFactory: {
    getInstance: () => ({
      createContainer: (opts: any) => {
        const c = new MockContainer();
        c.label = opts?.label ?? '';
        return c;
      },
      createCircle: (x: number, y: number, r: number, opts: any) => {
        const record = { x, y, r, ...opts };
        createdCircles.push(record);
        const g = new MockGraphics();
        return g;
      },
      createRect: (x: number, y: number, w: number, h: number, opts: any) => {
        const record = { x, y, w, h, ...opts };
        createdRects.push(record);
        const g = new MockGraphics();
        return g;
      },
      createPolygon: (points: any[], opts: any) => {
        const record = { points, ...opts };
        createdPolygons.push(record);
        const g = new MockGraphics();
        return g;
      },
    }),
  },
}));

// LayerConfigManager mock - controlled per-test
let mockTitleConfig: any = {};

vi.mock('../config/LayerConfigManager', () => ({
  LayerConfigManager: {
    getInstance: () => ({
      getTitleConfig: () => Promise.resolve(mockTitleConfig),
    }),
  },
  parsePixiColor: (input: any, fallback: number) => {
    if (typeof input === 'number') return input;
    if (typeof input === 'string' && input.startsWith('#')) {
      return parseInt(input.slice(1), 16);
    }
    return fallback;
  },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TitleLayer – config-driven rendering', () => {
  beforeEach(() => {
    mockTitleConfig = {};
    createdCircles.length = 0;
    createdRects.length = 0;
    createdPolygons.length = 0;
  });

  async function createLayer() {
    const { TitleLayer } = await import('../TitleLayer');
    const layer = new TitleLayer();
    await new Promise((r) => setTimeout(r, 50));
    return layer;
  }

  it('uses shared defaults when no game-specific config exists', async () => {
    // Empty config = all defaults from hardcoded fallbacks
    mockTitleConfig = {};
    const layer = await createLayer();

    // Title text should use default "SLOT ENGINE"
    const titleText = (layer as any).titleText;
    expect(titleText).toBeDefined();
    expect(titleText.text).toBe('SLOT ENGINE');

    // Logo should be at default position
    const logoContainer = (layer as any).logoContainer;
    expect(logoContainer.x).toBe(70);
    expect(logoContainer.y).toBe(40);
  });

  it('applies game-specific title text from config', async () => {
    mockTitleConfig = {
      titleText: {
        defaultText: 'NEON NIGHTS',
        fill: '#e0d4ff',
        fontSize: 26,
        letterSpacing: 5,
      },
    };

    const layer = await createLayer();
    const titleText = (layer as any).titleText;
    expect(titleText.text).toBe('NEON NIGHTS');
  });

  it('applies game-specific logo position from config', async () => {
    mockTitleConfig = {
      logo: {
        x: 100,
        y: 80,
        bgFill: '#d4af37',
        bgRadius: 30,
      },
    };

    const layer = await createLayer();
    const logoContainer = (layer as any).logoContainer;
    expect(logoContainer.x).toBe(100);
    expect(logoContainer.y).toBe(80);
  });

  it('applies title bar dimensions from config', async () => {
    mockTitleConfig = {
      titleBar: {
        width: 420,
        height: 52,
        y: 14,
        fill: '#1a1a0f',
        stroke: '#d4af37',
      },
    };

    const layer = await createLayer();
    // Verify rect was created with config values
    const titleBarRect = createdRects.find((r) => r.w === 420 && r.h === 52);
    expect(titleBarRect).toBeDefined();
    expect(titleBarRect.y).toBe(14);
  });

  it('merges partial config with defaults (only override what you specify)', async () => {
    // Only override titleText, logo and titleBar should use defaults
    mockTitleConfig = {
      titleText: {
        defaultText: 'CUSTOM GAME',
      },
    };

    const layer = await createLayer();
    const titleText = (layer as any).titleText;
    expect(titleText.text).toBe('CUSTOM GAME');

    // Logo should still use default position
    const logoContainer = (layer as any).logoContainer;
    expect(logoContainer.x).toBe(70);
    expect(logoContainer.y).toBe(40);

    // Title bar should use default dimensions
    const defaultRect = createdRects.find((r) => r.w === 400 && r.h === 50);
    expect(defaultRect).toBeDefined();
  });

  it('setTitle() dynamically updates rendered text', async () => {
    mockTitleConfig = {
      titleText: { defaultText: 'INITIAL' },
    };

    const layer = await createLayer();
    expect((layer as any).titleText.text).toBe('INITIAL');

    layer.setTitle('UPDATED TITLE');
    expect((layer as any).titleText.text).toBe('UPDATED TITLE');
  });

  it('renders logo hexagon with config-specified radius', async () => {
    mockTitleConfig = {
      logo: {
        hexFill: '#d4af37',
        hexRadius: 20,
      },
    };

    const layer = await createLayer();
    // Polygon should have been created with 6 points for hexagon
    const hex = createdPolygons.find((p) => p.points?.length === 6);
    expect(hex).toBeDefined();

    // Verify the radius was used (check first point distance from origin)
    const firstPoint = hex.points[0];
    const dist = Math.sqrt(firstPoint.x ** 2 + firstPoint.y ** 2);
    expect(Math.round(dist)).toBe(20);
  });
});
