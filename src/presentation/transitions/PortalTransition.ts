/**
 * PortalTransition - Portal/wipe transition effect
 */

import { Container, Graphics } from 'pixi.js';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';

export class PortalTransition extends Container {
  private portalGraphics: Graphics;
  private centerX: number;
  private centerY: number;

  constructor() {
    super();
    this.label = 'PortalTransition';

    this.centerX = vw() / 2;
    this.centerY = vh() / 2;

    this.portalGraphics = new Graphics();
    this.addChild(this.portalGraphics);

    this.visible = false;
  }

  public async open(duration: number = 500): Promise<void> {
    this.visible = true;
    this.centerX = vw() / 2;
    this.centerY = vh() / 2;
    const maxRadius = Math.sqrt(
      Math.pow(vw(), 2) + Math.pow(vh(), 2)
    ) / 2;

    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const radius = maxRadius * (1 - eased);

        this.drawMask(radius, maxRadius);

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

  public async close(duration: number = 500): Promise<void> {
    this.visible = true;
    this.centerX = vw() / 2;
    this.centerY = vh() / 2;
    const maxRadius = Math.sqrt(
      Math.pow(vw(), 2) + Math.pow(vh(), 2)
    ) / 2;

    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = Math.pow(progress, 2);
        const radius = maxRadius * (1 - eased);

        this.drawMask(radius, maxRadius);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  private drawMask(holeRadius: number, maxRadius: number): void {
    this.portalGraphics.clear();

    // Draw full screen rect
    this.portalGraphics.rect(0, 0, vw(), vh());
    this.portalGraphics.fill({ color: 0x000000 });

    // Cut out circle
    this.portalGraphics.circle(this.centerX, this.centerY, holeRadius);
    this.portalGraphics.cut();
  }
}
