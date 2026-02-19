/**
 * GridLayoutApplier - Applies layout configurations to grid
 */

import { GridContainer } from './GridContainer';
import { GridConfig } from './GridManager';

export interface LayoutConfig {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  spacing: number;
  offsetX: number;
  offsetY: number;
}

export class GridLayoutApplier {
  public static apply(grid: GridContainer, layout: LayoutConfig): void {
    grid.x = layout.offsetX;
    grid.y = layout.offsetY;
  }

  public static createDefaultLayout(): LayoutConfig {
    return {
      cols: 5,
      rows: 3,
      cellWidth: 120,
      cellHeight: 120,
      spacing: 8,
      offsetX: 0,
      offsetY: 0,
    };
  }
}
