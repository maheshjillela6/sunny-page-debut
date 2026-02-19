/**
 * WinCounter - Animated win counter display
 */

import { Container, Text, TextStyle } from 'pixi.js';

export class WinCounter extends Container {
  private counterText: Text;
  private targetValue: number = 0;
  private currentValue: number = 0;
  private startValue: number = 0;
  private isAnimating: boolean = false;
  private time: number = 0;
  private duration: number = 1000;

  constructor() {
    super();
    this.label = 'WinCounter';

    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 48,
      fontWeight: 'bold',
      fill: 0xf1c40f,
      stroke: { color: 0x000000, width: 4 },
    });

    this.counterText = new Text({ text: '$0.00', style });
    this.counterText.anchor.set(0.5);
    this.addChild(this.counterText);
  }

  public countTo(target: number, duration: number = 1000): void {
    this.startValue = this.currentValue;
    this.targetValue = target;
    this.duration = duration;
    this.time = 0;
    this.isAnimating = true;
    this.visible = true;
  }

  public update(deltaTime: number): void {
    if (!this.isAnimating) return;

    this.time += deltaTime * 16.67;
    const progress = Math.min(this.time / this.duration, 1);

    // Ease out
    const eased = 1 - Math.pow(1 - progress, 3);
    this.currentValue = this.startValue + (this.targetValue - this.startValue) * eased;

    this.counterText.text = `$${this.currentValue.toFixed(2)}`;

    // Scale effect
    const scaleEffect = 1 + Math.sin(progress * Math.PI) * 0.1;
    this.scale.set(scaleEffect);

    if (progress >= 1) {
      this.currentValue = this.targetValue;
      this.counterText.text = `$${this.targetValue.toFixed(2)}`;
      this.isAnimating = false;
      this.scale.set(1);
    }
  }

  public setValue(value: number): void {
    this.currentValue = value;
    this.targetValue = value;
    this.counterText.text = `$${value.toFixed(2)}`;
  }

  public getValue(): number {
    return this.currentValue;
  }

  public isPlaying(): boolean {
    return this.isAnimating;
  }

  public reset(): void {
    this.currentValue = 0;
    this.targetValue = 0;
    this.counterText.text = '$0.00';
    this.isAnimating = false;
    this.scale.set(1);
  }
}
