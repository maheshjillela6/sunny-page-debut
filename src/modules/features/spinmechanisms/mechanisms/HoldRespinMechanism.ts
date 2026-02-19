/**
 * HoldRespinMechanism - Respin loop with counter reset on symbol land
 * Locked symbols persist, empty positions respin, counter resets on new locks
 */

import { SpinMechanismBase } from '../SpinMechanismBase';
import {
  HoldRespinMechanismConfig,
  MechanismStepData,
} from '../SpinMechanismTypes';

export class HoldRespinMechanism extends SpinMechanismBase<HoldRespinMechanismConfig> {
  protected onInitialize(): void {
    this.state.iterationsRemaining = this.config.initialRespins;
    this.state.custom = {
      grandEligible: true,
      holdSymbol: this.config.holdSymbol,
    };
  }

  protected consumeStepData(stepData: MechanismStepData): void {
    // Lock any new hold symbols
    for (const special of stepData.specialSymbols ?? []) {
      if (special.symbolId === this.config.holdSymbol || special.effect === 'lock') {
        this.lockPosition({
          position: special.position,
          value: special.value ?? 0,
          symbol: special.symbolId,
        });
      }
    }

    // Also lock from explicit locked positions
    for (const pos of stepData.lockedPositions ?? []) {
      if (!this.isPositionLocked(pos.row, pos.col)) {
        const pv = (stepData.positionValues ?? []).find(
          v => v.position.row === pos.row && v.position.col === pos.col
        );
        this.lockPosition({
          position: pos,
          value: pv?.value ?? 0,
          symbol: pv?.symbol,
        });
      }
    }
  }

  protected updatePersistentState(stepData: MechanismStepData): void {
    // Sum all locked values
    let totalValue = 0;
    for (const [, pv] of this.state.lockedPositions) {
      totalValue += pv.value;
    }
    this.state.collectedValue = totalValue;

    // Check board fill for grand jackpot
    const gridSize = this.config.gridOverride
      ? this.config.gridOverride.rows * this.config.gridOverride.cols
      : 15;
    if (this.getLockedCount() >= gridSize) {
      this.state.custom.boardFilled = true;
    }
  }

  protected override evaluateStepWin(stepData: MechanismStepData): number {
    // Win is the accumulated locked values (evaluated at completion)
    return 0; // Wins are tallied at completion
  }

  protected override shouldResetIterations(stepData: MechanismStepData): boolean {
    // Reset if any new hold symbols landed
    const newLocks = (stepData.specialSymbols ?? []).filter(
      s => s.symbolId === this.config.holdSymbol || s.effect === 'lock'
    );
    return newLocks.length > 0;
  }

  protected onComplete(): void {
    let finalMultiplier = this.state.multiplier;

    if (this.state.custom.boardFilled) {
      finalMultiplier *= this.config.grandJackpotMultiplier;
    }

    this.state.totalWin = this.state.collectedValue * finalMultiplier;
  }

  public clone(): HoldRespinMechanism {
    return new HoldRespinMechanism({ ...this.config });
  }
}
