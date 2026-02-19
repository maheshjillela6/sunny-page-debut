/**
 * EngineLifecycle - Engine lifecycle management
 */

export interface IEngineLifecycle {
  onInit(): Promise<void>;
  onReady(): void;
  onPause(): void;
  onResume(): void;
  onDestroy(): void;
  onError(error: Error): void;
}

export enum LifecyclePhase {
  BOOT = 'boot',
  INIT = 'init',
  LOAD = 'load',
  READY = 'ready',
  RUNNING = 'running',
  PAUSED = 'paused',
  SHUTDOWN = 'shutdown',
}

export class EngineLifecycle implements IEngineLifecycle {
  private phase: LifecyclePhase = LifecyclePhase.BOOT;
  private initPromise: Promise<void> | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private totalPausedTime: number = 0;

  public getPhase(): LifecyclePhase {
    return this.phase;
  }

  public getUptime(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime - this.totalPausedTime;
  }

  public async onInit(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.phase = LifecyclePhase.INIT;
    this.startTime = Date.now();

    this.initPromise = new Promise<void>((resolve) => {
      this.phase = LifecyclePhase.LOAD;
      resolve();
    });

    return this.initPromise;
  }

  public onReady(): void {
    this.phase = LifecyclePhase.READY;
    console.log('[EngineLifecycle] Engine ready');
  }

  public onPause(): void {
    if (this.phase === LifecyclePhase.PAUSED) return;
    this.phase = LifecyclePhase.PAUSED;
    this.pauseTime = Date.now();
    console.log('[EngineLifecycle] Engine paused');
  }

  public onResume(): void {
    if (this.phase !== LifecyclePhase.PAUSED) return;
    this.phase = LifecyclePhase.RUNNING;
    this.totalPausedTime += Date.now() - this.pauseTime;
    console.log('[EngineLifecycle] Engine resumed');
  }

  public onDestroy(): void {
    this.phase = LifecyclePhase.SHUTDOWN;
    console.log('[EngineLifecycle] Engine destroyed');
  }

  public onError(error: Error): void {
    console.error('[EngineLifecycle] Engine error:', error);
  }
}

export default EngineLifecycle;
