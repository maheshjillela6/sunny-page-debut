/**
 * FadeShuffleStrategy - Symbols fade and shuffle in place
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class FadeShuffleStrategy extends SpinStrategyBase {
  public readonly id = 'fade_shuffle';
  public readonly direction = SpinDirection.FADE_SHUFFLE;
  
  private fadePhase: number = 0;
  private shuffleOffsets: number[] = [];

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.FADE_SHUFFLE });
  }

  public onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    this.fadePhase = 0;
    this.shuffleOffsets = container.children.map(() => (Math.random() - 0.5) * 20);
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    if (this.isStopping) {
      this.decelerate(context.deltaTime);
      if (this.speed <= 0) {
        // Reset to normal
        for (const child of container.children) {
          child.alpha = 1;
          child.x = 0;
        }
        this.isFinished = true;
        this.isActive = false;
        return false;
      }
    } else {
      this.accelerate(context.deltaTime);
    }

    this.fadePhase += this.speed * context.deltaTime * 0.2;

    // Update shuffle offsets periodically
    if (Math.floor(this.fadePhase) % 3 === 0) {
      this.shuffleOffsets = container.children.map(() => (Math.random() - 0.5) * 20);
    }

    let i = 0;
    for (const child of container.children) {
      // Pulsing alpha
      child.alpha = 0.3 + Math.abs(Math.sin(this.fadePhase + i * 0.5)) * 0.7;
      
      // Random horizontal shuffle
      child.x = this.shuffleOffsets[i] * Math.sin(this.fadePhase * 2 + i);
      
      i++;
    }

    return true;
  }

  public calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number } {
    const cellHeight = context.cellHeight + context.spacing;
    const shuffleX = this.shuffleOffsets[symbolIndex] || 0;
    
    return {
      x: shuffleX * Math.sin(this.fadePhase * 2 + symbolIndex),
      y: symbolIndex * cellHeight,
      scale: 1,
      alpha: 0.3 + Math.abs(Math.sin(this.fadePhase + symbolIndex * 0.5)) * 0.7,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    // Random-ish stagger for shuffle effect
    return (reelIndex * 1.3 % totalReels) * this.config.staggerDelay;
  }

  public reset(): void {
    super.reset();
    this.fadePhase = 0;
    this.shuffleOffsets = [];
  }

  public clone(): ISpinStrategy {
    return new FadeShuffleStrategy({ ...this.config });
  }
}
