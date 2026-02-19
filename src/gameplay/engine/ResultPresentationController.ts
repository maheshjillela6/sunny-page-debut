/**
 * ResultPresentationController
 *
 * Owns the entire result-presentation timeline. The EventBus carries only
 * factual milestone events — no subscriber may start, stop, or sequence
 * timelines. Configuration decides when win presentation is allowed.
 *
 * Architectural guarantees:
 *   • Single deterministic timeline per spin (built once, run once)
 *   • Big-win single-execution guard per spinId + resultFlowId
 *   • Feature safety — waits for FEATURE_COMPLETED when trigger requires it
 *   • All visual sequencing runs through TimelineRunner
 */

import { EventBus } from '../../platform/events/EventBus';
import { EventEnvelope } from '../../platform/events/EventEnvelope';
import { TimelineRunner } from '../timeline/TimelineRunner';
import { SequenceBuilder } from '../timeline/SequenceBuilder';
import { StepSequencePresenter, mapStepWinsToWinData } from './StepSequencePresenter';
import { Logger } from '../../platform/logger/Logger';
import type { SpinStep, CascadeStep, ResultStep } from '../../platform/networking/APIProtocol';
import type {
  WinTierResolvedPayload,
  StepPresentedPayload,
  SequenceCompletedPayload,
  ResultDataFinalizedPayload,
} from '../../platform/events/EventMap';

// ── Configuration ────────────────────────────────────────────────────

/** When the win presentation is allowed to start */
export type WinPresentationTrigger =
  | 'RESULT'              // After the first RESULT step
  | 'SEQUENCE_END'        // After all steps (cascade included) finish
  | 'FEATURE_END'         // After FEATURE_COMPLETED is received
  | 'RESULT_DATA_FINALIZED'; // After everything is done (most conservative)

export interface ResultPresentationConfig {
  /** When to show the win presentation */
  winPresentationTrigger: WinPresentationTrigger;
  /** Duration of total-win count-up (ms) */
  countUpDurationMs: number;
  /** Delay after win presentation before going idle (ms) */
  postWinDelayMs: number;
}

const DEFAULT_CONFIG: ResultPresentationConfig = {
  winPresentationTrigger: 'SEQUENCE_END',
  countUpDurationMs: 1000,
  postWinDelayMs: 500,
};

// ── Win tier helpers ─────────────────────────────────────────────────

export type WinTier = 'none' | 'normal' | 'big' | 'mega' | 'epic';

function resolveWinTier(totalWin: number, totalBet: number): WinTier {
  if (totalWin <= 0) return 'none';
  const mult = totalWin / totalBet;
  if (mult >= 50) return 'epic';
  if (mult >= 20) return 'mega';
  if (mult >= 10) return 'big';
  return 'normal';
}

// ── Controller ───────────────────────────────────────────────────────

export class ResultPresentationController {
  private eventBus: EventBus;
  private logger = Logger.create('ResultPresCtrl');
  private config: ResultPresentationConfig;
  private stepPresenter: StepSequencePresenter;
  private runner: TimelineRunner | null = null;

  // ── Flow-scoped guards ───────────────────────────────────────────
  private activeSpinId: string = '';
  private activeResultFlowId: string = '';
  private winPresentationPlayed: boolean = false;
  private flowIdCounter: number = 0;

  // ── Deferred triggers ────────────────────────────────────────────
  /** Promise that resolves when the configured trigger event fires */
  private triggerResolver: (() => void) | null = null;
  private featureActive: boolean = false;

  // ── Event subscription ids (for cleanup) ─────────────────────────
  private subIds: string[] = [];

  constructor(config?: Partial<ResultPresentationConfig>) {
    this.eventBus = EventBus.getInstance();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stepPresenter = new StepSequencePresenter();

    this.logger.info(`Initialized — trigger: ${this.config.winPresentationTrigger}`);
    this.setupListeners();
  }

  // ── Event listeners (facts only) ─────────────────────────────────

  private setupListeners(): void {
    // Feature lifecycle
    this.subIds.push(
      this.eventBus.on('feature:start', (_p, env) => {
        if (!this.isActiveFlow(env)) return;
        this.featureActive = true;
        this.logger.debug(`Feature started (flow: ${this.activeResultFlowId})`);
      }),
    );

    this.subIds.push(
      this.eventBus.on('feature:end', (_p, env) => {
        if (!this.isActiveFlow(env)) return;
        this.featureActive = false;
        this.logger.debug(`Feature completed (flow: ${this.activeResultFlowId})`);

        // If trigger policy requires feature completion, unlock now
        if (this.config.winPresentationTrigger === 'FEATURE_END') {
          this.resolveTrigger();
        }
      }),
    );
  }

  // ── Flow filtering ───────────────────────────────────────────────

  /**
   * Check whether an envelope belongs to the currently active flow.
   * Uses envelope payload fields (spinId/roundId/resultFlowId) when present;
   * otherwise accepts it (backwards compat with events that don't carry ids).
   */
  private isActiveFlow(_envelope: EventEnvelope): boolean {
    // Envelope payload may contain spinId or roundId — if so, compare
    const payload = _envelope.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload === 'object') {
      if ('resultFlowId' in payload && payload.resultFlowId !== this.activeResultFlowId) {
        return false;
      }
      if ('spinId' in payload && payload.spinId !== this.activeSpinId) {
        return false;
      }
      if ('roundId' in payload && payload.roundId !== this.activeSpinId) {
        return false;
      }
    }
    return true;
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Called when SPIN_RESULT_RECEIVED — builds and runs the full timeline.
   * This is the ONLY entry point for result presentation.
   */
  public async handleSpinResult(
    spinId: string,
    steps: SpinStep[],
    totalWin: number,
    totalBet: number,
    finalMatrixString: string,
  ): Promise<void> {
    // ── Create new flow ────────────────────────────────────────────
    this.activeSpinId = spinId;
    this.activeResultFlowId = `rpf_${++this.flowIdCounter}_${Date.now()}`;
    this.winPresentationPlayed = false;
    this.featureActive = false;
    this.triggerResolver = null;

    this.logger.info(
      `▶ New flow: ${this.activeResultFlowId} | spin: ${spinId} | ` +
      `trigger: ${this.config.winPresentationTrigger} | steps: ${steps.length}`,
    );

    // Cancel any previous runner
    if (this.runner) {
      this.runner.stop();
      this.runner = null;
    }

    // ── Build timeline ─────────────────────────────────────────────
    const flowId = this.activeResultFlowId;
    const flowSpinId = this.activeSpinId;

    const builder = SequenceBuilder.create(`result_flow_${flowId}`);

    // Phase 1: Step sequence presentation
    builder.call(async () => {
      await this.stepPresenter.execute(steps, totalWin, totalBet);

      // Emit per-step facts (retroactively — step presenter ran synchronously)
      let cumulativeWin = 0;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.type === 'CASCADE') {
          cumulativeWin = (step as CascadeStep).cumulativeWin.amount;
        } else if (step.type === 'RESULT') {
          cumulativeWin = (step as ResultStep).totalWin.amount;
        }
        this.emitStepPresented(flowId, flowSpinId, i, step.type, cumulativeWin);
      }
    });

    // Phase 2: Emit SEQUENCE_COMPLETED fact
    builder.call(() => {
      const seqPayload: SequenceCompletedPayload = {
        resultFlowId: flowId,
        spinId: flowSpinId,
        totalSteps: steps.length,
        cumulativeWin: totalWin,
      };
      this.eventBus.emit('result:sequence:completed', seqPayload);
      this.logger.debug(`SEQUENCE_COMPLETED (flow: ${flowId})`);

      // If trigger is SEQUENCE_END, unlock win presentation
      if (this.config.winPresentationTrigger === 'SEQUENCE_END') {
        this.resolveTrigger();
      }
    });

    // Phase 3: Wait for configured trigger (if not already resolved)
    builder.call(async () => {
      await this.waitForTrigger();
    });

    // Phase 4: Win presentation (blocking)
    builder.call(async () => {
      await this.runWinPresentation(flowId, flowSpinId, totalWin, totalBet);
    });

    // Phase 5: Total win count-up
    builder.call(async () => {
      if (totalWin > 0) {
        this.eventBus.emit('wallet:win:counter:start', {
          targetValue: totalWin,
          duration: this.config.countUpDurationMs,
        });
        await this.delay(this.config.countUpDurationMs + this.config.postWinDelayMs);
      }
    });

    // Phase 6: Emit RESULT_PRESENTATION_COMPLETED
    builder.call(() => {
      this.eventBus.emit('result:presentation:completed', {
        resultFlowId: flowId,
        spinId: flowSpinId,
        totalWin,
      });

      // Also emit RESULT_DATA_FINALIZED if trigger relies on it
      if (this.config.winPresentationTrigger === 'RESULT_DATA_FINALIZED') {
        this.emitResultDataFinalized(flowId, flowSpinId, totalWin);
      }

      this.logger.info(`✅ RESULT_PRESENTATION_COMPLETED (flow: ${flowId})`);
    });

    // ── Run timeline ───────────────────────────────────────────────
    this.runner = new TimelineRunner();
    const actions = builder.build();
    this.runner.setActions(actions);

    try {
      await this.runner.start();
    } catch (err) {
      if ((err as Error).message !== 'Operation was cancelled') {
        this.logger.error(`Timeline error: ${(err as Error).message}`);
      }
    } finally {
      this.runner = null;
    }
  }

  // ── Win presentation ─────────────────────────────────────────────

  private async runWinPresentation(
    flowId: string,
    spinId: string,
    totalWin: number,
    totalBet: number,
  ): Promise<void> {
    const tier = resolveWinTier(totalWin, totalBet);

    // Emit WIN_TIER_RESOLVED fact
    const tierPayload: WinTierResolvedPayload = {
      resultFlowId: flowId,
      spinId,
      tier,
      totalWin,
      totalBet,
      multiplier: totalBet > 0 ? totalWin / totalBet : 0,
    };
    this.eventBus.emit('result:win:tier:resolved', tierPayload);
    this.logger.info(
      `WIN_TIER_RESOLVED: ${tier} (${tierPayload.multiplier.toFixed(1)}x) ` +
      `flow: ${flowId} | spin: ${spinId}`,
    );

    if (tier === 'none') return;

    // ── Big-win single-execution guard ─────────────────────────────
    if (this.winPresentationPlayed) {
      this.logger.info(
        `⛔ Win presentation IGNORED by guard — already played ` +
        `(flow: ${flowId} | spin: ${spinId})`,
      );
      return;
    }
    if (flowId !== this.activeResultFlowId || spinId !== this.activeSpinId) {
      this.logger.info(
        `⛔ Win presentation IGNORED — stale flow ` +
        `(expected: ${this.activeResultFlowId}, got: ${flowId})`,
      );
      return;
    }

    this.winPresentationPlayed = true;

    // Emit WIN_PRESENTATION_STARTED
    this.eventBus.emit('result:win:presentation:started', {
      resultFlowId: flowId,
      spinId,
      tier,
    });
    this.logger.info(`▶ Win presentation STARTED: ${tier} (spin: ${spinId})`);

    // Emit the game:win event for visual systems to react to
    this.eventBus.emit('game:win', {
      amount: totalWin,
      multiplier: totalBet > 0 ? totalWin / totalBet : 0,
      winType: tier as 'normal' | 'big' | 'mega' | 'epic',
    });

    // For big/mega/epic show dedicated big-win screen
    if (tier !== 'normal') {
      this.eventBus.emit('game:bigwin:show', {
        amount: totalWin,
        type: tier as 'big' | 'mega' | 'epic',
      });
      // Wait for big-win animation
      await this.delay(tier === 'epic' ? 5000 : tier === 'mega' ? 4000 : 3000);
    } else {
      await this.delay(1500);
    }

    // Emit WIN_PRESENTATION_COMPLETED
    this.eventBus.emit('result:win:presentation:completed', {
      resultFlowId: flowId,
      spinId,
      tier,
      totalWin,
    });
    this.logger.info(`✅ Win presentation COMPLETED: ${tier} (spin: ${spinId})`);
  }

  // ── Trigger management ───────────────────────────────────────────

  /**
   * Wait until the configured trigger condition is met.
   * For RESULT trigger, it resolves immediately (step presenter already ran).
   */
  private waitForTrigger(): Promise<void> {
    const trigger = this.config.winPresentationTrigger;

    // RESULT and SEQUENCE_END are resolved inline during timeline execution
    if (trigger === 'RESULT' || trigger === 'SEQUENCE_END') {
      return Promise.resolve();
    }

    // FEATURE_END or RESULT_DATA_FINALIZED: must wait for external event
    if (trigger === 'FEATURE_END' && !this.featureActive) {
      // No feature was triggered — resolve immediately
      return Promise.resolve();
    }

    this.logger.debug(`Waiting for trigger: ${trigger}`);
    return new Promise<void>(resolve => {
      this.triggerResolver = resolve;
    });
  }

  private resolveTrigger(): void {
    if (this.triggerResolver) {
      this.triggerResolver();
      this.triggerResolver = null;
    }
  }

  // ── Fact emission helpers ────────────────────────────────────────

  private emitStepPresented(
    flowId: string,
    spinId: string,
    stepIndex: number,
    stepType: 'RESULT' | 'CASCADE',
    cumulativeWin: number,
  ): void {
    const payload: StepPresentedPayload = {
      resultFlowId: flowId,
      spinId,
      stepIndex,
      stepType,
      cumulativeWin,
    };
    this.eventBus.emit('result:step:presented', payload);
  }

  private emitResultDataFinalized(
    flowId: string,
    spinId: string,
    finalTotalWin: number,
  ): void {
    const payload: ResultDataFinalizedPayload = {
      resultFlowId: flowId,
      spinId,
      finalTotalWin,
      featureCompleted: !this.featureActive,
    };
    this.eventBus.emit('result:data:finalized', payload);
  }

  // ── Interruption ─────────────────────────────────────────────────

  public cancel(): void {
    this.stepPresenter.cancel();
    this.runner?.stop();
    this.resolveTrigger();
    this.logger.info(`Cancelled flow: ${this.activeResultFlowId}`);
  }

  public isActive(): boolean {
    return this.runner?.isRunning() ?? false;
  }

  // ── Configuration ────────────────────────────────────────────────

  public setConfig(config: Partial<ResultPresentationConfig>): void {
    Object.assign(this.config, config);
    this.logger.info(`Config updated — trigger: ${this.config.winPresentationTrigger}`);
  }

  public getConfig(): ResultPresentationConfig {
    return { ...this.config };
  }

  // ── Utils ────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  public destroy(): void {
    this.cancel();
    for (const id of this.subIds) {
      this.eventBus.off(id);
    }
    this.subIds = [];
    this.stepPresenter.destroy();
  }
}
