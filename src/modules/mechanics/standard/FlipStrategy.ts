/**
 * FlipStrategy - Symbols flip horizontally or vertically
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class FlipStrategy extends SpinStrategyBase {
  public readonly id: string;
  public readonly direction: SpinDirection;
  
  private flipPhase: number = 0;
  private readonly isHorizontal: boolean;

  constructor(config: Partial<SpinConfig> = {}, horizontal: boolean = true) {
    const direction = horizontal ? SpinDirection.FLIP_HORIZONTAL : SpinDirection.FLIP_VERTICAL;
    super({ ...config, direction });
    this.isHorizontal = horizontal;
    this.id = horizontal ? 'flip_horizontal' : 'flip_vertical';
    this.direction = direction;
  }

  public onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    this.flipPhase = 0;
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    if (this.isStopping) {
      this.decelerate(context.deltaTime);
      if (this.speed <= 0) {
        // Reset to normal
        for (const child of container.children) {
          child.scale.set(1, 1);
        }
        this.isFinished = true;
        this.isActive = false;
        return false;
      }
    } else {
      this.accelerate(context.deltaTime);
    }

    this.flipPhase += this.speed * context.deltaTime * 0.3;

    let i = 0;
    for (const child of container.children) {
      const flipValue = Math.cos(this.flipPhase + i * 0.3);
      
      if (this.isHorizontal) {
        child.scale.x = Math.abs(flipValue) * 0.5 + 0.5;
      } else {
        child.scale.y = Math.abs(flipValue) * 0.5 + 0.5;
      }
      
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
    const flipValue = Math.cos(this.flipPhase + symbolIndex * 0.3);
    
    return {
      x: 0,
      y: symbolIndex * cellHeight,
      scale: Math.abs(flipValue) * 0.5 + 0.5,
      alpha: 1,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    return reelIndex * this.config.staggerDelay;
  }

  public reset(): void {
    super.reset();
    this.flipPhase = 0;
  }

  public clone(): ISpinStrategy {
    return new FlipStrategy({ ...this.config }, this.isHorizontal);
  }
}
