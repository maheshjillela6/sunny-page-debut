/**
 * ZoomOutStrategy - Symbols zoom out from large to normal
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class ZoomOutStrategy extends SpinStrategyBase {
  public readonly id = 'zoom_out';
  public readonly direction = SpinDirection.ZOOM_OUT;
  
  private scalePhase: number = 0;
  private readonly minScale = 1.0;
  private readonly maxScale = 2.0;

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.ZOOM_OUT });
  }

  public onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    this.scalePhase = 0;
    
    // Start symbols large
    for (const child of container.children) {
      child.scale.set(this.maxScale);
      child.alpha = 0.5;
    }
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    if (this.isStopping) {
      this.decelerate(context.deltaTime);
      if (this.speed <= 0) {
        // Final settle - scale to 1
        for (const child of container.children) {
          child.scale.set(1);
          child.alpha = 1;
        }
        this.isFinished = true;
        this.isActive = false;
        return false;
      }
    } else {
      this.accelerate(context.deltaTime);
    }

    // Cycle scale phase (reverse of zoom in)
    this.scalePhase += this.speed * context.deltaTime * 0.1;
    
    const cycleScale = this.maxScale - 
      (Math.sin(this.scalePhase) * 0.5 + 0.5) * (this.maxScale - this.minScale);

    for (const child of container.children) {
      child.scale.set(cycleScale);
      child.alpha = 2 - cycleScale; // Fade in as it shrinks
    }

    return true;
  }

  public calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number } {
    const cellHeight = context.cellHeight + context.spacing;
    
    return {
      x: 0,
      y: symbolIndex * cellHeight,
      scale: this.maxScale - (Math.sin(this.scalePhase) * 0.5 + 0.5) * (this.maxScale - this.minScale),
      alpha: 1,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    // Edge-in stagger (opposite of center-out)
    const center = (totalReels - 1) / 2;
    const distanceFromEdge = center - Math.abs(reelIndex - center);
    return distanceFromEdge * this.config.staggerDelay;
  }

  public reset(): void {
    super.reset();
    this.scalePhase = 0;
  }

  public clone(): ISpinStrategy {
    return new ZoomOutStrategy({ ...this.config });
  }
}
