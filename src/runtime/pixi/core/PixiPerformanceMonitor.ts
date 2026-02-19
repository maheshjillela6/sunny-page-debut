/**
 * PixiPerformanceMonitor - Performance metrics tracking
 * Monitors FPS, draw calls, and memory usage.
 */

import { Application } from 'pixi.js';

export interface PerformanceMetrics {
  fps: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
  frameTime: number;
  memoryUsed: number;
  memoryLimit: number;
  drawCalls: number;
  textureCount: number;
}

/**
 * Monitors and reports performance metrics for the Pixi application.
 */
export class PixiPerformanceMonitor {
  private app: Application;
  private fpsHistory: number[] = [];
  private maxHistoryLength: number = 60;
  private lastFrameTime: number = 0;
  private frameTime: number = 0;

  constructor(app: Application) {
    this.app = app;
    this.lastFrameTime = performance.now();

    // Hook into ticker
    this.app.ticker.add(this.update, this);
  }

  /** Update performance metrics each frame */
  private update(): void {
    const now = performance.now();
    this.frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Track FPS history
    const fps = this.app.ticker.FPS;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.maxHistoryLength) {
      this.fpsHistory.shift();
    }
  }

  /** Get current performance metrics */
  public getMetrics(): PerformanceMetrics {
    const fps = this.app.ticker.FPS;
    const averageFps = this.fpsHistory.length > 0
      ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
      : fps;
    const minFps = this.fpsHistory.length > 0 ? Math.min(...this.fpsHistory) : fps;
    const maxFps = this.fpsHistory.length > 0 ? Math.max(...this.fpsHistory) : fps;

    // Memory info (if available)
    let memoryUsed = 0;
    let memoryLimit = 0;
    if ('memory' in performance) {
      const memory = (performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      memoryUsed = memory.usedJSHeapSize;
      memoryLimit = memory.jsHeapSizeLimit;
    }

    return {
      fps: Math.round(fps),
      averageFps: Math.round(averageFps),
      minFps: Math.round(minFps),
      maxFps: Math.round(maxFps),
      frameTime: Math.round(this.frameTime * 100) / 100,
      memoryUsed,
      memoryLimit,
      drawCalls: 0, // Would need renderer instrumentation
      textureCount: 0, // Would need texture cache tracking
    };
  }

  /** Check if performance is degraded */
  public isPerformanceDegraded(): boolean {
    const metrics = this.getMetrics();
    return metrics.averageFps < 50;
  }

  /** Reset metrics history */
  public reset(): void {
    this.fpsHistory = [];
  }

  /** Destroy the monitor */
  public destroy(): void {
    this.app.ticker.remove(this.update, this);
    this.fpsHistory = [];
  }
}
