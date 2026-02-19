/**
 * ZoomTransition - Zoom in/out transition
 */

import { Container, Graphics } from 'pixi.js';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';

export class ZoomTransition extends Container {
  private zoomGraphics: Graphics;

  constructor() {
    super();
    this.label = 'ZoomTransition';

    this.zoomGraphics = new Graphics();
    this.zoomGraphics.rect(0, 0, vw(), vh());
    this.zoomGraphics.fill({ color: 0x000000 });
    this.addChild(this.zoomGraphics);

    this.pivot.set(vw() / 2, vh() / 2);
    this.x = vw() / 2;
    this.y = vh() / 2;

    this.scale.set(0);
    this.visible = false;
  }

  public async zoomIn(duration: number = 400): Promise<void> {
    this.visible = true;
    this.scale.set(0);

    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.scale.set(eased * 1.5);
        this.alpha = eased;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  public async zoomOut(duration: number = 400): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = Math.pow(progress, 2);
        this.scale.set((1 - eased) * 1.5);
        this.alpha = 1 - eased;

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
}
