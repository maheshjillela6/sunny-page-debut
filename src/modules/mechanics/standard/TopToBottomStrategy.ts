/**
 * TopToBottomStrategy - Standard vertical spin (symbols fall down) with buttery smooth animations
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class TopToBottomStrategy extends SpinStrategyBase {
  public readonly id = 'top_to_bottom';
  public readonly direction = SpinDirection.TOP_TO_BOTTOM;

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.TOP_TO_BOTTOM });
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    // Handle speed changes with smooth easing
    if (this.isStopping) {
      this.decelerate(context.deltaTime);
    } else {
      this.accelerate(context.deltaTime);
    }

    // Check if stopped
    if (this.speed <= 0 && this.isStopping) {
      this.isFinished = true;
      this.isActive = false;
      return false;
    }

    // Calculate smooth movement using fixed timestep normalization
    // This ensures consistent speed regardless of frame rate
    const targetFps = 60;
    const normalizedDelta = context.deltaTime * targetFps;
    
    // Apply velocity with frame-rate independence
    const movement = this.speed * normalizedDelta;
    this.spinDistance += movement;

    // Apply movement with sub-pixel precision
    this.applyMovement(container, movement);

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
      y: Math.round(baseY * 10) / 10, // Round to 1 decimal for smooth sub-pixel
      scale: 1,
      alpha: 1,
      rotation: 0,
    };
  }

  public clone(): ISpinStrategy {
    return new TopToBottomStrategy({ ...this.config });
  }
}
