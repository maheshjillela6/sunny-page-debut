/**
 * TransformationMechanism - Replaces/upgrades symbols between iterations
 * Uses upgrade paths to evolve symbols based on conditions
 */

import { SpinMechanismBase } from '../SpinMechanismBase';
import {
  TransformationMechanismConfig,
  MechanismStepData,
} from '../SpinMechanismTypes';

export class TransformationMechanism extends SpinMechanismBase<TransformationMechanismConfig> {
  protected onInitialize(): void {
    this.state.custom = {
      transformHistory: [] as Array<{ step: number; from: string; to: string; position: { row: number; col: number } }>,
      permanentTransforms: new Map<string, string>(), // "row,col" -> transformed symbol
    };
  }

  protected consumeStepData(stepData: MechanismStepData): void {
    const transforms = stepData.transformations ?? [];
    const history = this.state.custom.transformHistory as Array<{ step: number; from: string; to: string; position: { row: number; col: number } }>;

    for (const transform of transforms) {
      history.push({
        step: stepData.stepIndex,
        from: transform.from.symbol,
        to: transform.to.symbol,
        position: transform.from.position,
      });

      if (this.config.permanentTransforms) {
        const key = `${transform.from.position.row},${transform.from.position.col}`;
        (this.state.custom.permanentTransforms as Map<string, string>).set(key, transform.to.symbol);
      }
    }

    // Also apply upgrade paths from config based on step data
    for (const path of this.config.upgradePaths) {
      if (path.condition === 'stepBased') {
        // Auto-apply step-based upgrades
        for (let r = 0; r < stepData.matrix.length; r++) {
          for (let c = 0; c < stepData.matrix[r].length; c++) {
            if (stepData.matrix[r][c] === path.from) {
              history.push({
                step: stepData.stepIndex,
                from: path.from,
                to: path.to,
                position: { row: r, col: c },
              });
            }
          }
        }
      }
    }
  }

  protected updatePersistentState(_stepData: MechanismStepData): void {
    // Transform history and permanent transforms are the persistent state
  }

  protected onComplete(): void {
    // Final win already accumulated
  }

  public clone(): TransformationMechanism {
    return new TransformationMechanism({ ...this.config });
  }
}
