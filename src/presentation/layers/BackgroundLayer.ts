/**
 * BackgroundLayer - Bottom-most layer with rich visual background
 * Supports loading background images from preloaded assets or spine animations
 * Data-driven via /public/game-configs/games/<id>/layers/background.layer.json
 */

import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { PixiRuntime, VIRTUAL_WIDTH as DEFAULT_VW, VIRTUAL_HEIGHT as DEFAULT_VH } from '../../runtime/pixi/core/PixiRuntime';
import { pixiFactory } from '../../runtime/pixi/factory/PixiFactory';
import { TextureCache } from '../../runtime/pixi/assets/TextureCache';
import { SpineFactory } from '../../runtime/pixi/spine/SpineFactory';
import { EventBus } from '../../platform/events/EventBus';
import { TweenFactory } from '../../runtime/animation/TweenFactory';
import {
  LayerConfigManager,
  type BackgroundLayerConfig,
} from './config/LayerConfigManager';

export class BackgroundLayer extends LayerContainer {
  // Main Container Slots – each candidate gets its own sub-container for z-control
  private baseContainer: Container; // Holds per-candidate sub-containers
  private ambientContainer: Container; // Ambient animations
  private overlayContainer: Container; // Placeholders for game-specific objects
  private fallbackGraphics: Graphics; // Fallback shapes

  // Internal References
  private textureCache: TextureCache;
  private spineFactory: SpineFactory;
  private eventBus: EventBus;
  private layerConfigManager: LayerConfigManager;

  // Cached resolved layer config (shared defaults merged with game overrides)
  private layerConfig: BackgroundLayerConfig | null = null;

  /** Responsive-aware virtual width */
  private get VIRTUAL_WIDTH(): number {
    try { return PixiRuntime.getInstance().getVirtualWidth(); } catch { return DEFAULT_VW; }
  }
  /** Responsive-aware virtual height */
  private get VIRTUAL_HEIGHT(): number {
    try { return PixiRuntime.getInstance().getVirtualHeight(); } catch { return DEFAULT_VH; }
  }

  constructor() {
    super({
      name: 'BackgroundLayer',
      zIndex: StageLayer.BACKGROUND,
    });

    this.textureCache = TextureCache.getInstance();
    this.spineFactory = SpineFactory.getInstance();
    this.eventBus = EventBus.getInstance();
    this.layerConfigManager = LayerConfigManager.getInstance();

    // Initialize segregated containers
    this.baseContainer = pixiFactory.container({ label: 'BaseLayer' });
    this.baseContainer.sortableChildren = true;
    this.ambientContainer = pixiFactory.container({ label: 'AmbientLayer' });
    this.overlayContainer = pixiFactory.container({ label: 'OverlayLayer' });
    this.fallbackGraphics = new Graphics();
    this.fallbackGraphics.label = 'FallbackGraphics';

    // Layering order: Base -> Fallback -> Ambient -> Overlay
    this.addChild(this.baseContainer);
    this.addChild(this.fallbackGraphics);
    this.addChild(this.ambientContainer);
    this.addChild(this.overlayContainer);

    // Initial load attempt (async but fire-and-forget)
    void this.refreshBackground();

    // Listen for config + assets load completion
    this.eventBus.on('config:loaded', () => {
      this.layerConfig = null;
      void this.refreshBackground();
    });

    this.eventBus.on('assets:load:complete', () => {
      console.log('[BackgroundLayer] Assets loaded, refreshing components...');
      void this.refreshBackground();
    });

    this.eventBus.on('asset:spine:loaded', (payload: { key: string }) => {
      if (payload.key.startsWith('bg') || payload.key.includes('ambient')) {
        void this.refreshBackground();
      }
    });

    // Re-render on breakpoint change (virtual dimensions change)
    this.eventBus.on('viewport:breakpoint:changed', () => {
      void this.refreshBackground();
    });
  }

  /**
   * Refreshes all background components
   */
  private async refreshBackground(): Promise<void> {
    await this.ensureLayerConfig();
    this.renderBase();
    this.renderAmbient();
  }

  private async ensureLayerConfig(): Promise<void> {
    if (this.layerConfig) return;
    try {
      this.layerConfig = await this.layerConfigManager.getBackgroundConfig();
    } catch (e) {
      console.error('[BackgroundLayer] Failed to load background layer config:', e);
      this.layerConfig = {};
    }
  }

  /**
   * Renders the Base Background.
   * Priority: Spine -> Image -> Procedural Rect (all driven by config)
   */
  /**
   * Renders ALL matching base candidates, each in its own z-ordered sub-container.
   * Config candidates are rendered in order (index = zIndex), so later entries render on top.
   * This allows spine + image to coexist with controllable layering.
   */
  private renderBase(): void {
    this.clearContainer(this.baseContainer);

    const candidates =
      this.layerConfig?.base?.candidates ??
      ([
        { type: 'spine', key: 'bg_base', fillScreen: true } as {
          type: 'spine';
          key: string;
          fillScreen?: boolean;
          animation?: { name?: string; loop?: boolean };
        },
        { type: 'image', key: 'background', scaleMode: 'cover' } as {
          type: 'image';
          key: string;
          scaleMode?: 'cover';
        },
        { type: 'image', key: 'bg', scaleMode: 'cover' },
        { type: 'image', key: 'bgambient', scaleMode: 'cover' },
        { type: 'image', key: 'bg_static', scaleMode: 'cover' },
      ] as any);

    let rendered = 0;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      // Each candidate gets a sub-container with explicit zIndex for ordering control
      const sub = pixiFactory.container({ label: `Base_${c.type}_${c.key ?? i}` });
      // Config can override zIndex per candidate; otherwise use array order
      sub.zIndex = (c as any).zIndex ?? i;

      let added = false;

      if (c.type === 'spine') {
        if (this.spineFactory.isSpineEnabled() && this.spineFactory.isSpineLoaded(c.key)) {
          this.addSpineToSlot(c.key, sub, !!c.fillScreen, c.animation, (c as any).scale);
          added = true;
        }
      } else if (c.type === 'image') {
        const tex = this.textureCache.getSync(c.key);
        if (tex && tex !== Texture.EMPTY) {
          this.addImageToSlot(tex, sub);
          added = true;
        }
      }

      if (added) {
        this.baseContainer.addChild(sub);
        rendered++;
      } else {
        sub.destroy();
      }
    }

    if (rendered === 0) {
      console.warn('[BackgroundLayer] No base candidates resolved, rendering fallback');
    }
    this.drawAllFallbacks();
  }

  /**
   * Renders ambient items.
   * If config has no ambient items, we fall back to the previous slot heuristic.
   */
  private renderAmbient(): void {
    this.clearContainer(this.ambientContainer);

    const items = this.layerConfig?.ambient?.items;

    if (items && items.length > 0) {
      for (const item of items) {
        let rendered = false;

        for (const c of item.candidates ?? []) {
            if (c.type === 'spine') {
              if (this.spineFactory.isSpineLoaded(c.key)) {
                const spine = this.addSpineToSlot(c.key, this.ambientContainer, false, c.animation, (c as any).scale);
                if (spine) {
                  spine.position.set(item.position.x, item.position.y);
                  rendered = true;
                  break;
                }
              }
          } else if (c.type === 'image') {
            const tex = this.textureCache.getSync(c.key);
            if (tex && tex !== Texture.EMPTY) {
              const sprite = new Sprite(tex);
              sprite.anchor.set(item.position.anchor?.x ?? 0.5, item.position.anchor?.y ?? 0.5);
              sprite.position.set(item.position.x, item.position.y);
              this.ambientContainer.addChild(sprite);
              rendered = true;
              break;
            }
          } else if (c.type === 'graphics' && c.kind === 'starfield') {
            const starfield = this.createStarfield(c.config);
            starfield.position.set(item.position.x, item.position.y);
            this.ambientContainer.addChild(starfield);
            rendered = true;
            break;
          }
        }

        if (!rendered) {
          // Leave to fallback drawing below
        }
      }

      this.drawAllFallbacks();
      return;
    }

    // Legacy fallback: ambient by common spine keys (left/right/top/bottom)
    const legacySlots = [
      { key: 'bg_ambient_left', x: 0, y: this.VIRTUAL_HEIGHT / 2 },
      { key: 'bg_ambient_right', x: this.VIRTUAL_WIDTH, y: this.VIRTUAL_HEIGHT / 2 },
      { key: 'bg_ambient_top', x: this.VIRTUAL_WIDTH / 2, y: 0 },
      { key: 'bg_ambient_bottom', x: this.VIRTUAL_WIDTH / 2, y: this.VIRTUAL_HEIGHT },
    ];

    for (const slot of legacySlots) {
      if (this.spineFactory.isSpineLoaded(slot.key)) {
        const spine = this.addSpineToSlot(slot.key, this.ambientContainer, false, { loop: true });
        if (spine) spine.position.set(slot.x, slot.y);
      }
    }

    this.drawAllFallbacks();
  }

  private createStarfield(config: {
    count: number;
    area?: { width?: number; height?: number };
    colors?: Array<number | string>;
    radiusMin?: number;
    radiusMax?: number;
    alphaMin?: number;
    alphaMax?: number;
    pulseDurationMs?: number;
  }): Container {
    const out = pixiFactory.container({ label: 'Starfield' });

    const width = config.area?.width ?? 320;
    const height = config.area?.height ?? 220;
    const count = Math.max(1, config.count);

    // Default to real-ish white stars (config can override, but Neon will set white)
    const colors = config.colors?.length ? config.colors : ['#ffffff'];
    const rMin = config.radiusMin ?? 0.8;
    const rMax = config.radiusMax ?? 2.6;
    const aMin = config.alphaMin ?? 0.15;
    const aMax = config.alphaMax ?? 0.95;
    const pulseMs = config.pulseDurationMs ?? 1400;

    for (let i = 0; i < count; i++) {
      const g = new Graphics();

      const colorRaw = colors[i % colors.length] as any;
      const color = typeof colorRaw === 'string'
        ? Number.parseInt(colorRaw.replace('#', ''), 16)
        : (colorRaw ?? 0xffffff);

      const r = rMin + Math.random() * (rMax - rMin);
      const baseAlpha = aMin + Math.random() * (aMax - aMin);

      // Random position in local starfield area
      g.x = (Math.random() - 0.5) * width;
      g.y = (Math.random() - 0.5) * height;

      // Core dot
      g.circle(0, 0, r);
      g.fill({ color, alpha: baseAlpha });

      // Subtle 4-point "glint" on a subset of stars
      if (Math.random() < 0.35) {
        const glintLen = r * (2.2 + Math.random() * 2.2);
        const glintA = Math.min(1, baseAlpha * (0.9 + Math.random() * 0.6));

        g.moveTo(-glintLen, 0);
        g.lineTo(glintLen, 0);
        g.stroke({ color, alpha: glintA * 0.55, width: Math.max(1, r * 0.35) });

        g.moveTo(0, -glintLen);
        g.lineTo(0, glintLen);
        g.stroke({ color, alpha: glintA * 0.55, width: Math.max(1, r * 0.35) });
      }

      out.addChild(g);

      // Glitter/twinkle: alpha + slight scale + occasional "spark" pop
      const dur = Math.max(0.25, pulseMs / 1000) * (0.75 + Math.random() * 0.85);
      TweenFactory.to(g, {
        alpha: Math.min(1, baseAlpha * (0.45 + Math.random() * 1.1)),
        duration: dur,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: Math.random() * 1.8,
      });

      TweenFactory.to(g.scale, {
        x: 0.85 + Math.random() * 0.55,
        y: 0.85 + Math.random() * 0.55,
        duration: dur,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: Math.random() * 1.8,
      });

      if (Math.random() < 0.18) {
        TweenFactory.to(g.scale, {
          x: 1.35,
          y: 1.35,
          duration: 0.18,
          yoyo: true,
          repeat: -1,
          repeatDelay: 1.1 + Math.random() * 2.2,
          ease: 'power2.inOut',
          delay: Math.random() * 1.2,
        });
      }
    }

    return out;
  }


  /**
   * Internal Helper: Add Spine and play configured animation (or first animation).
   */
  private addSpineToSlot(
    key: string,
    container: Container,
    fillScreen: boolean,
    animation?: { name?: string; loop?: boolean },
    scaleOverride?: number
  ): any {
    const spineInstance = this.spineFactory.createSpineInstance(key);
    if (!spineInstance) return null;

    if (fillScreen) {
      spineInstance.x = this.VIRTUAL_WIDTH / 2;
      spineInstance.y = this.VIRTUAL_HEIGHT / 2;
      const baseScale = Math.max(this.VIRTUAL_WIDTH / 1920, this.VIRTUAL_HEIGHT / 1080);
      const scaled = baseScale * (scaleOverride ?? 1);
      spineInstance.scale.set(scaled);
    } else if (typeof scaleOverride === 'number' && Number.isFinite(scaleOverride)) {
      spineInstance.scale.set(scaleOverride);
    }

    container.addChild(spineInstance);

    const loop = animation?.loop ?? true;

    if (spineInstance.state) {
      const anims = spineInstance.skeleton?.data?.animations || [];
      const requested = animation?.name;

      const chosen =
        (requested ? anims.find((a: any) => a.name === requested)?.name : null) ??
        (anims.length > 0 ? anims[0].name : null);

      if (chosen) spineInstance.state.setAnimation(0, chosen, loop);
    }

    return spineInstance;
  }

  /**
   * Internal Helper: Add Image with "Cover" scaling
   */
  private addImageToSlot(texture: Texture, container: Container): void {
    const sprite = new Sprite(texture);
    const scale = Math.max(this.VIRTUAL_WIDTH / texture.width, this.VIRTUAL_HEIGHT / texture.height);

    sprite.scale.set(scale);
    sprite.anchor.set(0.5);
    sprite.x = this.VIRTUAL_WIDTH / 2;
    sprite.y = this.VIRTUAL_HEIGHT / 2;

    container.addChild(sprite);
  }

  /**
   * Procedural fallback rendering (simple + deterministic)
   */
  private drawAllFallbacks(): void {
    this.fallbackGraphics.clear();

    const baseFallback = this.layerConfig?.base?.fallback;

    // Base fallback
    if (this.baseContainer.children.length === 0) {
      const color = baseFallback?.type === 'graphics' ? baseFallback.color : '#0a0e14';
      const resolved = typeof color === 'string' ? Number.parseInt(color.replace('#', ''), 16) : 0x0a0e14;
      this.fallbackGraphics.rect(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);
      this.fallbackGraphics.fill({ color: Number.isFinite(resolved) ? resolved : 0x0a0e14 });
    }

    // Ambient fallback (procedural glows)
    if (this.ambientContainer.children.length === 0) {
      this.fallbackGraphics.ellipse(0, this.VIRTUAL_HEIGHT / 2, 200, 300);
      this.fallbackGraphics.fill({ color: 0x3b82f6, alpha: 0.1 });

      this.fallbackGraphics.ellipse(this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT / 2, 200, 300);
      this.fallbackGraphics.fill({ color: 0x8b5cf6, alpha: 0.1 });

      this.fallbackGraphics.ellipse(this.VIRTUAL_WIDTH / 2, this.VIRTUAL_HEIGHT, 400, 200);
      this.fallbackGraphics.fill({ color: 0xf59e0b, alpha: 0.05 });
    }
  }

  /**
   * PUBLIC API: Set a specific game object placeholder
   */
  public setOverlayObject(key: string, x: number, y: number): void {
    const tex = this.textureCache.getSync(key);
    if (tex && tex !== Texture.EMPTY) {
      const sprite = new Sprite(tex);
      sprite.position.set(x, y);
      sprite.anchor.set(0.5);
      this.overlayContainer.addChild(sprite);
    }
  }

  /**
   * PUBLIC API: Manual override for background color
   */
  public setBackgroundColor(color: number): void {
    this.clearContainer(this.baseContainer);
    this.clearContainer(this.ambientContainer);

    this.fallbackGraphics.clear();
    this.fallbackGraphics.rect(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);
    this.fallbackGraphics.fill({ color });
  }

  /**
   * Clean up helper
   */
  private clearContainer(container: Container): void {
    while (container.children[0]) {
      const child = container.children[0];
      container.removeChild(child);
      child.destroy({ children: true });
    }
  }

  public override destroy(): void {
    this.clearContainer(this.baseContainer);
    this.clearContainer(this.ambientContainer);
    this.clearContainer(this.overlayContainer);
    super.destroy();
  }
}
