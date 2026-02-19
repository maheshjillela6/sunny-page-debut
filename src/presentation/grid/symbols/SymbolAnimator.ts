/**
 * SymbolAnimator - Handles symbol animations
 */

import { SymbolView } from './SymbolView';

export enum SymbolAnimationType {
  IDLE = 'idle',
  WIN = 'win',
  LAND = 'land',
  ANTICIPATE = 'anticipate',
}

export class SymbolAnimator {
  private symbol: SymbolView;
  private currentAnimation: SymbolAnimationType = SymbolAnimationType.IDLE;
  private animationTime: number = 0;
  private isAnimating: boolean = false;

  constructor(symbol: SymbolView) {
    this.symbol = symbol;
  }

  public playWin(duration: number = 1000): void {
    this.currentAnimation = SymbolAnimationType.WIN;
    this.animationTime = 0;
    this.isAnimating = true;
    this.symbol.highlight();
  }

  public playLand(): void {
    this.currentAnimation = SymbolAnimationType.LAND;
    this.animationTime = 0;
    this.isAnimating = true;
  }

  public playAnticipate(): void {
    this.currentAnimation = SymbolAnimationType.ANTICIPATE;
    this.animationTime = 0;
    this.isAnimating = true;
  }

  public stop(): void {
    this.currentAnimation = SymbolAnimationType.IDLE;
    this.isAnimating = false;
    this.symbol.unhighlight();
    this.symbol.scale.set(1);
  }

  public update(deltaTime: number): void {
    if (!this.isAnimating) return;

    this.animationTime += deltaTime * 16.67;

    switch (this.currentAnimation) {
      case SymbolAnimationType.WIN:
        this.updateWin();
        break;
      case SymbolAnimationType.LAND:
        this.updateLand();
        break;
      case SymbolAnimationType.ANTICIPATE:
        this.updateAnticipate();
        break;
    }
  }

  private updateWin(): void {
    const pulse = Math.sin(this.animationTime * 0.01) * 0.05 + 1;
    this.symbol.scale.set(pulse);
  }

  private updateLand(): void {
    const progress = Math.min(this.animationTime / 200, 1);
    const bounce = 1 + Math.sin(progress * Math.PI) * 0.1;
    this.symbol.scale.set(bounce);

    if (progress >= 1) {
      this.stop();
    }
  }

  private updateAnticipate(): void {
    const shake = Math.sin(this.animationTime * 0.05) * 2;
    this.symbol.x = shake;
  }

  public isPlaying(): boolean {
    return this.isAnimating;
  }

  public getCurrentAnimation(): SymbolAnimationType {
    return this.currentAnimation;
  }
}
