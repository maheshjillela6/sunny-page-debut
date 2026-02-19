/**
 * RightToLeftStrategy - Horizontal spin (symbols move left)
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class RightToLeftStrategy extends SpinStrategyBase {
  public readonly id = 'right_to_left';
  public readonly direction = SpinDirection.RIGHT_TO_LEFT;

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.RIGHT_TO_LEFT });
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

    const cellWidth = context.cellWidth + context.spacing;
    const movement = this.speed * context.deltaTime;
    this.spinDistance += movement;

    // Move all children left (negative X)
    for (const child of container.children) {
      child.x -= movement;
    }

    return true;
  }

  public calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number } {
    const cellWidth = context.cellWidth + context.spacing;
    const baseX = symbolIndex * cellWidth;
    
    return {
      x: baseX,
      y: 0,
      scale: 1,
      alpha: 1,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    // Reverse stagger for right-to-left
    return (totalReels - 1 - reelIndex) * this.config.staggerDelay;
  }

  public clone(): ISpinStrategy {
    return new RightToLeftStrategy({ ...this.config });
  }
}
