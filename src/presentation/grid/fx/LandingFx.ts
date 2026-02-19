/**
 * LandingFx - Landing effect for symbols
 */

import { Container, Graphics } from 'pixi.js';

export class LandingFx extends Container {
  private graphics: Graphics;
  private isPlaying: boolean = false;
  private time: number = 0;
  private duration: number = 300;

  constructor() {
    super();
    this.label = 'LandingFx';
    this.graphics = new Graphics();
    this.addChild(this.graphics);
    this.visible = false;
  }

  public play(x: number, y: number, width: number, height: number): void {
    this.x = x;
    this.y = y;
    this.isPlaying = true;
    this.time = 0;
    this.visible = true;
    
    this.graphics.clear();
    this.graphics.rect(0, 0, width, height);
    this.graphics.fill({ color: 0xffffff, alpha: 0.5 });
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    this.time += deltaTime * 16.67;
    const progress = Math.min(this.time / this.duration, 1);
    
    this.alpha = 1 - progress;
    this.scale.set(1 + progress * 0.2);

    if (progress >= 1) {
      this.stop();
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.visible = false;
    this.graphics.clear();
  }

  public reset(): void {
    this.stop();
    this.x = 0;
    this.y = 0;
    this.scale.set(1);
    this.alpha = 1;
  }
}
