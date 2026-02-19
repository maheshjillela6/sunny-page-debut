/**
 * BackgroundContainer - Draws the grid background fill.
 * All visuals driven by BackgroundVariant config.
 */

import { Graphics } from 'pixi.js';
import { FrameSubContainer } from './FrameSubContainer';
import type { BackgroundVariant } from '../types/GridFrameConfig';
import type { GridConfig } from '@/presentation/grid/GridManager';

export class BackgroundContainer extends FrameSubContainer<BackgroundVariant> {
  private bg: Graphics = new Graphics();

  constructor() {
    super('FrameBackground');
    this.addChild(this.bg);
  }

  protected draw(gc: GridConfig): void {
    const v = this.getActiveVariant();
    if (!v) return;

    this.bg.clear();

    const inset = v.inset ?? 0;
    const w = this.gridWidth(gc) + inset * 2;
    const h = this.gridHeight(gc) + inset * 2;
    const r = v.radius ?? 0;

    if (r > 0) {
      this.bg.roundRect(-inset, -inset, w, h, r);
    } else {
      this.bg.rect(-inset, -inset, w, h);
    }

    this.bg.fill({
      color: this.color(v.fill, 0x000000),
      alpha: v.fillAlpha ?? 0.8,
    });

    if (v.blendMode) (this.bg as any).blendMode = v.blendMode;
  }
}
