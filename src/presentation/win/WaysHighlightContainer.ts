/**
 * WaysHighlightContainer - Container for ways-to-win highlights
 */

import { Container, Graphics } from 'pixi.js';

export interface WaysPosition {
  col: number;
  row: number;
  x: number;
  y: number;
}

export class WaysHighlightContainer extends Container {
  private highlightGraphics: Graphics;
  private positions: WaysPosition[][] = [];
  private isAnimating: boolean = false;
  private time: number = 0;
  private currentWayIndex: number = 0;

  constructor() {
    super();
    this.label = 'WaysHighlight';
    this.highlightGraphics = new Graphics();
    this.addChild(this.highlightGraphics);
  }

  public showWays(
    ways: WaysPosition[][],
    cellWidth: number,
    cellHeight: number,
    color: number = 0xf1c40f
  ): void {
    this.positions = ways;
    this.currentWayIndex = 0;
    this.drawCurrentWay(cellWidth, cellHeight, color);
    this.isAnimating = true;
  }

  private drawCurrentWay(cellWidth: number, cellHeight: number, color: number): void {
    this.highlightGraphics.clear();

    if (this.positions.length === 0) return;

    const way = this.positions[this.currentWayIndex % this.positions.length];

    for (const pos of way) {
      this.highlightGraphics.roundRect(pos.x, pos.y, cellWidth, cellHeight, 8);
      this.highlightGraphics.fill({ color, alpha: 0.4 });
      this.highlightGraphics.stroke({ color, width: 3 });
    }
  }

  public update(deltaTime: number): void {
    if (!this.isAnimating) return;

    this.time += deltaTime * 16.67;
    const pulse = Math.sin(this.time * 0.008) * 0.2 + 0.8;
    this.alpha = pulse;

    // Cycle through ways
    if (this.time > 1500) {
      this.time = 0;
      this.currentWayIndex++;
    }
  }

  public clear(): void {
    this.highlightGraphics.clear();
    this.positions = [];
    this.isAnimating = false;
    this.currentWayIndex = 0;
    this.alpha = 1;
  }
}
