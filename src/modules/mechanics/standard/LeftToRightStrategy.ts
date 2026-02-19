/**
 * LeftToRightStrategy - Horizontal spin (symbols move right)
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class LeftToRightStrategy extends SpinStrategyBase {
  public readonly id = 'left_to_right';
  public readonly direction = SpinDirection.LEFT_TO_RIGHT;

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.LEFT_TO_RIGHT });
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

    // Move all children right (positive X)
    for (const child of container.children) {
      child.x += movement;
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
    // Row-based stagger for horizontal
    return reelIndex * this.config.staggerDelay;
  }

  public clone(): ISpinStrategy {
    return new LeftToRightStrategy({ ...this.config });
  }
}
