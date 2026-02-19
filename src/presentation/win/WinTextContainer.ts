/**
 * WinTextContainer - Container for win amount text display
 */

import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';

export class WinTextContainer extends Container {
  private background: Graphics;
  private winText: Text;
  private labelText: Text;
  private isAnimating: boolean = false;
  private time: number = 0;
  private targetValue: number = 0;
  private currentValue: number = 0;
  private duration: number = 1000;

  constructor() {
    super();
    this.label = 'WinText';

    // Background
    this.background = new Graphics();
    this.background.roundRect(-150, -50, 300, 100, 16);
    this.background.fill({ color: 0x000000, alpha: 0.8 });
    this.background.stroke({ color: 0xf1c40f, width: 3 });
    this.addChild(this.background);

    // Label
    const labelStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 20,
      fill: 0xffffff,
    });

    this.labelText = new Text({ text: 'WIN', style: labelStyle });
    this.labelText.anchor.set(0.5);
    this.labelText.y = -20;
    this.addChild(this.labelText);

    // Win amount
    const winStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 36,
      fontWeight: 'bold',
      fill: 0xf1c40f,
    });

    this.winText = new Text({ text: '$0.00', style: winStyle });
    this.winText.anchor.set(0.5);
    this.winText.y = 15;
    this.addChild(this.winText);

    // Position at center — dynamic
    this.x = vw() / 2;
    this.y = vh() / 2 - 100;

    this.visible = false;
  }

  public show(targetValue: number, duration: number = 1000): void {
    this.targetValue = targetValue;
    this.currentValue = 0;
    this.duration = duration;
    this.time = 0;
    this.isAnimating = true;
    this.visible = true;
    this.scale.set(0);

    // Re-center for current virtual dims
    this.x = vw() / 2;
    this.y = vh() / 2 - 100;
  }

  public update(deltaTime: number): void {
    if (!this.isAnimating) return;

    this.time += deltaTime * 16.67;
    const progress = Math.min(this.time / this.duration, 1);

    // Scale in animation
    if (progress < 0.2) {
      const scaleProgress = progress / 0.2;
      this.scale.set(scaleProgress * 1.1);
    } else if (progress < 0.3) {
      const scaleProgress = (progress - 0.2) / 0.1;
      this.scale.set(1.1 - scaleProgress * 0.1);
    } else {
      this.scale.set(1);
    }

    // Count up animation
    this.currentValue = this.targetValue * progress;
    this.winText.text = `$${this.currentValue.toFixed(2)}`;

    // Pulsing effect
    const pulse = Math.sin(this.time * 0.02) * 0.05 + 1;
    this.winText.scale.set(pulse);

    if (progress >= 1) {
      this.currentValue = this.targetValue;
      this.winText.text = `$${this.targetValue.toFixed(2)}`;
    }
  }

  public hide(): void {
    this.isAnimating = false;
    this.visible = false;
  }

  public isShowing(): boolean {
    return this.visible;
  }
}
