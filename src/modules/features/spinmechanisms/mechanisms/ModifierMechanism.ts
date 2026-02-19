/**
 * ModifierMechanism - Applies reel/grid modifications per step
 * Each step can change symbol behavior, reel structure, multipliers, or layouts
 */

import { SpinMechanismBase } from '../SpinMechanismBase';
import {
  ModifierMechanismConfig,
  MechanismStepData,
} from '../SpinMechanismTypes';

export class ModifierMechanism extends SpinMechanismBase<ModifierMechanismConfig> {
  protected onInitialize(): void {
    this.state.custom = {
      appliedModifiers: [] as Array<{ step: number; type: string; value: unknown }>,
      activeModifiers: [] as Array<{ type: string; target: string; value: unknown }>,
    };
  }

  protected consumeStepData(stepData: MechanismStepData): void {
    const modifiers = stepData.modifiers ?? [];
    const history = this.state.custom.appliedModifiers as Array<{ step: number; type: string; value: unknown }>;
    const active = this.state.custom.activeModifiers as Array<{ type: string; target: string; value: unknown }>;

    for (const mod of modifiers) {
      history.push({
        step: stepData.stepIndex,
        type: mod.type,
        value: mod.value,
      });

      // Apply modifier effects
      switch (mod.type) {
        case 'addMultiplier':
          this.state.multiplier += (mod.value as number) ?? 1;
          break;
        case 'expandGrid':
          // Record grid expansion
          active.push({ type: mod.type, target: mod.target, value: mod.value });
          break;
        default:
          active.push({ type: mod.type, target: mod.target, value: mod.value });
          break;
      }
    }
  }

  protected updatePersistentState(_stepData: MechanismStepData): void {
    // Modifiers persist in custom state
  }

  protected override checkCompletion(stepData: MechanismStepData): boolean {
    if (this.config.completionCondition.type === 'noModifiers') {
      return (stepData.modifiers ?? []).length === 0 && this.state.iterationsRemaining <= 0;
    }
    return super.checkCompletion(stepData);
  }

  protected onComplete(): void {
    // Clear active modifiers
  }

  public clone(): ModifierMechanism {
    return new ModifierMechanism({ ...this.config });
  }
}
