/**
 * FrameSubContainer - Base class for all frame sub-containers.
 *
 * Provides common variant management, enable/disable, animation binding,
 * and layout update hooks. Subclasses implement the actual drawing.
 */

import { Container, Graphics } from 'pixi.js';
import type { GridConfig } from '@/presentation/grid/GridManager';
import type { FrameAnimationBindings, FrameAnimation } from '../types/GridFrameConfig';
import { parsePixiColor } from '@/presentation/layers/config/LayerConfigManager';
import gsap from 'gsap';

export abstract class FrameSubContainer<V = any> extends Container {
  protected _enabled: boolean = true;
  protected variants: Record<string, V> = {};
  protected activeVariantName: string = '';
  protected animationBindings: FrameAnimationBindings = {};
  protected gridConfig: GridConfig | null = null;
  protected activeTweens: gsap.core.Tween[] = [];

  constructor(name: string) {
    super();
    this.label = name;
  }

  // ── Variant management ──────────────────────────────────────────────────

  public setVariants(variants: Record<string, V>, activeVariant?: string): void {
    this.variants = variants;
    if (activeVariant && variants[activeVariant]) {
      this.switchVariant(activeVariant);
    } else {
      const first = Object.keys(variants)[0];
      if (first) this.switchVariant(first);
    }
  }

  public switchVariant(name: string): boolean {
    if (!this.variants[name]) return false;
    this.activeVariantName = name;
    if (this.gridConfig) this.draw(this.gridConfig);
    return true;
  }

  public getActiveVariant(): V | undefined {
    return this.variants[this.activeVariantName];
  }

  // ── Enable / Disable ────────────────────────────────────────────────────

  public setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.visible = enabled;
    if (!enabled) this.stopAllTweens();
  }

  public isEnabled(): boolean {
    return this._enabled;
  }

  // ── Animation bindings ──────────────────────────────────────────────────

  public setAnimationBindings(bindings: FrameAnimationBindings): void {
    this.animationBindings = bindings;
  }

  public triggerAnimation(lifecycle: string): void {
    if (!this._enabled) return;
    this.stopAllTweens();

    const anims =
      (this.animationBindings as any)[lifecycle] ??
      this.animationBindings.custom?.[lifecycle];
    if (!anims || !Array.isArray(anims)) return;

    for (const anim of anims as FrameAnimation[]) {
      this.playAnim(anim);
    }
  }

  public stopAllTweens(): void {
    for (const t of this.activeTweens) t.kill();
    this.activeTweens = [];
  }

  protected playAnim(anim: FrameAnimation): void {
    const target = anim.target ? this.getChildByLabel(anim.target) ?? this : this;

    const propMap: Record<string, string> = {
      alpha: 'alpha',
      x: 'x',
      y: 'y',
      rotation: 'rotation',
      scaleX: 'scale.x',
      scaleY: 'scale.y',
    };

    const gsapProp = propMap[anim.property] ?? anim.property;
    const props: any = { [gsapProp]: anim.to, duration: (anim.durationMs ?? 300) / 1000 };
    if (anim.from !== undefined) (target as any)[anim.property] = anim.from;
    if (anim.delay) props.delay = anim.delay / 1000;
    if (anim.loop) props.repeat = -1;
    if (anim.yoyo) props.yoyo = true;
    if (anim.ease) props.ease = anim.ease;

    const tween = gsap.to(target, props);
    this.activeTweens.push(tween);
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  public layout(gridConfig: GridConfig): void {
    this.gridConfig = gridConfig;
    if (this._enabled) this.draw(gridConfig);
  }

  /** Subclasses implement the actual drawing here */
  protected abstract draw(gridConfig: GridConfig): void;

  // ── Update ──────────────────────────────────────────────────────────────

  public update(_deltaTime: number): void {
    // Override in subclasses if per-frame work needed
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  protected gridWidth(gc: GridConfig): number {
    return gc.cols * gc.cellWidth + (gc.cols - 1) * gc.spacing;
  }

  protected gridHeight(gc: GridConfig): number {
    return gc.rows * gc.cellHeight + (gc.rows - 1) * gc.spacing;
  }

  protected color(hex: any, fallback: number): number {
    return parsePixiColor(hex, fallback);
  }

  public override destroy(): void {
    this.stopAllTweens();
    super.destroy({ children: true });
  }
}
