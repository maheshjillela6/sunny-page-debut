/**
 * GlowFx - Glow effect for symbols
 */

import { Container, Graphics, BlurFilter } from 'pixi.js';

export class GlowFx extends Container {
  private glowGraphics: Graphics;
  private blurFilter: BlurFilter;
  private isPlaying: boolean = false;
  private time: number = 0;
  private color: number = 0xf1c40f;

  constructor() {
    super();
    this.label = 'GlowFx';

    this.glowGraphics = new Graphics();
    this.blurFilter = new BlurFilter({ strength: 10, quality: 2 });
    this.glowGraphics.filters = [this.blurFilter];
    this.addChild(this.glowGraphics);

    this.visible = false;
  }

  public play(x: number, y: number, width: number, height: number, color: number = 0xf1c40f): void {
    this.x = x;
    this.y = y;
    this.color = color;
    this.isPlaying = true;
    this.time = 0;
    this.visible = true;

    this.glowGraphics.clear();
    this.glowGraphics.roundRect(-10, -10, width + 20, height + 20, 12);
    this.glowGraphics.fill({ color, alpha: 0.6 });
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    this.time += deltaTime * 16.67;
    
    // Pulsing glow effect
    const pulse = Math.sin(this.time * 0.008) * 0.3 + 0.7;
    this.alpha = pulse;
    this.blurFilter.strength = 8 + Math.sin(this.time * 0.01) * 4;
  }

  public stop(): void {
    this.isPlaying = false;
    this.visible = false;
    this.glowGraphics.clear();
  }

  public reset(): void {
    this.stop();
    this.x = 0;
    this.y = 0;
    this.alpha = 1;
  }
}
