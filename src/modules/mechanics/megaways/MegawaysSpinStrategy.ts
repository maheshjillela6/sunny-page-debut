/**
 * MegawaysSpinStrategy - Dynamic reel heights with variable ways
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from '../standard/SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';
import { MegawaysMapper } from './MegawaysMapper';

export class MegawaysSpinStrategy extends SpinStrategyBase {
  public readonly id = 'megaways';
  public readonly direction = SpinDirection.TOP_TO_BOTTOM;
  
  private megawaysMapper: MegawaysMapper;
  private reelHeights: number[] = [];
  private maxReelHeight: number = 7;
  private minReelHeight: number = 2;

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.TOP_TO_BOTTOM });
    this.megawaysMapper = new MegawaysMapper();
  }

  public override onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    
    // Randomize reel heights for this spin
    this.reelHeights = [];
    for (let i = 0; i < context.totalReels; i++) {
      const height = this.minReelHeight + Math.floor(Math.random() * (this.maxReelHeight - this.minReelHeight + 1));
      this.reelHeights.push(height);
    }
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

    // Dynamic cell height based on reel height
    const baseHeight = context.cellHeight;
    const movement = this.speed * context.deltaTime;
    this.spinDistance += movement;

    for (const child of container.children) {
      child.y += movement;
    }

    return true;
  }

  public calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number } {
    const reelIndex = context.reelIndex;
    const reelHeight = this.reelHeights[reelIndex] ?? context.totalRows;
    
    // Adjust cell height based on reel height
    const dynamicCellHeight = (context.cellHeight * context.totalRows) / reelHeight;
    const baseY = symbolIndex * (dynamicCellHeight + context.spacing);
    
    return {
      x: 0,
      y: baseY,
      scale: 1,
      alpha: 1,
      rotation: 0,
    };
  }

  public getReelHeights(): number[] {
    return [...this.reelHeights];
  }

  public setReelHeights(heights: number[]): void {
    this.reelHeights = [...heights];
  }

  public getTotalWays(): number {
    return this.megawaysMapper.calculateWays(this.reelHeights);
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    return reelIndex * this.config.staggerDelay;
  }

  public clone(): ISpinStrategy {
    const cloned = new MegawaysSpinStrategy({ ...this.config });
    cloned.setReelHeights(this.reelHeights);
    return cloned;
  }
}
