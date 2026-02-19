/**
 * CollectionMechanism - Accumulates values from landing symbols
 * Values persist across iterations; consumed by collector symbol or at end
 */

import { SpinMechanismBase } from '../SpinMechanismBase';
import {
  CollectionMechanismConfig,
  MechanismStepData,
} from '../SpinMechanismTypes';

export class CollectionMechanism extends SpinMechanismBase<CollectionMechanismConfig> {
  protected onInitialize(): void {
    this.state.collectedValue = 0;
    this.state.custom = {
      collectorLanded: false,
      collectSymbol: this.config.collectSymbol,
    };
  }

  protected consumeStepData(stepData: MechanismStepData): void {
    // Accumulate values from collect symbols
    for (const special of stepData.specialSymbols ?? []) {
      if (special.symbolId === this.config.collectSymbol) {
        this.state.collectedValue += special.value ?? 0;
      }

      // Check for collector symbol
      if (this.config.collectorSymbol && special.symbolId === this.config.collectorSymbol) {
        this.state.custom.collectorLanded = true;
      }
    }

    // Also accumulate from position values tagged as collection
    for (const pv of stepData.positionValues ?? []) {
      if (pv.symbol === this.config.collectSymbol) {
        this.state.collectedValue += pv.value;
      }
    }
  }

  protected updatePersistentState(_stepData: MechanismStepData): void {
    // Collection value is the persistent state - already updated in consumeStepData
  }

  protected override checkCompletion(stepData: MechanismStepData): boolean {
    // Complete if collector landed
    if (this.state.custom.collectorLanded) return true;

    // Complete if threshold reached
    if (this.config.consumeThreshold && this.state.collectedValue >= this.config.consumeThreshold) {
      return true;
    }

    return super.checkCompletion(stepData);
  }

  protected onComplete(): void {
    // Award collected value if auto-consume or collector landed
    if (this.config.autoConsumeOnEnd || this.state.custom.collectorLanded) {
      this.state.totalWin += this.state.collectedValue * this.state.multiplier;
    }
  }

  public clone(): CollectionMechanism {
    return new CollectionMechanism({ ...this.config });
  }
}
