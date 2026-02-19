/**
 * ImageFramePlugin - Texture-based grid frame using 9-slice or single-frame images.
 *
 * All visuals come from config. Supports variant switching and lifecycle animations.
 */

import { Container, Sprite, Texture } from 'pixi.js';
import type { IGridFramePlugin } from '../types/IGridFramePlugin';
import type { GridFrameConfig, ImageFrameVariant, FrameAnimationBindings, FrameAnimation } from '../types/GridFrameConfig';
import type { GridConfig } from '@/presentation/grid/GridManager';
import { TextureCache } from '@/runtime/pixi/assets/TextureCache';
import { parsePixiColor } from '@/presentation/layers/config/LayerConfigManager';
import gsap from 'gsap';

export class ImageFramePlugin implements IGridFramePlugin {
  readonly id = 'image-frame';

  private root: Container = new Container();
  private textureCache: TextureCache = TextureCache.getInstance();
  private variants: Record<string, ImageFrameVariant> = {};
  private activeVariantName: string = '';
  private animBindings: FrameAnimationBindings = {};
  private activeTweens: gsap.core.Tween[] = [];
  private currentGridConfig: GridConfig | null = null;

  constructor() {
    this.root.label = 'ImageBasedFrame';
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  public build(config: GridFrameConfig, gridConfig: GridConfig): void {
    this.currentGridConfig = gridConfig;
    this.cleanup();

    const imgCfg = config.image;
    if (!imgCfg) return;

    this.variants = imgCfg.variants ?? {};
    this.animBindings = imgCfg.animations ?? {};

    const active = imgCfg.activeVariant ?? Object.keys(this.variants)[0];
    if (active) this.applyVariant(active, gridConfig);
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  public resize(gridConfig: GridConfig): void {
    this.currentGridConfig = gridConfig;
    if (this.activeVariantName) {
      this.applyVariant(this.activeVariantName, gridConfig);
    }
  }

  // ── Variant ───────────────────────────────────────────────────────────────

  public setVariant(_containerName: string, variantName: string): boolean {
    if (!this.variants[variantName] || !this.currentGridConfig) return false;
    this.applyVariant(variantName, this.currentGridConfig);
    return true;
  }

  private applyVariant(name: string, gc: GridConfig): void {
    this.root.removeChildren();
    this.activeVariantName = name;

    const v = this.variants[name];
    if (!v) return;

    const gw = gc.cols * gc.cellWidth + (gc.cols - 1) * gc.spacing;
    const gh = gc.rows * gc.cellHeight + (gc.rows - 1) * gc.spacing;
    const pad = v.padding ?? {};

    // Single frame texture
    if (v.textures?.frame) {
      const tex = this.textureCache.getSync(v.textures.frame);
      if (tex && tex !== Texture.EMPTY) {
        const sprite = new Sprite(tex);
        sprite.x = -(pad.left ?? 0);
        sprite.y = -(pad.top ?? 0);
        sprite.width = gw + (pad.left ?? 0) + (pad.right ?? 0);
        sprite.height = gh + (pad.top ?? 0) + (pad.bottom ?? 0);
        if (v.alpha !== undefined) sprite.alpha = v.alpha;
        if (v.tint) sprite.tint = parsePixiColor(v.tint, 0xffffff);
        this.root.addChild(sprite);
      }
    }

    // 9-slice textures (edges)
    const edgeKeys = ['topLeft', 'top', 'topRight', 'left', 'right', 'bottomLeft', 'bottom', 'bottomRight'] as const;
    for (const key of edgeKeys) {
      const texKey = v.textures?.[key];
      if (!texKey) continue;
      const tex = this.textureCache.getSync(texKey);
      if (!tex || tex === Texture.EMPTY) continue;

      const sprite = new Sprite(tex);
      if (v.alpha !== undefined) sprite.alpha = v.alpha;
      if (v.tint) sprite.tint = parsePixiColor(v.tint, 0xffffff);

      // Position based on edge
      this.positionEdgeSprite(sprite, key, gw, gh, pad);
      this.root.addChild(sprite);
    }
  }

  private positionEdgeSprite(
    sprite: Sprite,
    edge: string,
    gw: number,
    gh: number,
    pad: { top?: number; right?: number; bottom?: number; left?: number },
  ): void {
    const pl = pad.left ?? 0;
    const pt = pad.top ?? 0;
    const pr = pad.right ?? 0;
    const pb = pad.bottom ?? 0;

    switch (edge) {
      case 'topLeft':
        sprite.x = -pl; sprite.y = -pt; break;
      case 'top':
        sprite.x = 0; sprite.y = -pt; sprite.width = gw; break;
      case 'topRight':
        sprite.x = gw; sprite.y = -pt; break;
      case 'left':
        sprite.x = -pl; sprite.y = 0; sprite.height = gh; break;
      case 'right':
        sprite.x = gw; sprite.y = 0; sprite.height = gh; break;
      case 'bottomLeft':
        sprite.x = -pl; sprite.y = gh; break;
      case 'bottom':
        sprite.x = 0; sprite.y = gh; sprite.width = gw; break;
      case 'bottomRight':
        sprite.x = gw; sprite.y = gh; break;
    }
  }

  // ── Animation lifecycle ───────────────────────────────────────────────────

  public triggerAnimation(lifecycle: string): void {
    this.stopAnimations();
    const anims = (this.animBindings as any)[lifecycle] ?? this.animBindings.custom?.[lifecycle];
    if (!anims || !Array.isArray(anims)) return;

    for (const anim of anims as FrameAnimation[]) {
      const target = anim.target ? this.root.getChildByLabel(anim.target) ?? this.root : this.root;
      const props: any = { [anim.property]: anim.to, duration: (anim.durationMs ?? 300) / 1000 };
      if (anim.delay) props.delay = anim.delay / 1000;
      if (anim.loop) props.repeat = -1;
      if (anim.yoyo) props.yoyo = true;
      if (anim.ease) props.ease = anim.ease;
      if (anim.from !== undefined) (target as any)[anim.property] = anim.from;
      this.activeTweens.push(gsap.to(target, props));
    }
  }

  public stopAnimations(): void {
    for (const t of this.activeTweens) t.kill();
    this.activeTweens = [];
  }

  // ── Container enable (no-op for image frames) ─────────────────────────────

  public setContainerEnabled(_name: string, _enabled: boolean): void {
    // Image frames don't have named sub-containers
  }

  // ── Update ────────────────────────────────────────────────────────────────

  public update(_deltaTime: number): void {
    // No per-frame work needed for image frames
  }

  // ── Display object ────────────────────────────────────────────────────────

  public getDisplayObject(): Container {
    return this.root;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private cleanup(): void {
    this.stopAnimations();
    this.root.removeChildren();
  }

  public destroy(): void {
    this.cleanup();
    this.root.destroy({ children: true });
  }
}
