/**
 * InfinitySpinStrategy - Infinite reels that continue spinning
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from '../standard/SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export class InfinitySpinStrategy extends SpinStrategyBase {
  public readonly id = 'infinity';
  public readonly direction = SpinDirection.TOP_TO_BOTTOM;
  
  private activeReels: Set<number> = new Set();
  private infiniteMode: boolean = true;
  private respinCount: number = 0;
  private maxRespins: number = 100;

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.TOP_TO_BOTTOM });
  }

  public override onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    this.activeReels.add(context.reelIndex);
    this.respinCount = 0;
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    // In infinity mode, keep spinning until explicitly stopped
    if (this.infiniteMode && !this.isStopping) {
      this.accelerate(context.deltaTime);
      
      const cellHeight = context.cellHeight + context.spacing;
      const movement = this.speed * context.deltaTime;
      this.spinDistance += movement;

      for (const child of container.children) {
        child.y += movement;
      }

      return true;
    }

    if (this.isStopping) {
      this.decelerate(context.deltaTime);
      
      const cellHeight = context.cellHeight + context.spacing;
      const movement = this.speed * context.deltaTime;
      
      for (const child of container.children) {
        child.y += movement;
      }

      if (this.speed <= 0) {
        this.isFinished = true;
        this.isActive = false;
        return false;
      }
    }

    return true;
  }

  /**
   * Trigger a respin for specific reel
   */
  public triggerRespin(reelIndex: number): void {
    if (this.respinCount >= this.maxRespins) {
      console.warn('[InfinitySpinStrategy] Max respins reached');
      return;
    }
    
    this.activeReels.add(reelIndex);
    this.respinCount++;
    this.isStopping = false;
    this.isActive = true;
    this.isFinished = false;
  }

  /**
   * Stop a specific reel
   */
  public stopReel(reelIndex: number): void {
    this.activeReels.delete(reelIndex);
    
    if (this.activeReels.size === 0) {
      this.isStopping = true;
    }
  }

  public isReelActive(reelIndex: number): boolean {
    return this.activeReels.has(reelIndex);
  }

  public getActiveReelCount(): number {
    return this.activeReels.size;
  }

  public getRespinCount(): number {
    return this.respinCount;
  }

  public setInfiniteMode(enabled: boolean): void {
    this.infiniteMode = enabled;
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
      scale: 1,
      alpha: 1,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    return reelIndex * this.config.staggerDelay;
  }

  public override reset(): void {
    super.reset();
    this.activeReels.clear();
    this.respinCount = 0;
    this.infiniteMode = true;
  }

  public clone(): ISpinStrategy {
    return new InfinitySpinStrategy({ ...this.config });
  }
}
