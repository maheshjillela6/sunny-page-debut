/**
 * AnimationContainer - Renders config-driven decorative animations (pulse, shimmer, etc.).
 * All visuals driven by AnimationVariant config.
 */

import { Graphics } from 'pixi.js';
import { FrameSubContainer } from './FrameSubContainer';
import type { AnimationVariant } from '../types/GridFrameConfig';
import type { GridConfig } from '@/presentation/grid/GridManager';
import gsap from 'gsap';

export class AnimationContainer extends FrameSubContainer<AnimationVariant> {
  private animGraphics: Graphics = new Graphics();

  constructor() {
    super('FrameAnimations');
    this.addChild(this.animGraphics);
  }

  protected draw(gc: GridConfig): void {
    const v = this.getActiveVariant();
    if (!v) return;

    this.stopAllTweens();
    this.animGraphics.clear();

    const gw = this.gridWidth(gc);
    const gh = this.gridHeight(gc);

    switch (v.type) {
      case 'pulse':
        this.buildPulse(gw, gh, v);
        break;
      case 'shimmer':
        this.buildShimmer(gw, gh, v);
        break;
      case 'rotate':
        this.buildRotate(gw, gh, v);
        break;
      case 'custom':
        break;
    }

    if (v.blendMode) (this.animGraphics as any).blendMode = v.blendMode;
  }

  private buildPulse(w: number, h: number, v: AnimationVariant): void {
    this.animGraphics.roundRect(-4, -4, w + 8, h + 8, 10);
    this.animGraphics.stroke({
      color: this.color(v.color, 0x3b82f6),
      width: 2,
      alpha: v.alpha ?? 0.3,
    });

    if (v.loop !== false) {
      const tween = gsap.to(this.animGraphics, {
        alpha: 0.1,
        duration: (v.durationMs ?? 2000) / 1000,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      this.activeTweens.push(tween);
    }
  }

  private buildShimmer(w: number, h: number, v: AnimationVariant): void {
    const shimmerWidth = v.width ?? 60;
    this.animGraphics.rect(0, 0, shimmerWidth, h);
    this.animGraphics.fill({
      color: this.color(v.color, 0xffffff),
      alpha: v.alpha ?? 0.05,
    });

    if (v.loop !== false) {
      this.animGraphics.x = -shimmerWidth;
      const tween = gsap.to(this.animGraphics, {
        x: w + shimmerWidth,
        duration: (v.durationMs ?? 3000) / 1000,
        repeat: -1,
        ease: 'none',
      });
      this.activeTweens.push(tween);
    }
  }

  private buildRotate(_w: number, _h: number, v: AnimationVariant): void {
    // Rotation animation on the container itself
    if (v.loop !== false) {
      const tween = gsap.to(this, {
        rotation: Math.PI * 2,
        duration: (v.durationMs ?? 5000) / 1000,
        repeat: -1,
        ease: 'none',
      });
      this.activeTweens.push(tween);
    }
  }
}
