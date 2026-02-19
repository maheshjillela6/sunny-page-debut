/**
 * BottomToTopStrategy - Reverse vertical spin (symbols rise up)
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class BottomToTopStrategy extends SpinStrategyBase {
  public readonly id = 'bottom_to_top';
  public readonly direction = SpinDirection.BOTTOM_TO_TOP;

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.BOTTOM_TO_TOP });
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    if (this.isStopping) {
      this.decelerate(context.deltaTime);
      if (this.speed <= 0) {
        this.isFinished = true;
        this.isActive = false;
        return false;
      }
    } else {
      this.accelerate(context.deltaTime);
    }

    const cellHeight = context.cellHeight + context.spacing;
    const movement = this.speed * context.deltaTime;
    this.spinDistance += movement;

    // Move all children up (negative Y)
    for (const child of container.children) {
      child.y -= movement;
    }

    return true;
  }

  public calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number } {
    const cellHeight = context.cellHeight + context.spacing;
    const baseY = symbolIndex * cellHeight;
    
    return {
      x: 0,
      y: baseY,
      scale: 1,
      alpha: 1,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    // Reverse stagger - last reel starts first
    return (totalReels - 1 - reelIndex) * this.config.staggerDelay;
  }

  public clone(): ISpinStrategy {
    return new BottomToTopStrategy({ ...this.config });
  }
}
