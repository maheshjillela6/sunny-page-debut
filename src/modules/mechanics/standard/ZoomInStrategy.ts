/**
 * ZoomInStrategy - Symbols zoom in from center
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class ZoomInStrategy extends SpinStrategyBase {
  public readonly id = 'zoom_in';
  public readonly direction = SpinDirection.ZOOM_IN;
  
  private scalePhase: number = 0;
  private readonly minScale = 0.1;
  private readonly maxScale = 1.0;

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.ZOOM_IN });
  }

  public onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    this.scalePhase = 0;
    
    // Start symbols at center with small scale
    for (const child of container.children) {
      child.scale.set(this.minScale);
      child.alpha = 0;
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

    // Cycle scale phase
    this.scalePhase += this.speed * context.deltaTime * 0.1;
    
    const cycleScale = this.minScale + 
      (Math.sin(this.scalePhase) * 0.5 + 0.5) * (this.maxScale - this.minScale);

    for (const child of container.children) {
      child.scale.set(cycleScale);
      child.alpha = cycleScale;
    }

    return true;
  }

  public calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number } {
    const cellHeight = context.cellHeight + context.spacing;
    const centerY = (context.totalRows * cellHeight) / 2;
    const symbolY = symbolIndex * cellHeight;
    
    // Offset towards center during spin
    const offsetToCenter = (centerY - symbolY) * (1 - this.scalePhase / (Math.PI * 2));
    
    return {
      x: 0,
      y: symbolY + offsetToCenter * 0.3,
      scale: this.minScale + (Math.sin(this.scalePhase) * 0.5 + 0.5) * (this.maxScale - this.minScale),
      alpha: 1,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    // Center-out stagger
    const center = (totalReels - 1) / 2;
    const distanceFromCenter = Math.abs(reelIndex - center);
    return distanceFromCenter * this.config.staggerDelay;
  }

  public reset(): void {
    super.reset();
    this.scalePhase = 0;
  }

  public clone(): ISpinStrategy {
    return new ZoomInStrategy({ ...this.config });
  }
}
