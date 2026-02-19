/**
 * FrameBorderContainer - Draws outer (and optional inner) border around the grid.
 * All visuals driven by FrameBorderVariant config.
 */

import { Graphics } from 'pixi.js';
import { FrameSubContainer } from './FrameSubContainer';
import type { FrameBorderVariant } from '../types/GridFrameConfig';
import type { GridConfig } from '@/presentation/grid/GridManager';

export class FrameBorderContainer extends FrameSubContainer<FrameBorderVariant> {
  private outerBorder: Graphics = new Graphics();
  private innerBorder: Graphics = new Graphics();

  constructor() {
    super('FrameBorder');
    this.addChild(this.outerBorder);
    this.addChild(this.innerBorder);
  }

  protected draw(gc: GridConfig): void {
    const v = this.getActiveVariant();
    if (!v) return;

    const gw = this.gridWidth(gc);
    const gh = this.gridHeight(gc);

    // Outer border
    this.outerBorder.clear();
    const m = v.margin ?? 0;
    const r = v.radius ?? 0;
    if (r > 0) {
      this.outerBorder.roundRect(-m, -m, gw + m * 2, gh + m * 2, r);
    } else {
      this.outerBorder.rect(-m, -m, gw + m * 2, gh + m * 2);
    }
    this.outerBorder.stroke({
      color: this.color(v.stroke, 0x3b82f6),
      width: v.strokeWidth ?? 2,
      alpha: v.strokeAlpha ?? 1,
    });
    if (v.blendMode) (this.outerBorder as any).blendMode = v.blendMode;

    // Inner border
    this.innerBorder.clear();
    if (v.inner) {
      const im = v.inner.margin ?? 0;
      const ir = v.inner.radius ?? 0;
      if (ir > 0) {
        this.innerBorder.roundRect(im, im, gw - im * 2, gh - im * 2, ir);
      } else {
        this.innerBorder.rect(im, im, gw - im * 2, gh - im * 2);
      }
      this.innerBorder.stroke({
        color: this.color(v.inner.stroke, 0x8b5cf6),
        width: v.inner.strokeWidth ?? 1,
        alpha: v.inner.strokeAlpha ?? 0.5,
      });
    }
  }
}
