/**
 * DropFx - Drop/cascade effect for symbols
 */

import { Container, Graphics } from 'pixi.js';

export class DropFx extends Container {
  private dropGraphics: Graphics;
  private isPlaying: boolean = false;
  private startY: number = 0;
  private targetY: number = 0;
  private time: number = 0;
  private duration: number = 400;

  constructor() {
    super();
    this.label = 'DropFx';

    this.dropGraphics = new Graphics();
    this.addChild(this.dropGraphics);

    this.visible = false;
  }

  public play(
    x: number,
    startY: number,
    targetY: number,
    width: number,
    height: number,
    color: number = 0x3498db
  ): void {
    this.x = x;
    this.startY = startY;
    this.targetY = targetY;
    this.y = startY;
    this.isPlaying = true;
    this.time = 0;
    this.visible = true;

    this.dropGraphics.clear();
    this.dropGraphics.roundRect(0, 0, width, height, 8);
    this.dropGraphics.fill({ color, alpha: 0.3 });
    this.dropGraphics.stroke({ color, width: 2 });
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    this.time += deltaTime * 16.67;
    const progress = Math.min(this.time / this.duration, 1);

    // Ease out bounce
    const t = 1 - Math.pow(1 - progress, 3);
    this.y = this.startY + (this.targetY - this.startY) * t;

    // Bounce at the end
    if (progress > 0.8) {
      const bounceProgress = (progress - 0.8) / 0.2;
      const bounce = Math.sin(bounceProgress * Math.PI) * 10;
      this.y -= bounce;
    }

    if (progress >= 1) {
      this.stop();
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.visible = false;
    this.dropGraphics.clear();
  }

  public reset(): void {
    this.stop();
    this.x = 0;
    this.y = 0;
  }
}
