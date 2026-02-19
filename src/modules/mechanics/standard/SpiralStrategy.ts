/**
 * SpiralStrategy - Symbols spiral in/out with rotation
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from './SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class SpiralStrategy extends SpinStrategyBase {
  public readonly id = 'spiral';
  public readonly direction = SpinDirection.SPIRAL_IN;
  
  private rotationPhase: number = 0;
  private radiusPhase: number = 0;
  private readonly spiralIn: boolean;

  constructor(config: Partial<SpinConfig> = {}, spiralIn: boolean = true) {
    super({ ...config, direction: spiralIn ? SpinDirection.SPIRAL_IN : SpinDirection.SPIRAL_OUT });
    this.spiralIn = spiralIn;
  }

  public onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    this.rotationPhase = 0;
    this.radiusPhase = this.spiralIn ? Math.PI : 0;
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    if (this.isStopping) {
      this.decelerate(context.deltaTime);
      if (this.speed <= 0) {
        // Reset to normal positions
        for (const child of container.children) {
          child.rotation = 0;
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

    this.rotationPhase += this.speed * context.deltaTime * 0.15;
    this.radiusPhase += this.speed * context.deltaTime * 0.05;

    const radius = Math.abs(Math.sin(this.radiusPhase)) * 30;
    
    let i = 0;
    for (const child of container.children) {
      const angle = this.rotationPhase + (i * Math.PI * 2) / container.children.length;
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius * 0.5;
      
      // Store original positions if not set
      const originalY = i * (context.cellHeight + context.spacing);
      
      child.x = offsetX;
      child.y = originalY + offsetY;
      child.rotation = Math.sin(this.rotationPhase + i) * 0.1;
      child.scale.set(0.9 + Math.sin(this.radiusPhase + i) * 0.1);
      
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
    const angle = this.rotationPhase + (symbolIndex * Math.PI * 2) / context.totalRows;
    const radius = Math.abs(Math.sin(this.radiusPhase)) * 30;
    
    return {
      x: Math.cos(angle) * radius,
      y: symbolIndex * cellHeight + Math.sin(angle) * radius * 0.5,
      scale: 0.9 + Math.sin(this.radiusPhase + symbolIndex) * 0.1,
      alpha: 1,
      rotation: Math.sin(this.rotationPhase + symbolIndex) * 0.1,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    // Spiral stagger pattern
    return reelIndex * this.config.staggerDelay * 0.8;
  }

  public reset(): void {
    super.reset();
    this.rotationPhase = 0;
    this.radiusPhase = this.spiralIn ? Math.PI : 0;
  }

  public clone(): ISpinStrategy {
    return new SpiralStrategy({ ...this.config }, this.spiralIn);
  }
}
