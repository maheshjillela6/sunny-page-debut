/**
 * ConfigDrivenLayer - Reusable base class for all data-driven Pixi layers.
 *
 * Loads a GenericLayerConfig JSON, creates sublayers, instantiates elements,
 * wires up visibility rules, event bindings, and animation sequences.
 *
 * Subclasses only need to provide:
 *   - layerName / stageLayer / configFileName
 *   - Override hooks for custom behaviour (onConfigLoaded, onElementCreated, etc.)
 */

import { Container, Graphics, Sprite, Texture, Text, TextStyle } from 'pixi.js';
import { LayerContainer } from '../../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../../runtime/pixi/stage/StageRoot';
import { vw, vh } from '../../../runtime/pixi/core/VirtualDims';
import { PixiFactory } from '../../../runtime/pixi/factory/PixiFactory';
import { TextureCache } from '../../../runtime/pixi/assets/TextureCache';
import { SpineFactory } from '../../../runtime/pixi/spine/SpineFactory';
import { EventBus } from '../../../platform/events/EventBus';
import { LayerConfigManager, parsePixiColor } from '../config/LayerConfigManager';
import type {
  GenericLayerConfig,
  Sublayer,
  LayerElement,
  AnimationSequence,
  AnimationKeyframe,
  VisibilityRule,
  EventBinding,
  TextStyleConfig,
} from '../config/GenericLayerSchema';

export interface ConfigDrivenLayerOptions {
  /** Layer name for debugging */
  layerName: string;
  /** StageLayer enum value (default zIndex) */
  stageLayer: StageLayer;
  /** JSON config filename, e.g. 'overlay.layer.json' */
  configFileName: string;
}

/**
 * Base class that every data-driven layer can extend.
 */
export class ConfigDrivenLayer extends LayerContainer {
  protected factory: PixiFactory;
  protected textureCache: TextureCache;
  protected spineFactory: SpineFactory;
  protected eventBus: EventBus;
  protected cfgManager: LayerConfigManager;

  protected config: GenericLayerConfig = {};
  protected sublayerContainers: Map<string, Container> = new Map();
  protected elementMap: Map<string, Container> = new Map();
  protected boundEventCleanups: Array<() => void> = [];

  private opts: ConfigDrivenLayerOptions;

  constructor(opts: ConfigDrivenLayerOptions) {
    super({
      name: opts.layerName,
      zIndex: opts.stageLayer,
    });

    this.opts = opts;
    this.factory = PixiFactory.getInstance();
    this.textureCache = TextureCache.getInstance();
    this.spineFactory = SpineFactory.getInstance();
    this.eventBus = EventBus.getInstance();
    this.cfgManager = LayerConfigManager.getInstance();

    void this.loadAndBuild();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private async loadAndBuild(): Promise<void> {
    try {
      this.config = await this.fetchConfig();
    } catch (e) {
      console.error(`[${this.opts.layerName}] Config load failed:`, e);
      this.config = {};
    }

    // Enabled check
    if (this.config.enabled === false) {
      this.visible = false;
      return;
    }

    // ZIndex override
    if (typeof this.config.zIndex === 'number') {
      this.setLayerIndex(this.config.zIndex);
    }

    this.buildSublayers();
    this.buildTopLevelElements();
    this.applyVisibilityRules(this, this.config.visibilityRules);
    this.bindEvents(this.config.eventBindings);
    this.onConfigLoaded(this.config);
  }

  /**
   * Fetch merged config.
   * Priority: game-specific config file FIRST → fallback to shared defaults.
   * Uses the public LayerConfigManager.getLayerConfig() which handles:
   *   1. Try to load /games/{gameId}/layers/{configFileName}
   *   2. If not found, returns empty {} (game override is optional)
   *   3. Deep-merges: shared defaults as base, game config values override
   *
   * This means any key present in the game config takes priority;
   * keys not present in the game config fall back to shared/layers/defaults.json.
   */
  protected async fetchConfig(): Promise<GenericLayerConfig> {
    return this.cfgManager.getLayerConfig<GenericLayerConfig>(this.opts.configFileName);
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private buildSublayers(): void {
    if (!this.config.sublayers) return;

    for (const sublayer of this.config.sublayers) {
      const container = this.factory.createContainer({ label: sublayer.name });
      if (typeof sublayer.zIndex === 'number') container.zIndex = sublayer.zIndex;
      if (sublayer.visible === false) container.visible = false;

      for (const element of sublayer.elements) {
        const el = this.createElement(element);
        if (el) {
          container.addChild(el);
          if (element.id) this.elementMap.set(element.id, el);
        }
      }

      this.applyVisibilityRules(container, sublayer.visibilityRules);
      this.sublayerContainers.set(sublayer.name, container);
      this.addChild(container);
    }
  }

  private buildTopLevelElements(): void {
    if (!this.config.elements) return;

    for (const element of this.config.elements) {
      const el = this.createElement(element);
      if (el) {
        this.addChild(el);
        if (element.id) this.elementMap.set(element.id, el);
      }
    }
  }

  // ── Element Factory ───────────────────────────────────────────────────────

  protected createElement(desc: LayerElement): Container | null {
    let element: Container | null = null;

    switch (desc.type) {
      case 'image':
      case 'sprite':
        element = this.createImageElement(desc);
        break;
      case 'spine':
        element = this.createSpineElement(desc);
        break;
      case 'graphics':
        element = this.createGraphicsElement(desc);
        break;
      case 'text':
        element = this.createTextElement(desc);
        break;
      case 'container':
        element = this.createContainerElement(desc);
        break;
    }

    // If primary failed, try fallback
    if (!element && desc.fallback) {
      element = this.createElement(desc.fallback);
    }

    if (!element) return null;

    // Apply position & transform
    this.applyPosition(element, desc);
    this.applyTransform(element, desc);

    // Interactive
    if (desc.interactive) element.eventMode = desc.eventMode ?? 'static';
    else if (desc.eventMode) element.eventMode = desc.eventMode;

    // Label
    if (desc.id) element.label = desc.id;

    // Visibility rules
    this.applyVisibilityRules(element, desc.visibilityRules);

    // Event bindings
    this.bindElementEvents(element, desc.eventBindings, desc.animations);

    // Play enter animation
    if (desc.animations?.playOnEnter) {
      this.playAnimation(element, desc.animations.playOnEnter);
    }

    // Notify subclass
    this.onElementCreated(desc.id, element, desc);

    return element;
  }

  private createImageElement(desc: LayerElement): Sprite | null {
    const key = desc.textureKey;
    if (!key) return null;

    const tex = this.textureCache.getSync(key);
    if (!tex || tex === Texture.EMPTY) return null;

    const sprite = new Sprite(tex);

    if (desc.scaleMode === 'cover') {
      const scale = Math.max(vw() / tex.width, vh() / tex.height);
      sprite.scale.set(scale);
      sprite.anchor.set(0.5);
      sprite.x = vw() / 2;
      sprite.y = vh() / 2;
    }

    return sprite;
  }

  private createSpineElement(desc: LayerElement): Container | null {
    const key = desc.spineKey;
    if (!key) return null;
    if (!this.spineFactory.isSpineEnabled() || !this.spineFactory.isSpineLoaded(key)) return null;

    const spine = this.spineFactory.createSpineInstance(key);
    if (!spine) return null;

    if (desc.fillScreen) {
      spine.x = vw() / 2;
      spine.y = vh() / 2;
      const baseScale = Math.max(vw() / 1920, vh() / 1080);
      spine.scale.set(baseScale);
    }

    // Play animation
    if (spine.state) {
      const anims = spine.skeleton?.data?.animations || [];
      const requested = desc.spineAnimation?.name;
      const loop = desc.spineAnimation?.loop ?? true;
      const chosen =
        (requested ? anims.find((a: any) => a.name === requested)?.name : null) ??
        (anims.length > 0 ? anims[0].name : null);
      if (chosen) spine.state.setAnimation(0, chosen, loop);
    }

    return spine;
  }

  private createGraphicsElement(desc: LayerElement): Graphics | null {
    if (!desc.shape) return null;

    const g = new Graphics();
    const fill = parsePixiColor(desc.fill, 0xffffff);
    const fillAlpha = desc.fillAlpha ?? 1;
    const stroke = desc.stroke !== undefined ? parsePixiColor(desc.stroke, 0xffffff) : undefined;
    const strokeWidth = desc.strokeWidth ?? 1;
    const strokeAlpha = desc.strokeAlpha ?? 1;

    switch (desc.shape.kind) {
      case 'rect': {
        const s = desc.shape;
        if (s.radius) {
          g.roundRect(s.x ?? 0, s.y ?? 0, s.width, s.height, s.radius);
        } else {
          g.rect(s.x ?? 0, s.y ?? 0, s.width, s.height);
        }
        if (desc.fill !== undefined) g.fill({ color: fill, alpha: fillAlpha });
        if (stroke !== undefined) g.stroke({ color: stroke, width: strokeWidth, alpha: strokeAlpha });
        break;
      }
      case 'circle': {
        const s = desc.shape;
        g.circle(s.x ?? 0, s.y ?? 0, s.radius);
        if (desc.fill !== undefined) g.fill({ color: fill, alpha: fillAlpha });
        if (stroke !== undefined) g.stroke({ color: stroke, width: strokeWidth, alpha: strokeAlpha });
        break;
      }
      case 'ellipse': {
        const s = desc.shape;
        g.ellipse(s.x ?? 0, s.y ?? 0, s.radiusX, s.radiusY);
        if (desc.fill !== undefined) g.fill({ color: fill, alpha: fillAlpha });
        if (stroke !== undefined) g.stroke({ color: stroke, width: strokeWidth, alpha: strokeAlpha });
        break;
      }
      case 'line': {
        const s = desc.shape;
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.stroke({ color: stroke ?? fill, width: strokeWidth, alpha: strokeAlpha });
        break;
      }
      case 'polygon': {
        const s = desc.shape;
        g.poly(s.points);
        if (desc.fill !== undefined) g.fill({ color: fill, alpha: fillAlpha });
        if (stroke !== undefined) g.stroke({ color: stroke, width: strokeWidth, alpha: strokeAlpha });
        break;
      }
      case 'starfield': {
        // Delegate to container-based starfield
        return null; // handled by subclass or future extension
      }
    }

    return g;
  }

  private createTextElement(desc: LayerElement): Text | null {
    const style = this.buildTextStyle(desc.textStyle ?? {});
    const text = new Text({ text: desc.text ?? '', style });

    const ax = desc.position?.anchor?.x ?? 0.5;
    const ay = desc.position?.anchor?.y ?? 0.5;
    text.anchor.set(ax, ay);

    return text;
  }

  private createContainerElement(desc: LayerElement): Container {
    const container = this.factory.createContainer({ label: desc.id ?? 'container' });

    if (desc.children) {
      for (const child of desc.children) {
        const el = this.createElement(child);
        if (el) container.addChild(el);
      }
    }

    return container;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private applyPosition(el: Container, desc: LayerElement): void {
    if (!desc.position) return;
    if (desc.position.x !== undefined) el.x = desc.position.x;
    if (desc.position.y !== undefined) el.y = desc.position.y;
    if (desc.position.pivot) el.pivot.set(desc.position.pivot.x, desc.position.pivot.y);
  }

  private applyTransform(el: Container, desc: LayerElement): void {
    if (!desc.transform) return;
    if (desc.transform.scale !== undefined) {
      if (typeof desc.transform.scale === 'number') {
        el.scale.set(desc.transform.scale);
      } else {
        el.scale.set(desc.transform.scale.x, desc.transform.scale.y);
      }
    }
    if (desc.transform.rotation !== undefined) el.rotation = desc.transform.rotation;
    if (desc.transform.alpha !== undefined) el.alpha = desc.transform.alpha;
  }

  protected buildTextStyle(cfg: TextStyleConfig): TextStyle {
    const opts: any = {
      fontFamily: cfg.fontFamily ?? 'Arial',
      fontSize: cfg.fontSize ?? 24,
      fill: parsePixiColor(cfg.fill, 0xffffff),
    };
    if (cfg.fontWeight) opts.fontWeight = cfg.fontWeight;
    if (cfg.letterSpacing) opts.letterSpacing = cfg.letterSpacing;
    if (cfg.lineHeight) opts.lineHeight = cfg.lineHeight;
    if (cfg.wordWrap) opts.wordWrap = cfg.wordWrap;
    if (cfg.wordWrapWidth) opts.wordWrapWidth = cfg.wordWrapWidth;
    if (cfg.stroke) {
      opts.stroke = { color: parsePixiColor(cfg.stroke, 0x000000), width: cfg.strokeWidth ?? 2 };
    }
    if (cfg.dropShadow) {
      opts.dropShadow = {
        color: parsePixiColor(cfg.dropShadow.color, 0x000000),
        alpha: cfg.dropShadow.alpha ?? 0.5,
        blur: cfg.dropShadow.blur ?? 4,
        distance: cfg.dropShadow.distance ?? 0,
        angle: cfg.dropShadow.angle ?? 0,
      };
    }
    return new TextStyle(opts);
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  protected playAnimation(target: Container, sequence: AnimationSequence): void {
    for (const kf of sequence.keyframes) {
      this.animateKeyframe(target, kf, sequence.loop ?? false);
    }
  }

  private animateKeyframe(target: Container, kf: AnimationKeyframe, loop: boolean): void {
    const duration = kf.durationMs;
    const delay = kf.delay ?? 0;
    const startTime = performance.now() + delay;

    const startValue = kf.from ?? this.getPropertyValue(target, kf.property);
    const endValue = kf.to;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < 0) {
        requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      const eased = this.easeOutCubic(progress);
      const value = startValue + (endValue - startValue) * eased;

      this.setPropertyValue(target, kf.property, value);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else if (loop) {
        // Restart
        this.animateKeyframe(target, { ...kf, from: startValue }, loop);
      }
    };

    requestAnimationFrame(tick);
  }

  private getPropertyValue(target: Container, prop: string): number {
    switch (prop) {
      case 'x': return target.x;
      case 'y': return target.y;
      case 'alpha': return target.alpha;
      case 'scaleX': return target.scale.x;
      case 'scaleY': return target.scale.y;
      case 'rotation': return target.rotation;
      default: return 0;
    }
  }

  private setPropertyValue(target: Container, prop: string, value: number): void {
    switch (prop) {
      case 'x': target.x = value; break;
      case 'y': target.y = value; break;
      case 'alpha': target.alpha = value; break;
      case 'scaleX': target.scale.x = value; break;
      case 'scaleY': target.scale.y = value; break;
      case 'rotation': target.rotation = value; break;
    }
  }

  protected easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  // ── Visibility Rules ──────────────────────────────────────────────────────

  private applyVisibilityRules(target: Container, rules?: VisibilityRule[]): void {
    // Visibility rules are evaluated by the game runtime calling `evaluateVisibility`.
    // We store them on the container for later evaluation.
    if (rules && rules.length > 0) {
      (target as any).__visibilityRules = rules;
    }
  }

  /**
   * Call from game loop to evaluate visibility rules against current state.
   */
  public evaluateVisibility(state: Record<string, any>): void {
    for (const [, el] of this.elementMap) {
      const rules = (el as any).__visibilityRules as VisibilityRule[] | undefined;
      if (!rules) continue;
      el.visible = rules.every((r) => {
        const value = this.resolveStateKey(state, r.stateKey);
        let match: boolean;
        if (r.equals !== undefined) {
          match = value === r.equals;
        } else {
          match = !!value;
        }
        return r.invert ? !match : match;
      });
    }
  }

  private resolveStateKey(state: Record<string, any>, key: string): any {
    return key.split('.').reduce((obj, k) => obj?.[k], state);
  }

  // ── Event Bindings ────────────────────────────────────────────────────────

  private bindEvents(bindings?: EventBinding[]): void {
    if (!bindings) return;
    for (const binding of bindings) {
      this.bindSingleEvent(this, binding);
    }
  }

  private bindElementEvents(
    element: Container,
    bindings?: EventBinding[],
    animations?: LayerElement['animations']
  ): void {
    if (!bindings) return;
    for (const binding of bindings) {
      this.bindSingleEvent(element, binding, animations);
    }
  }

  private bindSingleEvent(
    target: Container,
    binding: EventBinding,
    animations?: LayerElement['animations']
  ): void {
    const handler = () => {
      switch (binding.action) {
        case 'show':
          target.visible = true;
          break;
        case 'hide':
          target.visible = false;
          break;
        case 'playAnimation': {
          const anim = binding.animationName
            ? animations?.states?.[binding.animationName]
            : animations?.playOnEnter;
          if (anim) this.playAnimation(target, anim);
          break;
        }
        case 'stopAnimation':
          // Reset transforms
          break;
        case 'destroy':
          target.destroy({ children: true });
          break;
        case 'custom':
          this.onCustomEvent(binding.handlerId ?? '', target);
          break;
      }
    };

    const subId = this.eventBus.on(binding.event as any, handler as any);
    this.boundEventCleanups.push(() => this.eventBus.off(subId));
  }

  // ── Hooks for subclasses ──────────────────────────────────────────────────

  /** Called after config is loaded and base elements are built */
  protected onConfigLoaded(_config: GenericLayerConfig): void {
    // Override in subclass
  }

  /** Called after each element is created */
  protected onElementCreated(_id: string, _element: Container, _desc: LayerElement): void {
    // Override in subclass
  }

  /** Called for custom event actions */
  protected onCustomEvent(_handlerId: string, _target: Container): void {
    // Override in subclass
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Get a sublayer container by name */
  public getSublayer(name: string): Container | undefined {
    return this.sublayerContainers.get(name);
  }

  /** Get an element by id */
  public getElement(id: string): Container | undefined {
    return this.elementMap.get(id);
  }

  /** Rebuild the layer from current config */
  public rebuild(): void {
    this.clearAll();
    this.buildSublayers();
    this.buildTopLevelElements();
  }

  /** Clear all dynamic content */
  public clearAll(): void {
    for (const cleanup of this.boundEventCleanups) cleanup();
    this.boundEventCleanups = [];

    for (const [, container] of this.sublayerContainers) {
      this.removeChild(container);
      container.destroy({ children: true });
    }
    this.sublayerContainers.clear();
    this.elementMap.clear();
  }

  public override destroy(): void {
    this.clearAll();
    super.destroy();
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  private deepMerge<T>(base: T, override: any): T {
    if (!this.isObject(base) || !this.isObject(override)) return (override ?? base) as T;
    const out: any = { ...base };
    for (const [k, v] of Object.entries(override)) {
      out[k] = this.isObject(out[k]) && this.isObject(v) ? this.deepMerge(out[k], v) : v;
    }
    return out as T;
  }

  private isObject(v: unknown): v is Record<string, any> {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }
}
