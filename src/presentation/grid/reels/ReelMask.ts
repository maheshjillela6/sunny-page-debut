/**
 * ReelMask - Mask for individual reel
 */

import { Graphics } from 'pixi.js';

export class ReelMask extends Graphics {
  constructor(width: number, height: number) {
    super();
    this.label = 'ReelMask';
    this.rect(0, 0, width, height);
    this.fill({ color: 0xffffff });
  }

  public resize(width: number, height: number): void {
    this.clear();
    this.rect(0, 0, width, height);
    this.fill({ color: 0xffffff });
  }
}
