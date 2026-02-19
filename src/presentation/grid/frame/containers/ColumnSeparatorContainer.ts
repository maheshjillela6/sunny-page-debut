/**
 * ColumnSeparatorContainer - Draws vertical lines between grid columns.
 * All visuals driven by ColumnSeparatorVariant config.
 */

import { Graphics } from 'pixi.js';
import { FrameSubContainer } from './FrameSubContainer';
import type { ColumnSeparatorVariant } from '../types/GridFrameConfig';
import type { GridConfig } from '@/presentation/grid/GridManager';

export class ColumnSeparatorContainer extends FrameSubContainer<ColumnSeparatorVariant> {
  private lines: Graphics = new Graphics();

  constructor() {
    super('FrameColumnSeparators');
    this.addChild(this.lines);
  }

  protected draw(gc: GridConfig): void {
    const v = this.getActiveVariant();
    if (!v) return;

    this.lines.clear();

    const gh = this.gridHeight(gc);
    const py = v.paddingY ?? 0;

    for (let col = 1; col < gc.cols; col++) {
      const x = col * gc.cellWidth + (col - 1) * gc.spacing + gc.spacing / 2;
      this.lines.moveTo(x, py);
      this.lines.lineTo(x, gh - py);
    }

    this.lines.stroke({
      color: this.color(v.stroke, 0xffffff),
      width: v.strokeWidth ?? 1,
      alpha: v.strokeAlpha ?? 0.15,
    });

    if (v.blendMode) (this.lines as any).blendMode = v.blendMode;
  }
}
