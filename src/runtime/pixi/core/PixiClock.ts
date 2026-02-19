/**
 * PixiClock - Game time management
 * Provides consistent time tracking independent of frame rate.
 */

export interface ClockState {
  currentTime: number;
  deltaTime: number;
  deltaMs: number;
  frameCount: number;
  isRunning: boolean;
  timeScale: number;
}

/**
 * High-precision game clock for timing-critical operations.
 */
export class PixiClock {
  private startTime: number = 0;
  private lastTime: number = 0;
  private currentTime: number = 0;
  private deltaTime: number = 0;
  private deltaMs: number = 0;
  private frameCount: number = 0;
  private isRunning: boolean = false;
  private timeScale: number = 1;
  private pausedAt: number = 0;
  private totalPausedTime: number = 0;

  /** Start the clock */
  public start(): void {
    if (this.isRunning) return;

    const now = performance.now();
    
    if (this.pausedAt > 0) {
      this.totalPausedTime += now - this.pausedAt;
      this.pausedAt = 0;
    } else {
      this.startTime = now;
      this.lastTime = now;
      this.totalPausedTime = 0;
    }

    this.isRunning = true;
  }

  /** Pause the clock */
  public pause(): void {
    if (!this.isRunning) return;
    this.pausedAt = performance.now();
    this.isRunning = false;
  }

  /** Reset the clock */
  public reset(): void {
    const now = performance.now();
    this.startTime = now;
    this.lastTime = now;
    this.currentTime = 0;
    this.deltaTime = 0;
    this.deltaMs = 0;
    this.frameCount = 0;
    this.pausedAt = 0;
    this.totalPausedTime = 0;
  }

  /** Update the clock (call once per frame) */
  public update(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    this.deltaMs = (now - this.lastTime) * this.timeScale;
    this.deltaTime = this.deltaMs / 16.667; // Normalized to 60fps
    this.currentTime = (now - this.startTime - this.totalPausedTime) * this.timeScale;
    this.lastTime = now;
    this.frameCount++;
  }

  /** Get current game time in milliseconds */
  public getTime(): number {
    return this.currentTime;
  }

  /** Get current game time in seconds */
  public getTimeSeconds(): number {
    return this.currentTime / 1000;
  }

  /** Get delta time (normalized to 60fps, 1.0 = one frame at 60fps) */
  public getDeltaTime(): number {
    return this.deltaTime;
  }

  /** Get delta time in milliseconds */
  public getDeltaMs(): number {
    return this.deltaMs;
  }

  /** Get total frame count */
  public getFrameCount(): number {
    return this.frameCount;
  }

  /** Set time scale for slow motion / fast forward */
  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }

  /** Get time scale */
  public getTimeScale(): number {
    return this.timeScale;
  }

  /** Get clock state */
  public getState(): ClockState {
    return {
      currentTime: this.currentTime,
      deltaTime: this.deltaTime,
      deltaMs: this.deltaMs,
      frameCount: this.frameCount,
      isRunning: this.isRunning,
      timeScale: this.timeScale,
    };
  }

  /** Check if clock is running */
  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
