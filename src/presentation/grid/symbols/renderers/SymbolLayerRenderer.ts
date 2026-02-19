/**
 * SymbolLayerRenderer - Creates and manages a single visual layer within a symbol.
 *
 * Supports sprite, spine, graphics, and image types.
 * Animation is driven externally via applyStateRule().
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type {
  SymbolLayerConfig,
  LayerStateRule,
  SymbolLifecycleState,
  GraphicsShapeConfig,
} from '../config/SymbolCompositionTypes';
import { DEFAULT_LAYER_STATE } from '../config/SymbolCompositionTypes';
import { TweenFactory } from '../../../../runtime/animation/TweenFactory';
import type { TweenHandle, TweenOptions } from '../../../../runtime/animation/TweenTypes';
import { SpineFactory, SpineContainerBase } from '../../../../runtime/pixi/spine/SpineFactory';
import { TextureCache } from '../../../../runtime/pixi/assets/TextureCache';
import { SpritesheetLoader } from '../../../../runtime/pixi/assets/SpritesheetLoader';
import { DefaultAssets } from '../../../../runtime/pixi/assets/DefaultAssets';

export class SymbolLayerRenderer {
  public readonly container: Container;
  public readonly config: SymbolLayerConfig;

  private displayObject: Container | Sprite | Graphics | null = null;
  private spineContainer: SpineContainerBase | null = null;
  private activeTween: TweenHandle | null = null;
  private currentState: SymbolLifecycleState = 'idle';
  private symbolSize: number;

  // Singletons
  private spineFactory: SpineFactory;
  private textureCache: TextureCache;
  private spritesheetLoader: SpritesheetLoader;

  constructor(config: SymbolLayerConfig, symbolSize: number) {
    this.config = config;
    this.symbolSize = symbolSize;
    this.container = new Container();
    this.container.label = `Layer_${config.id}`;
    this.container.zIndex = config.zIndex;

    this.spineFactory = SpineFactory.getInstance();
    this.textureCache = TextureCache.getInstance();
    this.spritesheetLoader = SpritesheetLoader.getInstance();

    // Apply base properties
    if (config.offset) {
      this.container.x = config.offset[0];
      this.container.y = config.offset[1];
    }
    if (config.alpha !== undefined) this.container.alpha = config.alpha;

    this.buildDisplayObject();
  }

  // ── Build the initial display object ──────────────────────────────────

  private buildDisplayObject(): void {
    this.clearDisplayObject();

    switch (this.config.type) {
      case 'sprite':
      case 'image':
        this.buildSprite();
        break;
      case 'spine':
        this.buildSpine();
        break;
      case 'graphics':
        this.buildGraphics();
        break;
    }
  }

  private buildSprite(): void {
    let texture: Texture | null = null;

    // Try spritesheet frame first
    if (this.config.frameName) {
      texture = this.spritesheetLoader.getSymbolFrame(this.config.frameName);
    }

    // Try asset key as texture
    if (!texture && this.config.assetKey) {
      texture = this.textureCache.getSymbolTexture(this.config.assetKey);
    }

    if (!texture || texture === Texture.EMPTY) {
      // Use DefaultAssets for a rich fallback (colored bg + highlight + text label)
      const defaultAssets = DefaultAssets.getInstance();
      const frameName = this.config.frameName ?? this.config.assetKey ?? '?';
      const fallback = defaultAssets.createSymbol(frameName, this.symbolSize);
      // Center: DefaultAssets draws from (0,0), offset by -half to center at anchor
      fallback.x = -this.symbolSize / 2;
      fallback.y = -this.symbolSize / 2;
      this.displayObject = fallback;
    } else {
      const sprite = new Sprite(texture);
      const anchor = this.config.anchor ?? [0.5, 0.5];
      sprite.anchor.set(anchor[0], anchor[1]);

      // Scale to fit
      const maxDim = Math.max(texture.width, texture.height);
      if (maxDim > 0) {
        const fitScale = this.symbolSize / maxDim;
        sprite.scale.set(fitScale);
      }

      if (this.config.tint !== undefined) sprite.tint = this.config.tint;
      this.applyConfigScale(sprite);
      this.displayObject = sprite;
    }

    this.container.addChild(this.displayObject);
  }

  private buildSpine(): void {
    if (!this.config.assetKey) return;

    const factory = this.spineFactory;
    if (!factory.isSpineEnabled() || !factory.isSpineLoaded(this.config.assetKey)) {
      // Fallback to placeholder
      this.config.type === 'spine' && this.buildPlaceholder();
      return;
    }

    const spineInst = factory.createSpineInstance(this.config.assetKey);
    if (!spineInst) {
      this.buildPlaceholder();
      return;
    }

    const wrapper = new SpineContainerBase(this.config.assetKey, factory);
    this.spineContainer = wrapper;
    this.applyConfigScale(wrapper);
    this.displayObject = wrapper;
    this.container.addChild(wrapper);
  }

  private buildGraphics(): void {
    const g = new Graphics();
    const shape = this.config.graphics;
    if (shape) {
      this.drawShape(g, shape);
    }
    this.applyConfigScale(g);
    this.displayObject = g;
    this.container.addChild(g);
  }

  private buildPlaceholder(): void {
    const defaultAssets = DefaultAssets.getInstance();
    const label = this.config.assetKey ?? this.config.frameName ?? '?';
    const fallback = defaultAssets.createSymbol(label, this.symbolSize);
    fallback.x = -this.symbolSize / 2;
    fallback.y = -this.symbolSize / 2;
    this.displayObject = fallback;
    this.container.addChild(fallback);
  }

  private drawShape(g: Graphics, shape: GraphicsShapeConfig): void {
    const pad = shape.padding ?? 0;
    const w = this.symbolSize - pad * 2;
    const h = this.symbolSize - pad * 2;
    const fillColor = typeof shape.fill === 'string' ? parseInt(shape.fill.replace('#', ''), 16) : (shape.fill ?? 0x000000);

    // Center the shape so it aligns with sprite-anchored elements (anchor 0.5, 0.5)
    const ox = -w / 2;
    const oy = -h / 2;

    switch (shape.shape) {
      case 'rect':
        g.rect(ox, oy, w, h);
        break;
      case 'roundRect':
        g.roundRect(ox, oy, w, h, shape.cornerRadius ?? 8);
        break;
      case 'circle':
        g.circle(0, 0, Math.min(w, h) / 2);
        break;
      case 'oval':
        g.ellipse(0, 0, w / 2, h / 2);
        break;
      case 'polygon':
        if (shape.points && shape.points.length >= 6) {
          g.poly(shape.points);
        }
        break;
    }

    g.fill({ color: fillColor, alpha: shape.fillAlpha ?? 1 });

    if (shape.stroke !== undefined) {
      const strokeColor = typeof shape.stroke === 'string' ? parseInt(shape.stroke.replace('#', ''), 16) : shape.stroke;
      g.stroke({ color: strokeColor, width: shape.strokeWidth ?? 2, alpha: shape.strokeAlpha ?? 1 });
    }
  }

  private applyConfigScale(obj: Container): void {
    const s = this.config.scale;
    if (s === undefined) return;
    if (typeof s === 'number') {
      obj.scale.set(s);
    } else {
      obj.scale.set(s[0], s[1]);
    }
  }

  // ── State application ─────────────────────────────────────────────────

  public applyState(state: SymbolLifecycleState, force: boolean = false): void {
    if (this.currentState === state && !force) return;
    this.currentState = state;

    // Kill running tween
    this.killActiveTween();

    const rule = this.resolveStateRule(state);

    // Visibility
    this.container.visible = rule.visible;
    if (!rule.visible) return;

    // Alpha / scale overrides
    if (rule.alpha !== undefined) this.container.alpha = rule.alpha;
    if (rule.scale !== undefined && this.displayObject) this.displayObject.scale.set(rule.scale);

    // Renderer swap
    if (rule.swapRenderer && rule.swapLayerType) {
      this.swapRenderer(rule);
    }

    // Animation
    if (rule.static || rule.animationDriver === 'none') {
      // No animation – ensure spine is stopped
      this.spineContainer?.stop();
      return;
    }

    switch (rule.animationDriver) {
      case 'tween':
        this.playTween(rule);
        break;
      case 'spine':
        this.playSpine(rule);
        break;
    }
  }

  private resolveStateRule(state: SymbolLifecycleState): LayerStateRule {
    return this.config.states[state] ?? this.config.defaultState ?? DEFAULT_LAYER_STATE;
  }

  // ── Tween playback ────────────────────────────────────────────────────

  private playTween(rule: LayerStateRule): void {
    if (!rule.tween) return;

    // Reset transform before playing so animations start from clean state
    const target = this.container;
    target.rotation = 0;
    target.scale.set(1);
    // Reset y to config offset (not accumulated from previous tweens)
    target.y = this.config.offset?.[1] ?? 0;
    target.x = this.config.offset?.[0] ?? 0;

    const opts: TweenOptions = {
      type: rule.tween.type,
      duration: rule.tween.duration,
      delay: rule.tween.delay,
      repeat: rule.tween.repeat,
      loop: rule.tween.loop,
      yoyo: rule.tween.yoyo,
      easing: rule.tween.easing,
      scale: rule.tween.scale,
      intensity: rule.tween.intensity,
      color: rule.tween.color,
      strength: rule.tween.strength,
      distance: rule.tween.distance,
      direction: rule.tween.direction,
      // Don't use shared layerId — each symbol layer manages its own tween lifecycle
    };

    this.activeTween = TweenFactory.play(target, opts);
  }

  // ── Spine playback ────────────────────────────────────────────────────

  private playSpine(rule: LayerStateRule): void {
    if (!rule.spine) return;

    // If spine container exists, play the animation
    if (this.spineContainer) {
      if (rule.spine.timeScale !== undefined) {
        this.spineContainer.setTimeScale(rule.spine.timeScale);
      }
      this.spineContainer.play(rule.spine.animationName, rule.spine.loop ?? false);
      return;
    }

    // If the layer is a sprite but swapped to spine in this state, the swap
    // should have already happened via swapRenderer.
  }

  // ── Renderer swapping ─────────────────────────────────────────────────

  private swapRenderer(rule: LayerStateRule): void {
    this.clearDisplayObject();

    // Temporarily override config type for build
    const originalType = this.config.type;
    const originalKey = this.config.assetKey;
    (this.config as any).type = rule.swapLayerType!;
    if (rule.swapAssetKey) (this.config as any).assetKey = rule.swapAssetKey;

    this.buildDisplayObject();

    // Restore original config (swap is transient per state)
    (this.config as any).type = originalType;
    (this.config as any).assetKey = originalKey;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  private killActiveTween(): void {
    if (this.activeTween) {
      this.activeTween.kill();
      this.activeTween = null;
    }
    // Also kill any GSAP tweens directly on the container (position/scale)
    TweenFactory.kill(this.container);
  }

  private clearDisplayObject(): void {
    this.killActiveTween();

    if (this.displayObject) {
      this.container.removeChild(this.displayObject);
      // Don't destroy spine – it may be pooled
      if (!this.spineContainer) {
        this.displayObject.destroy?.({ children: true });
      } else {
        this.spineContainer.stop();
        this.spineContainer = null;
      }
      this.displayObject = null;
    }
  }

  public getDisplayObject(): Container | Sprite | Graphics | null {
    return this.displayObject;
  }

  public reset(): void {
    this.killActiveTween();
    this.spineContainer?.stop();
    this.container.visible = true;
    this.container.alpha = this.config.alpha ?? 1;
    this.container.rotation = 0;
    this.container.y = this.config.offset?.[1] ?? 0;
    this.container.x = this.config.offset?.[0] ?? 0;
    this.container.scale.set(1);
    if (this.displayObject) {
      this.displayObject.scale.set(1);
    }
    this.currentState = 'idle';
  }

  public destroy(): void {
    this.clearDisplayObject();
    this.container.destroy({ children: true });
  }
}
