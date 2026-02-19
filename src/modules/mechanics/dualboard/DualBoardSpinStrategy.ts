/**
 * DualBoardSpinStrategy - Handles two grids spinning simultaneously
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from '../standard/SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';

export enum BoardId {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

export interface DualBoardConfig extends Partial<SpinConfig> {
  boardId: BoardId;
  syncWithOther: boolean;
  offsetY: number;
}

export class DualBoardSpinStrategy extends SpinStrategyBase {
  public readonly id = 'dualboard';
  public readonly direction = SpinDirection.TOP_TO_BOTTOM;
  
  private boardId: BoardId;
  private syncWithOther: boolean;
  private offsetY: number;
  private linkedStrategy: DualBoardSpinStrategy | null = null;

  constructor(config: Partial<DualBoardConfig> = {}) {
    super({ ...config, direction: SpinDirection.TOP_TO_BOTTOM });
    this.boardId = config.boardId ?? BoardId.PRIMARY;
    this.syncWithOther = config.syncWithOther ?? true;
    this.offsetY = config.offsetY ?? 0;
  }

  public linkToBoard(other: DualBoardSpinStrategy): void {
    this.linkedStrategy = other;
    other.linkedStrategy = this;
  }

  public override onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    
    // If synced, notify linked board
    if (this.syncWithOther && this.linkedStrategy && !this.linkedStrategy.isActive) {
      // The linked board should start too - handled externally
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

    const cellHeight = context.cellHeight + context.spacing;
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
    const cellHeight = context.cellHeight + context.spacing;
    
    return {
      x: 0,
      y: symbolIndex * cellHeight + this.offsetY,
      scale: 1,
      alpha: 1,
      rotation: 0,
    };
  }

  public getBoardId(): BoardId {
    return this.boardId;
  }

  public isPrimary(): boolean {
    return this.boardId === BoardId.PRIMARY;
  }

  public isSecondary(): boolean {
    return this.boardId === BoardId.SECONDARY;
  }

  public getLinkedStrategy(): DualBoardSpinStrategy | null {
    return this.linkedStrategy;
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    // Primary board uses normal stagger, secondary is offset
    const baseDelay = reelIndex * this.config.staggerDelay;
    return this.boardId === BoardId.SECONDARY ? baseDelay + 50 : baseDelay;
  }

  public override reset(): void {
    super.reset();
    // Don't clear link on reset
  }

  public clone(): ISpinStrategy {
    const cloned = new DualBoardSpinStrategy({
      ...this.config,
      boardId: this.boardId,
      syncWithOther: this.syncWithOther,
      offsetY: this.offsetY,
    });
    return cloned;
  }
}
