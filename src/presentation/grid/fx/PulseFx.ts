/**
 * PulseFx - Pulse animation effect
 */

import { Container, Graphics } from 'pixi.js';

export class PulseFx extends Container {
  private pulseGraphics: Graphics;
  private isPlaying: boolean = false;
  private time: number = 0;
  private pulseWidth: number = 0;
  private pulseHeight: number = 0;

  constructor() {
    super();
    this.label = 'PulseFx';

    this.pulseGraphics = new Graphics();
    this.addChild(this.pulseGraphics);

    this.visible = false;
  }

  public play(x: number, y: number, width: number, height: number, color: number = 0xffffff): void {
    this.x = x;
    this.y = y;
    this.pulseWidth = width;
    this.pulseHeight = height;
    this.isPlaying = true;
    this.time = 0;
    this.visible = true;

    this.pulseGraphics.clear();
    this.pulseGraphics.roundRect(0, 0, width, height, 8);
    this.pulseGraphics.stroke({ color, width: 3 });
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    this.time += deltaTime * 16.67;
    
    const scale = 1 + Math.sin(this.time * 0.01) * 0.05;
    this.scale.set(scale);
    
    // Pivot to center for scaling
    this.pivot.set(this.pulseWidth / 2, this.pulseHeight / 2);
  }

  public stop(): void {
    this.isPlaying = false;
    this.visible = false;
    this.pulseGraphics.clear();
    this.scale.set(1);
    this.pivot.set(0);
  }

  public reset(): void {
    this.stop();
    this.x = 0;
    this.y = 0;
  }
}
