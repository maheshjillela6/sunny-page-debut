/**
 * PixiApplicationManager - High-level application orchestration
 * Coordinates initialization of all Pixi subsystems.
 */

import { PixiRuntime, PixiRuntimeConfig } from './PixiRuntime';
import { PixiTicker } from './PixiTicker';
import { PixiClock } from './PixiClock';

export interface ApplicationManagerConfig extends PixiRuntimeConfig {
  enableDebug?: boolean;
  targetFPS?: number;
}

export enum ApplicationState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  RUNNING = 'running',
  PAUSED = 'paused',
  DESTROYED = 'destroyed',
}

/**
 * High-level manager coordinating all Pixi subsystems.
 */
export class PixiApplicationManager {
  private static instance: PixiApplicationManager | null = null;

  private runtime: PixiRuntime | null = null;
  private ticker: PixiTicker | null = null;
  private clock: PixiClock | null = null;
  private state: ApplicationState = ApplicationState.UNINITIALIZED;
  private config: ApplicationManagerConfig | null = null;

  private constructor() {}

  /** Get singleton instance */
  public static getInstance(): PixiApplicationManager {
    if (!PixiApplicationManager.instance) {
      PixiApplicationManager.instance = new PixiApplicationManager();
    }
    return PixiApplicationManager.instance;
  }

  /** Initialize all subsystems */
  public async initialize(config: ApplicationManagerConfig): Promise<void> {
    if (this.state !== ApplicationState.UNINITIALIZED) {
      console.warn('[PixiApplicationManager] Already initialized');
      return;
    }

    this.state = ApplicationState.INITIALIZING;
    this.config = config;

    try {
      // Initialize runtime
      this.runtime = PixiRuntime.getInstance();
      await this.runtime.initialize(config);

      // Setup ticker
      const app = this.runtime.getApp();
      this.ticker = new PixiTicker(app.ticker);
      this.runtime.setTicker(this.ticker);

      // Setup clock
      this.clock = new PixiClock();
      this.clock.start();
      this.runtime.setClock(this.clock);

      // Add clock update to ticker
      this.ticker.add('clock', () => {
        this.clock?.update();
      });

      // Set target FPS if specified
      if (config.targetFPS) {
        app.ticker.maxFPS = config.targetFPS;
      }

      this.state = ApplicationState.READY;
      console.log('[PixiApplicationManager] Initialized successfully');
    } catch (error) {
      this.state = ApplicationState.UNINITIALIZED;
      throw error;
    }
  }

  /** Start the application */
  public start(): void {
    if (this.state !== ApplicationState.READY && this.state !== ApplicationState.PAUSED) {
      console.warn('[PixiApplicationManager] Cannot start in current state:', this.state);
      return;
    }

    this.runtime?.resume();
    this.ticker?.resume();
    this.clock?.start();
    this.state = ApplicationState.RUNNING;
  }

  /** Pause the application */
  public pause(): void {
    if (this.state !== ApplicationState.RUNNING) return;

    this.runtime?.pause();
    this.ticker?.pause();
    this.clock?.pause();
    this.state = ApplicationState.PAUSED;
  }

  /** Resume the application */
  public resume(): void {
    if (this.state !== ApplicationState.PAUSED) return;
    this.start();
  }

  /** Get runtime instance */
  public getRuntime(): PixiRuntime | null {
    return this.runtime;
  }

  /** Get ticker instance */
  public getTicker(): PixiTicker | null {
    return this.ticker;
  }

  /** Get clock instance */
  public getClock(): PixiClock | null {
    return this.clock;
  }

  /** Get current state */
  public getState(): ApplicationState {
    return this.state;
  }

  /** Check if running */
  public isRunning(): boolean {
    return this.state === ApplicationState.RUNNING;
  }

  /** Destroy all subsystems */
  public destroy(): void {
    if (this.state === ApplicationState.DESTROYED) return;

    this.ticker?.destroy();
    this.runtime?.destroy();

    this.runtime = null;
    this.ticker = null;
    this.clock = null;
    this.config = null;

    this.state = ApplicationState.DESTROYED;
    PixiApplicationManager.instance = null;

    console.log('[PixiApplicationManager] Destroyed');
  }
}
