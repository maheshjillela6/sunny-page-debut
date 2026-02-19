/**
 * SymbolOverlayContainer - Overlay effects for symbols
 */

import { Container, Graphics } from 'pixi.js';

export class SymbolOverlayContainer extends Container {
  private overlay: Graphics;
  private size: number;

  constructor(size: number = 120) {
    super();
    this.label = 'SymbolOverlay';
    this.size = size;

    this.overlay = new Graphics();
    this.addChild(this.overlay);

    this.visible = false;
  }

  public showGlow(color: number = 0xf1c40f): void {
    this.overlay.clear();
    this.overlay.roundRect(-10, -10, this.size + 20, this.size + 20, 16);
    this.overlay.fill({ color, alpha: 0.3 });
    this.visible = true;
  }

  public showFrame(color: number = 0xf1c40f, width: number = 4): void {
    this.overlay.clear();
    this.overlay.roundRect(-width/2, -width/2, this.size + width, this.size + width, 12);
    this.overlay.stroke({ color, width });
    this.visible = true;
  }

  public hide(): void {
    this.overlay.clear();
    this.visible = false;
  }

  public setAlpha(alpha: number): void {
    this.overlay.alpha = alpha;
  }
}
