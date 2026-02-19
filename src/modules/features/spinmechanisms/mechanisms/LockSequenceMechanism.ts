/**
 * LockSequenceMechanism - Progressive reel/position locking
 * Trigger symbols lock reels or positions; unlocked areas keep spinning
 */

import { SpinMechanismBase } from '../SpinMechanismBase';
import {
  LockSequenceMechanismConfig,
  MechanismStepData,
} from '../SpinMechanismTypes';

export class LockSequenceMechanism extends SpinMechanismBase<LockSequenceMechanismConfig> {
  protected onInitialize(): void {
    this.state.custom = {
      lockedReels: [] as number[],
      lockMode: this.config.lockMode,
    };
  }

  protected consumeStepData(stepData: MechanismStepData): void {
    const triggers = (stepData.specialSymbols ?? []).filter(
      s => s.symbolId === this.config.triggerSymbol
    );

    for (const trigger of triggers) {
      if (this.config.lockMode === 'reel') {
        const reels = this.state.custom.lockedReels as number[];
        if (!reels.includes(trigger.position.col)) {
          reels.push(trigger.position.col);
          // Lock all positions in this reel
          const rows = this.config.gridOverride?.rows ?? 3;
          for (let r = 0; r < rows; r++) {
            const sym = stepData.matrix[r]?.[trigger.position.col] ?? '';
            this.lockPosition({
              position: { row: r, col: trigger.position.col },
              value: 0,
              symbol: sym,
            });
          }
        }
      } else {
        this.lockPosition({
          position: trigger.position,
          value: trigger.value ?? 0,
          symbol: trigger.symbolId,
        });
      }
    }
  }

  protected updatePersistentState(stepData: MechanismStepData): void {
    // Update active (unlocked) positions
    const rows = this.config.gridOverride?.rows ?? 3;
    const cols = this.config.gridOverride?.cols ?? 5;
    this.state.activePositions = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!this.isPositionLocked(r, c)) {
          this.state.activePositions.push({ row: r, col: c });
        }
      }
    }
  }

  protected override checkCompletion(stepData: MechanismStepData): boolean {
    // Complete when no new locks occurred and iterations exhausted,
    // or all positions are locked
    const noNewTriggers = (stepData.specialSymbols ?? []).filter(
      s => s.symbolId === this.config.triggerSymbol
    ).length === 0;

    if (this.config.completionCondition.type === 'noNewLocks') {
      return noNewTriggers && this.state.iterationsRemaining <= 0;
    }

    return super.checkCompletion(stepData);
  }

  protected onComplete(): void {
    // Final win is sum of all step wins
  }

  public clone(): LockSequenceMechanism {
    return new LockSequenceMechanism({ ...this.config });
  }
}
