/**
 * LineHighlightContainer - Container for payline highlights
 */

import { Container, Graphics } from 'pixi.js';

export interface LinePosition {
  col: number;
  row: number;
  x: number;
  y: number;
}

export class LineHighlightContainer extends Container {
  private lineGraphics: Graphics;
  private positions: LinePosition[] = [];
  private isAnimating: boolean = false;
  private time: number = 0;

  constructor() {
    super();
    this.label = 'LineHighlight';
    this.lineGraphics = new Graphics();
    this.addChild(this.lineGraphics);
  }

  public drawLine(
    positions: LinePosition[],
    cellWidth: number,
    cellHeight: number,
    color: number = 0xf1c40f,
    lineWidth: number = 4
  ): void {
    this.positions = positions;
    this.lineGraphics.clear();

    if (positions.length < 2) return;

    // Draw connecting line
    this.lineGraphics.moveTo(
      positions[0].x + cellWidth / 2,
      positions[0].y + cellHeight / 2
    );

    for (let i = 1; i < positions.length; i++) {
      this.lineGraphics.lineTo(
        positions[i].x + cellWidth / 2,
        positions[i].y + cellHeight / 2
      );
    }

    this.lineGraphics.stroke({ color, width: lineWidth, alpha: 0.8 });

    // Draw circles at each position
    for (const pos of positions) {
      this.lineGraphics.circle(
        pos.x + cellWidth / 2,
        pos.y + cellHeight / 2,
        8
      );
      this.lineGraphics.fill({ color });
    }

    this.isAnimating = true;
  }

  public update(deltaTime: number): void {
    if (!this.isAnimating) return;

    this.time += deltaTime * 16.67;
    const pulse = Math.sin(this.time * 0.01) * 0.2 + 0.8;
    this.alpha = pulse;
  }

  public clear(): void {
    this.lineGraphics.clear();
    this.positions = [];
    this.isAnimating = false;
    this.alpha = 1;
  }
}
