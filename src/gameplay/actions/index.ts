/**
 * ActionManager - Manages round lifecycle actions for win presentation.
 * Provides a structured, interruptible action pipeline.
 */

import { EventBus } from '../../platform/events/EventBus';

export interface RoundContext {
  roundId: string;
  bet: number;
  totalWin: number;
  wins: any[];
  symbols: string[][];
  features: any[];
  data: Record<string, any>;
  turbo: boolean;
  timings: Record<string, number>;
}

export enum ActionPhase {
  IDLE = 'idle',
  RUNNING = 'running',
  INTERRUPTED = 'interrupted',
  COMPLETE = 'complete',
}

export class WinPresentationAction {
  constructor(public readonly context: RoundContext) {}
}

export class BigWinAction {
  constructor(public readonly context: RoundContext) {}
}

export class ActionManager {
  private eventBus: EventBus;
  private phase: ActionPhase = ActionPhase.IDLE;
  private abortController: AbortController | null = null;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Start a round of win presentation actions.
   * Returns a promise that resolves when all actions complete or rejects on error.
   */
  public async startRound(context: RoundContext): Promise<void> {
    // Abort any previous round
    this.stop();

    this.phase = ActionPhase.RUNNING;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const wins = context.wins;
      if (!wins || wins.length === 0) {
        this.phase = ActionPhase.COMPLETE;
        return;
      }

      const lineDelay = context.timings?.lineDisplayMs ?? 1500;

      // Show each win line
      for (let i = 0; i < wins.length; i++) {
        if (signal.aborted) return;

        this.eventBus.emit('game:update', {
          type: 'win:show_line',
          data: { win: wins[i], index: i, total: wins.length },
        });

        await this.delay(lineDelay, signal);
      }

      if (signal.aborted) return;

      // Show total
      this.eventBus.emit('game:update', {
        type: 'win:show_total',
        data: { totalWin: context.totalWin },
      });

      await this.delay(context.timings?.totalDisplayMs ?? 2000, signal);

      if (signal.aborted) return;

      // Clear
      this.eventBus.emit('game:update', {
        type: 'win:clear',
        data: {},
      });

      this.phase = ActionPhase.COMPLETE;
    } catch (err) {
      if (signal.aborted) {
        this.phase = ActionPhase.INTERRUPTED;
        return;
      }
      throw err;
    }
  }

  /** Force stop any running actions */
  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.phase = ActionPhase.IDLE;
  }

  /** Check if actions are currently running */
  public isRunning(): boolean {
    return this.phase === ActionPhase.RUNNING;
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }
}
