/**
 * GameClock - High-precision game timing
 */

export class GameClock {
  private static instance: GameClock | null = null;

  private startTime: number = 0;
  private pauseTime: number = 0;
  private totalPausedTime: number = 0;
  private isPaused: boolean = false;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private deltaTime: number = 0;

  private constructor() {
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
  }

  public static getInstance(): GameClock {
    if (!GameClock.instance) {
      GameClock.instance = new GameClock();
    }
    return GameClock.instance;
  }

  public update(): void {
    if (this.isPaused) return;

    const now = performance.now();
    this.deltaTime = (now - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = now;
    this.frameCount++;
  }

  public getTime(): number {
    if (this.isPaused) {
      return this.pauseTime - this.startTime - this.totalPausedTime;
    }
    return performance.now() - this.startTime - this.totalPausedTime;
  }

  public getTimeSeconds(): number {
    return this.getTime() / 1000;
  }

  public getDeltaTime(): number {
    return this.deltaTime;
  }

  public getDeltaTimeMs(): number {
    return this.deltaTime * 1000;
  }

  public getFrameCount(): number {
    return this.frameCount;
  }

  public getFPS(): number {
    if (this.deltaTime === 0) return 60;
    return 1 / this.deltaTime;
  }

  public pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.pauseTime = performance.now();
  }

  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.totalPausedTime += performance.now() - this.pauseTime;
    this.lastFrameTime = performance.now();
  }

  public isPausedState(): boolean {
    return this.isPaused;
  }

  public reset(): void {
    this.startTime = performance.now();
    this.pauseTime = 0;
    this.totalPausedTime = 0;
    this.isPaused = false;
    this.frameCount = 0;
    this.lastFrameTime = this.startTime;
    this.deltaTime = 0;
  }

  public destroy(): void {
    GameClock.instance = null;
  }
}

export default GameClock;
