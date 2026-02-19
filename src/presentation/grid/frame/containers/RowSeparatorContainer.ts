/**
 * RowSeparatorContainer - Draws horizontal lines between grid rows.
 * All visuals driven by RowSeparatorVariant config.
 */

import { Graphics } from 'pixi.js';
import { FrameSubContainer } from './FrameSubContainer';
import type { RowSeparatorVariant } from '../types/GridFrameConfig';
import type { GridConfig } from '@/presentation/grid/GridManager';

export class RowSeparatorContainer extends FrameSubContainer<RowSeparatorVariant> {
  private lines: Graphics = new Graphics();

  constructor() {
    super('FrameRowSeparators');
    this.addChild(this.lines);
  }

  protected draw(gc: GridConfig): void {
    const v = this.getActiveVariant();
    if (!v) return;

    this.lines.clear();

    const gw = this.gridWidth(gc);
    const px = v.paddingX ?? 0;

    for (let row = 1; row < gc.rows; row++) {
      const y = row * gc.cellHeight + (row - 1) * gc.spacing + gc.spacing / 2;
      this.lines.moveTo(px, y);
      this.lines.lineTo(gw - px, y);
    }

    this.lines.stroke({
      color: this.color(v.stroke, 0xffffff),
      width: v.strokeWidth ?? 1,
      alpha: v.strokeAlpha ?? 0.1,
    });

    if (v.blendMode) (this.lines as any).blendMode = v.blendMode;
  }
}
