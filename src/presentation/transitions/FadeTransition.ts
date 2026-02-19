/**
 * FadeTransition - Simple fade transition
 */

import { Container, Graphics } from 'pixi.js';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';

export class FadeTransition extends Container {
  private fadeGraphics: Graphics;

  constructor(color: number = 0x000000) {
    super();
    this.label = 'FadeTransition';

    this.fadeGraphics = new Graphics();
    this.fadeGraphics.rect(0, 0, vw(), vh());
    this.fadeGraphics.fill({ color });
    this.addChild(this.fadeGraphics);

    this.alpha = 0;
  }

  public async fadeIn(duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        this.alpha = progress;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  public async fadeOut(duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        this.alpha = 1 - progress;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  public setColor(color: number): void {
    this.fadeGraphics.clear();
    this.fadeGraphics.rect(0, 0, vw(), vh());
    this.fadeGraphics.fill({ color });
  }
}
