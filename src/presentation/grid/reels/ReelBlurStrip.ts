/**
 * ReelBlurStrip - Motion blur effect for spinning reels
 */

import { Container, Graphics, BlurFilter } from 'pixi.js';

export class ReelBlurStrip extends Container {
  private blurGraphics: Graphics;
  private blurFilter: BlurFilter;
  private isActive: boolean = false;

  constructor(width: number, height: number, color: number = 0x333333) {
    super();
    this.label = 'ReelBlurStrip';

    this.blurGraphics = new Graphics();
    this.blurGraphics.rect(0, 0, width, height);
    this.blurGraphics.fill({ color, alpha: 0.5 });
    this.addChild(this.blurGraphics);

    this.blurFilter = new BlurFilter({ strength: 0, quality: 2 });
    this.blurGraphics.filters = [this.blurFilter];

    this.visible = false;
  }

  public show(blurStrength: number = 10): void {
    this.isActive = true;
    this.visible = true;
    this.blurFilter.strength = blurStrength;
  }

  public hide(): void {
    this.isActive = false;
    this.visible = false;
  }

  public setBlurStrength(strength: number): void {
    this.blurFilter.strength = strength;
  }

  public update(speed: number): void {
    if (!this.isActive) return;
    
    // Adjust blur based on speed
    const normalizedSpeed = Math.min(speed / 40, 1);
    this.blurFilter.strengthY = normalizedSpeed * 15;
    this.alpha = normalizedSpeed * 0.7;
  }
}
