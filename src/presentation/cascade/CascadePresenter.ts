/**
 * CascadePresenter - Config-driven cascade/avalanche presentation controller.
 *
 * Reads CascadeConfig to determine all visual behavior. Zero hardcoded
 * animation logic — every visual decision is resolved from config.
 *
 * Lifecycle:
 *   1. Receive CascadeSequence (data) + ResolvedCascadeConfig (visuals)
 *   2. For each CascadeStep:
 *      a. Win presentation phase
 *      b. Removal phase
 *      c. Collapse phase
 *      d. Refill phase
 *   3. Emit events at each phase boundary
 */

import { EventBus } from '../../platform/events/EventBus';
import type { CascadeSequence, CascadeStep, CascadePosition } from './CascadeDataTypes';
import type { ResolvedCascadeConfig } from './CascadeConfigResolver';
import type {
  WinPresentationPhaseConfig,
  RemovalPhaseConfig,
  CollapsePhaseConfig,
  RefillPhaseConfig,
  CascadePhaseTimingConfig,
  CascadeAnimationConfig,
  ElementOrdering,
  PhaseOrdering,
} from './CascadeConfigTypes';

// ── Phase identifiers ──────────────────────────────────────────────────────

export type CascadePhase = 'idle' | 'winPresentation' | 'removal' | 'collapse' | 'refill' | 'interStepDelay' | 'complete';

// ── Phase handler interface ────────────────────────────────────────────────

/**
 * External systems (GridManager, SymbolAnimator, etc.) implement this
 * to receive phase instructions from the presenter.
 */
export interface ICascadePhaseHandler {
  /** Present winning symbols visually */
  onWinPresentation(
    step: CascadeStep,
    config: WinPresentationPhaseConfig,
  ): Promise<void>;

  /** Remove winning symbols from grid */
  onRemoval(
    step: CascadeStep,
    config: RemovalPhaseConfig,
  ): Promise<void>;

  /** Collapse remaining symbols to fill gaps */
  onCollapse(
    step: CascadeStep,
    config: CollapsePhaseConfig,
  ): Promise<void>;

  /** Refill grid with new symbols */
  onRefill(
    step: CascadeStep,
    config: RefillPhaseConfig,
  ): Promise<void>;
}

// ── Presenter ──────────────────────────────────────────────────────────────

export class CascadePresenter {
  private eventBus: EventBus;
  private handler: ICascadePhaseHandler | null = null;
  private currentPhase: CascadePhase = 'idle';
  private isRunning = false;
  private isCancelled = false;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  /** Register the visual handler that executes phase animations */
  public setHandler(handler: ICascadePhaseHandler): void {
    this.handler = handler;
  }

  /** Get current phase */
  public getPhase(): CascadePhase {
    return this.currentPhase;
  }

  /** Whether a cascade sequence is currently running */
  public isActive(): boolean {
    return this.isRunning;
  }

  /** Cancel the running cascade (skips to end) */
  public cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Execute a full cascade sequence driven entirely by config.
   */
  public async execute(
    sequence: CascadeSequence,
    config: ResolvedCascadeConfig,
  ): Promise<void> {
    if (!this.handler) {
      console.warn('[CascadePresenter] No phase handler registered');
      return;
    }

    this.isRunning = true;
    this.isCancelled = false;

    this.eventBus.emit('game:cascade:start' as any, {
      totalSteps: sequence.totalSteps,
      totalWin: sequence.totalWin,
    });

    const maxDepth = config.timing.maxCascadeDepth ?? Infinity;

    for (let i = 0; i < sequence.steps.length && i < maxDepth; i++) {
      if (this.isCancelled) break;

      const step = sequence.steps[i];

      this.eventBus.emit('game:cascade:step:start' as any, {
        stepIndex: step.stepIndex,
        wins: step.wins,
        multiplier: step.multiplier,
      });

      await this.executeStep(step, config);

      this.eventBus.emit('game:cascade:step:complete' as any, {
        stepIndex: step.stepIndex,
        cumulativeWin: step.cumulativeWin,
        multiplier: step.multiplier,
      });

      // Inter-step delay
      if (config.timing.interStepDelayMs && i < sequence.steps.length - 1) {
        this.currentPhase = 'interStepDelay';
        await this.delay(config.timing.interStepDelayMs);
      }
    }

    this.currentPhase = 'complete';
    this.isRunning = false;

    this.eventBus.emit('game:cascade:complete', {
      cascadeCount: sequence.totalSteps,
    });
  }

  /**
   * Execute a single cascade step through all phases.
   */
  private async executeStep(
    step: CascadeStep,
    config: ResolvedCascadeConfig,
  ): Promise<void> {
    const { timing } = config;

    if (timing.phaseOrdering === 'parallel') {
      // All phases run simultaneously
      await Promise.all([
        this.runWinPresentation(step, config),
        this.runRemoval(step, config),
        this.runCollapse(step, config),
        this.runRefill(step, config),
      ]);
    } else if (timing.phaseOrdering === 'overlapped') {
      // Phases start with offset overlap
      const offset = timing.overlapOffsetMs ?? 0;
      const promises: Promise<void>[] = [];

      promises.push(this.runWinPresentation(step, config));
      await this.delay(offset);

      promises.push(this.runRemoval(step, config));
      await this.delay(offset);

      promises.push(this.runCollapse(step, config));
      await this.delay(offset);

      promises.push(this.runRefill(step, config));

      await Promise.all(promises);
    } else {
      // Sequential (default)
      await this.runWinPresentation(step, config);
      if (this.isCancelled) return;

      await this.runRemoval(step, config);
      if (this.isCancelled) return;

      await this.runCollapse(step, config);
      if (this.isCancelled) return;

      await this.runRefill(step, config);
    }
  }

  private async runWinPresentation(step: CascadeStep, config: ResolvedCascadeConfig): Promise<void> {
    if (step.wins.length === 0 || config.winPresentation.style === 'none') return;
    this.currentPhase = 'winPresentation';
    this.eventBus.emit('game:cascade:phase' as any, { phase: 'winPresentation', stepIndex: step.stepIndex });
    await this.handler!.onWinPresentation(step, config.winPresentation);
  }

  private async runRemoval(step: CascadeStep, config: ResolvedCascadeConfig): Promise<void> {
    if (step.removedPositions.length === 0) return;
    this.currentPhase = 'removal';
    this.eventBus.emit('game:cascade:phase' as any, { phase: 'removal', stepIndex: step.stepIndex });
    await this.handler!.onRemoval(step, config.removal);
  }

  private async runCollapse(step: CascadeStep, config: ResolvedCascadeConfig): Promise<void> {
    if (step.movements.length === 0) return;
    this.currentPhase = 'collapse';
    this.eventBus.emit('game:cascade:phase' as any, { phase: 'collapse', stepIndex: step.stepIndex });
    await this.handler!.onCollapse(step, config.collapse);
  }

  private async runRefill(step: CascadeStep, config: ResolvedCascadeConfig): Promise<void> {
    if (step.refills.length === 0) return;
    this.currentPhase = 'refill';
    this.eventBus.emit('game:cascade:phase' as any, { phase: 'refill', stepIndex: step.stepIndex });
    await this.handler!.onRefill(step, config.refill);
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0 || this.isCancelled) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public destroy(): void {
    this.handler = null;
    this.isCancelled = true;
    this.isRunning = false;
  }
}
