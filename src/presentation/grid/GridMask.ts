/**
 * GridMask - Mask for the grid area
 */

import { Graphics } from 'pixi.js';

export class GridMask extends Graphics {
  constructor(width: number, height: number) {
    super();
    this.label = 'GridMask';
    this.rect(0, 0, width, height);
    this.fill({ color: 0xffffff });
  }

  public resize(width: number, height: number): void {
    this.clear();
    this.rect(0, 0, width, height);
    this.fill({ color: 0xffffff });
  }
}
