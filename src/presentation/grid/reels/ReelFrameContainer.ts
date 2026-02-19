/**
 * ReelFrameContainer - Frame decoration for reels
 */

import { Container, Graphics } from 'pixi.js';

export class ReelFrameContainer extends Container {
  private frame: Graphics;

  constructor(width: number, height: number) {
    super();
    this.label = 'ReelFrame';

    this.frame = new Graphics();
    this.drawFrame(width, height);
    this.addChild(this.frame);
  }

  private drawFrame(width: number, height: number): void {
    this.frame.clear();
    
    // Outer frame
    this.frame.roundRect(-5, -5, width + 10, height + 10, 4);
    this.frame.stroke({ color: 0x4a5568, width: 2 });
    
    // Inner highlight
    this.frame.roundRect(0, 0, width, height, 2);
    this.frame.stroke({ color: 0x2d3748, width: 1 });
  }

  public resize(width: number, height: number): void {
    this.drawFrame(width, height);
  }
}
