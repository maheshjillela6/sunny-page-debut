/**
 * SlideTransition - Slide transition effect
 */

import { Container, Graphics } from 'pixi.js';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';

export class SlideTransition extends Container {
  private slideGraphics: Graphics;

  constructor() {
    super();
    this.label = 'SlideTransition';

    this.slideGraphics = new Graphics();
    this.slideGraphics.rect(0, 0, vw(), vh());
    this.slideGraphics.fill({ color: 0x000000 });
    this.addChild(this.slideGraphics);

    this.visible = false;
  }

  public async slideIn(direction: SlideDirection = 'left', duration: number = 400): Promise<void> {
    this.visible = true;
    
    const startPos = this.getStartPosition(direction);
    this.x = startPos.x;
    this.y = startPos.y;

    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        this.x = startPos.x * (1 - eased);
        this.y = startPos.y * (1 - eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  public async slideOut(direction: SlideDirection = 'right', duration: number = 400): Promise<void> {
    const endPos = this.getStartPosition(direction);

    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = Math.pow(progress, 2);
        
        this.x = endPos.x * eased;
        this.y = endPos.y * eased;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.visible = false;
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  private getStartPosition(direction: SlideDirection): { x: number; y: number } {
    switch (direction) {
      case 'left':
        return { x: -vw(), y: 0 };
      case 'right':
        return { x: vw(), y: 0 };
      case 'up':
        return { x: 0, y: -vh() };
      case 'down':
        return { x: 0, y: vh() };
    }
  }
}

export type SlideDirection = 'left' | 'right' | 'up' | 'down';
