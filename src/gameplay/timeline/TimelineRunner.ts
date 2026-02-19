/**
 * TimelineRunner - Executes timeline sequences
 * Enhanced with error boundaries and cancellation support
 */

import { TimelineAction, TimelineState, TimelineConfig, CancellationToken, CancellationTokenImpl } from './TimelineTypes';
import { EventBus } from '../../platform/events/EventBus';

export class TimelineRunner {
  private actions: TimelineAction[] = [];
  private state: TimelineState;
  private config: TimelineConfig;
  private eventBus: EventBus;
  private abortController: AbortController | null = null;
  private cancellationToken: CancellationTokenImpl | null = null; // For action-level cancellation

  constructor(config: Partial<TimelineConfig> = {}) {
    this.eventBus = EventBus.getInstance();
    this.config = {
      loop: config.loop ?? false,
      autoStart: config.autoStart ?? false,
      onComplete: config.onComplete,
      onUpdate: config.onUpdate,
      onError: config.onError,
    };

    this.state = {
      isRunning: false,
      isPaused: false,
      isFailed: false,
      currentActionIndex: 0,
      elapsedTime: 0,
      totalDuration: 0,
    };
  }

  /**
   * Set the actions to run
   */
  public setActions(actions: TimelineAction[]): void {
    this.actions = [...actions];
    this.state.totalDuration = actions.reduce((sum, a) => sum + (a.duration ?? 0), 0);
    
    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start the timeline
   */
  public async start(): Promise<void> {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.isFailed = false;
    this.state.lastError = undefined;
    this.state.currentActionIndex = 0;
    this.state.elapsedTime = 0;
    this.abortController = new AbortController();
    this.cancellationToken = new CancellationTokenImpl();

    await this.run();
  }

  /**
   * Run the timeline
   */
  private async run(): Promise<void> {
    try {
      do {
        for (let i = this.state.currentActionIndex; i < this.actions.length; i++) {
          if (!this.state.isRunning) return;
          
          while (this.state.isPaused) {
            await this.sleep(16);
            if (!this.state.isRunning) return;
          }

          this.state.currentActionIndex = i;
          const action = this.actions[i];
          
          // Pass cancellation token to actions
          try {
            await action.execute(this.cancellationToken ?? undefined);
          } catch (actionError) {
            // Action-level error boundary
            console.error(`[TimelineRunner] Action ${action.id} failed:`, actionError);
            this.state.isFailed = true;
            this.state.lastError = actionError as Error;
            this.config.onError?.(actionError as Error);
            throw actionError; // Propagate to outer try-catch
          }

          // Deterministic elapsed time: never derive duration from wall-clock
          this.state.elapsedTime += action.duration ?? 0;
          this.config.onUpdate?.(this.getProgress());
        }

        if (this.config.loop) {
          this.state.currentActionIndex = 0;
          this.state.elapsedTime = 0;
        }
      } while (this.config.loop && this.state.isRunning && !this.state.isFailed);

      if (!this.state.isFailed) {
        this.complete();
      }
    } catch (error) {
      // Timeline-level error boundary
      if ((error as Error).name !== 'AbortError') {
        console.error('[TimelineRunner] Fatal error during execution:', error);
        this.state.isFailed = true;
        this.state.lastError = error as Error;
        this.config.onError?.(error as Error);
      }

      // Fail closed: timeline must not remain "running" after an error
      this.state.isRunning = false;
      this.state.isPaused = false;

      // Don't swallow errors - let caller handle
      throw error;
    }
  }

  /**
   * Pause the timeline
   */
  public pause(): void {
    if (!this.state.isRunning) return;
    this.state.isPaused = true;
  }

  /**
   * Resume the timeline
   */
  public resume(): void {
    if (!this.state.isRunning) return;
    this.state.isPaused = false;
  }

  /**
   * Stop the timeline
   */
  public stop(): void {
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.abortController?.abort();
    this.cancellationToken?.cancel(); // Cancel all running actions
  }

  /**
   * Reset the timeline
   */
  public reset(): void {
    this.stop();
    this.state.currentActionIndex = 0;
    this.state.elapsedTime = 0;
  }

  /**
   * Skip to a specific action
   */
  public skipTo(actionIndex: number): void {
    if (actionIndex >= 0 && actionIndex < this.actions.length) {
      this.state.currentActionIndex = actionIndex;
    }
  }

  /**
   * Get current progress (0-1)
   */
  public getProgress(): number {
    if (this.state.totalDuration === 0) return 0;
    return Math.min(this.state.elapsedTime / this.state.totalDuration, 1);
  }

  /**
   * Get current state
   */
  public getState(): TimelineState {
    return { ...this.state };
  }

  /**
   * Check if running
   */
  public isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Check if paused
   */
  public isPaused(): boolean {
    return this.state.isPaused;
  }

  private complete(): void {
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.config.onComplete?.();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a runner and start it
   */
  public static async run(actions: TimelineAction[]): Promise<void> {
    const runner = new TimelineRunner();
    runner.setActions(actions);
    await runner.start();
  }
}
