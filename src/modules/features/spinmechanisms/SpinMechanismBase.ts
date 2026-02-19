/**
 * SpinMechanismBase - Abstract base class for all spin-flow mechanisms
 * 
 * Manages the mechanism loop lifecycle: init → step → evaluate → persist → complete
 * All behavior is driven from MechanismConfig - no hardcoded logic.
 */

import { EventBus } from '@/platform/events/EventBus';
import {
  MechanismConfig,
  MechanismStepData,
  MechanismPersistentState,
  MechanismStepResult,
  MechanismResult,
  PositionValue,
  SpinMechanismId,
} from './SpinMechanismTypes';

export abstract class SpinMechanismBase<TConfig extends MechanismConfig = MechanismConfig> {
  public readonly id: SpinMechanismId;

  protected config: TConfig;
  protected state: MechanismPersistentState;
  protected eventBus: EventBus;
  protected stepResults: MechanismStepResult[] = [];

  constructor(config: TConfig) {
    this.id = config.id;
    this.config = config;
    this.eventBus = EventBus.getInstance();
    this.state = this.createInitialState();
  }

  // ============ Lifecycle ============

  /** Initialize mechanism with optional mode/speed overrides */
  public initialize(mode?: string, speedVariant?: string): void {
    this.state = this.createInitialState();
    this.stepResults = [];

    // Apply mode overrides
    if (mode && this.config.modeOverrides?.[mode]) {
      this.config = { ...this.config, ...this.config.modeOverrides[mode] } as TConfig;
    }

    // Apply speed variant
    if (speedVariant && this.config.speedVariants?.[speedVariant]) {
      this.config = { ...this.config, ...this.config.speedVariants[speedVariant] } as TConfig;
    }

    this.onInitialize();

    this.eventBus.emit('mechanism:start', {
      mechanismId: this.id,
      config: { ...this.config } as unknown as Record<string, unknown>,
    });
  }

  /** Process a single step */
  public processStep(stepData: MechanismStepData): MechanismStepResult {
    this.state.currentStep = stepData.stepIndex;

    this.eventBus.emit('mechanism:step:start', {
      mechanismId: this.id,
      stepIndex: stepData.stepIndex,
    });

    // 1. Consume step data (mechanism-specific)
    this.consumeStepData(stepData);

    // 2. Update persistent state
    this.updatePersistentState(stepData);

    // 3. Evaluate step wins
    const stepWin = this.evaluateStepWin(stepData);
    this.state.totalWin += stepWin;

    // 4. Check reset condition
    if (this.shouldResetIterations(stepData)) {
      this.state.iterationsRemaining = this.config.resetCondition.resetTo;
    } else {
      this.state.iterationsRemaining--;
    }

    // 5. Update multiplier
    this.updateMultiplier(stepData);

    // 6. Check completion
    const isComplete = this.checkCompletion(stepData);

    const result: MechanismStepResult = {
      stepIndex: stepData.stepIndex,
      wins: stepData.wins,
      stepWin,
      cumulativeWin: this.state.totalWin,
      stateSnapshot: this.getStateSnapshot(),
      isComplete,
      nextAction: isComplete ? 'complete' : this.shouldExtend(stepData) ? 'extend' : 'continue',
    };

    this.stepResults.push(result);

    this.eventBus.emit('mechanism:step:complete', {
      mechanismId: this.id,
      stepIndex: stepData.stepIndex,
      stepWin,
      cumulativeWin: this.state.totalWin,
      isComplete,
    });

    if (isComplete) {
      this.complete();
    }

    return result;
  }

  /** Complete the mechanism and return final result */
  public complete(): MechanismResult {
    this.state.isActive = false;
    this.onComplete();

    const result: MechanismResult = {
      mechanismId: this.id,
      totalWin: this.state.totalWin,
      totalSteps: this.state.currentStep + 1,
      stepResults: [...this.stepResults],
      finalState: { ...this.state },
    };

    this.eventBus.emit('mechanism:complete', {
      mechanismId: this.id,
      totalWin: this.state.totalWin,
      totalSteps: result.totalSteps,
    });

    return result;
  }

  /** Force-cancel the mechanism */
  public cancel(): void {
    this.state.isActive = false;
    this.eventBus.emit('mechanism:cancel', { mechanismId: this.id });
  }

  // ============ State Management ============

  public getState(): MechanismPersistentState {
    return { ...this.state, lockedPositions: new Map(this.state.lockedPositions) };
  }

  public isActive(): boolean {
    return this.state.isActive;
  }

  public getConfig(): TConfig {
    return { ...this.config };
  }

  // ============ Protected Helpers ============

  protected createInitialState(): MechanismPersistentState {
    return {
      mechanismId: this.id,
      isActive: true,
      currentStep: 0,
      totalSteps: this.config.maxIterations,
      iterationsRemaining: this.config.initialIterations,
      totalWin: 0,
      lockedPositions: new Map(),
      collectedValue: 0,
      multiplier: this.config.baseMultiplier,
      activePositions: [],
      custom: {},
    };
  }

  protected lockPosition(pos: PositionValue): void {
    const key = `${pos.position.row},${pos.position.col}`;
    this.state.lockedPositions.set(key, pos);
  }

  protected isPositionLocked(row: number, col: number): boolean {
    return this.state.lockedPositions.has(`${row},${col}`);
  }

  protected getLockedCount(): number {
    return this.state.lockedPositions.size;
  }

  protected getStateSnapshot(): Partial<MechanismPersistentState> {
    return {
      currentStep: this.state.currentStep,
      iterationsRemaining: this.state.iterationsRemaining,
      totalWin: this.state.totalWin,
      collectedValue: this.state.collectedValue,
      multiplier: this.state.multiplier,
      custom: { ...this.state.custom },
    };
  }

  // ============ Default Implementations ============

  protected shouldResetIterations(stepData: MechanismStepData): boolean {
    const cond = this.config.resetCondition;
    switch (cond.type) {
      case 'symbolLand':
        return (stepData.specialSymbols ?? []).some(s => s.symbolId === cond.symbol);
      case 'winOccurs':
        return stepData.totalStepWin > 0;
      case 'never':
        return false;
      default:
        return false;
    }
  }

  protected checkCompletion(stepData: MechanismStepData): boolean {
    const cond = this.config.completionCondition;
    switch (cond.type) {
      case 'iterationsExhausted':
        return this.state.iterationsRemaining <= 0;
      case 'boardFilled': {
        const gridSize = this.config.gridOverride
          ? this.config.gridOverride.rows * this.config.gridOverride.cols
          : 15; // default 3x5
        const threshold = cond.fillThreshold ?? 1.0;
        return this.getLockedCount() >= gridSize * threshold;
      }
      case 'fixedCount':
        return this.state.currentStep >= (cond.count ?? this.config.maxIterations) - 1;
      case 'noNewLocks':
        return this.state.iterationsRemaining <= 0;
      case 'collectionComplete':
        return this.state.collectedValue >= (cond.targetValue ?? Infinity);
      case 'noModifiers':
        return (stepData.modifiers ?? []).length === 0 && this.state.iterationsRemaining <= 0;
      default:
        return this.state.iterationsRemaining <= 0;
    }
  }

  protected shouldExtend(_stepData: MechanismStepData): boolean {
    return false;
  }

  protected updateMultiplier(_stepData: MechanismStepData): void {
    const prog = this.config.multiplierProgression;
    if (!prog) return;

    switch (prog.type) {
      case 'perStep':
        this.state.multiplier = Math.min(
          this.state.multiplier + prog.increment,
          prog.max
        );
        break;
      case 'perWin':
        if (_stepData.totalStepWin > 0) {
          this.state.multiplier = Math.min(
            this.state.multiplier + prog.increment,
            prog.max
          );
        }
        break;
      case 'perLock':
        if ((_stepData.specialSymbols ?? []).length > 0) {
          this.state.multiplier = Math.min(
            this.state.multiplier + prog.increment * (_stepData.specialSymbols?.length ?? 0),
            prog.max
          );
        }
        break;
    }
  }

  protected evaluateStepWin(stepData: MechanismStepData): number {
    return stepData.totalStepWin * this.state.multiplier;
  }

  // ============ Abstract Methods ============

  /** Mechanism-specific initialization */
  protected abstract onInitialize(): void;

  /** Consume step data and apply mechanism-specific logic */
  protected abstract consumeStepData(stepData: MechanismStepData): void;

  /** Update persistent state from step data */
  protected abstract updatePersistentState(stepData: MechanismStepData): void;

  /** Mechanism-specific completion logic */
  protected abstract onComplete(): void;

  /** Create a clone of this mechanism */
  public abstract clone(): SpinMechanismBase<TConfig>;
}
