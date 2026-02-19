/**
 * MultiSpinMechanism - Predefined number of spins with evolving rules
 * Symbol persistence, multipliers, and reel configs can change per spin
 */

import { SpinMechanismBase } from '../SpinMechanismBase';
import {
  MultiSpinMechanismConfig,
  MechanismStepData,
} from '../SpinMechanismTypes';

export class MultiSpinMechanism extends SpinMechanismBase<MultiSpinMechanismConfig> {
  protected onInitialize(): void {
    this.state.totalSteps = this.config.spinCount;
    this.state.iterationsRemaining = this.config.spinCount;
    this.state.custom = {
      currentSpinIndex: 0,
      persistentSymbols: [] as Array<{ row: number; col: number; symbol: string }>,
    };
  }

  protected consumeStepData(stepData: MechanismStepData): void {
    const spinIndex = this.state.custom.currentSpinIndex as number;
    const rules = this.config.perSpinRules?.[spinIndex];

    if (rules?.symbolPersistence) {
      // Persist specified symbols from current grid
      const persistent = this.state.custom.persistentSymbols as Array<{ row: number; col: number; symbol: string }>;
      for (let r = 0; r < stepData.matrix.length; r++) {
        for (let c = 0; c < stepData.matrix[r].length; c++) {
          if (rules.symbolPersistence.includes(stepData.matrix[r][c])) {
            if (!persistent.some(p => p.row === r && p.col === c)) {
              persistent.push({ row: r, col: c, symbol: stepData.matrix[r][c] });
            }
          }
        }
      }
    }

    if (rules?.multiplierOverride !== undefined) {
      this.state.multiplier = rules.multiplierOverride;
    }
  }

  protected updatePersistentState(_stepData: MechanismStepData): void {
    (this.state.custom.currentSpinIndex as number)++;
  }

  protected onComplete(): void {
    // Total win already accumulated per step
  }

  public clone(): MultiSpinMechanism {
    return new MultiSpinMechanism({ ...this.config });
  }
}
