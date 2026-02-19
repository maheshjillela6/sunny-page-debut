/**
 * GridCoordinateMapper - Maps between grid and world coordinates
 */

import { GridConfig } from './GridManager';

export interface GridCoordinate {
  row: number;
  col: number;
}

export interface WorldCoordinate {
  x: number;
  y: number;
}

export class GridCoordinateMapper {
  private config: GridConfig;
  private offsetX: number;
  private offsetY: number;

  constructor(config: GridConfig, offsetX: number = 0, offsetY: number = 0) {
    this.config = config;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  public gridToWorld(gridCoord: GridCoordinate): WorldCoordinate {
    return {
      x: this.offsetX + gridCoord.col * (this.config.cellWidth + this.config.spacing) + this.config.cellWidth / 2,
      y: this.offsetY + gridCoord.row * (this.config.cellHeight + this.config.spacing) + this.config.cellHeight / 2,
    };
  }

  public worldToGrid(worldCoord: WorldCoordinate): GridCoordinate | null {
    const adjustedX = worldCoord.x - this.offsetX;
    const adjustedY = worldCoord.y - this.offsetY;

    const col = Math.floor(adjustedX / (this.config.cellWidth + this.config.spacing));
    const row = Math.floor(adjustedY / (this.config.cellHeight + this.config.spacing));

    if (col < 0 || col >= this.config.cols || row < 0 || row >= this.config.rows) {
      return null;
    }

    return { row, col };
  }

  public getCellTopLeft(row: number, col: number): WorldCoordinate {
    return {
      x: this.offsetX + col * (this.config.cellWidth + this.config.spacing),
      y: this.offsetY + row * (this.config.cellHeight + this.config.spacing),
    };
  }

  public getCellCenter(row: number, col: number): WorldCoordinate {
    const topLeft = this.getCellTopLeft(row, col);
    return {
      x: topLeft.x + this.config.cellWidth / 2,
      y: topLeft.y + this.config.cellHeight / 2,
    };
  }

  public setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }
}
