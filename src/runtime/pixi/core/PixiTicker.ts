/**
 * PixiTicker - Centralized ticker management
 * Provides a single update loop with priority-based callback registration.
 */

import { Ticker } from 'pixi.js';

export enum TickerPriority {
  LOW = 0,
  NORMAL = 50,
  HIGH = 100,
  CRITICAL = 200,
}

export interface TickerCallback {
  id: string;
  callback: (deltaTime: number, elapsedMs: number) => void;
  priority: TickerPriority;
  active: boolean;
}

/**
 * Centralized ticker for managing game loop updates.
 * Supports priority-based callback ordering.
 */
export class PixiTicker {
  private ticker: Ticker;
  private callbacks: Map<string, TickerCallback> = new Map();
  private sortedCallbacks: TickerCallback[] = [];
  private needsSort: boolean = false;
  private elapsedMs: number = 0;
  private isPaused: boolean = false;
  private timeScale: number = 1;

  constructor(ticker: Ticker) {
    this.ticker = ticker;
    this.ticker.add(this.update, this);
  }

  /** Main update loop */
  private update(): void {
    if (this.isPaused) return;

    const deltaTime = this.ticker.deltaTime * this.timeScale;
    const deltaMs = this.ticker.deltaMS * this.timeScale;
    this.elapsedMs += deltaMs;

    // Sort if needed
    if (this.needsSort) {
      this.sortCallbacks();
    }

    // Execute callbacks in priority order
    for (const cb of this.sortedCallbacks) {
      if (cb.active) {
        try {
          cb.callback(deltaTime, this.elapsedMs);
        } catch (error) {
          console.error(`[PixiTicker] Error in callback ${cb.id}:`, error);
        }
      }
    }
  }

  /** Sort callbacks by priority (higher first) */
  private sortCallbacks(): void {
    this.sortedCallbacks = Array.from(this.callbacks.values())
      .filter(cb => cb.active)
      .sort((a, b) => b.priority - a.priority);
    this.needsSort = false;
  }

  /** Register a callback */
  public add(
    id: string,
    callback: (deltaTime: number, elapsedMs: number) => void,
    priority: TickerPriority = TickerPriority.NORMAL
  ): void {
    if (this.callbacks.has(id)) {
      console.warn(`[PixiTicker] Callback ${id} already exists, replacing`);
    }

    this.callbacks.set(id, {
      id,
      callback,
      priority,
      active: true,
    });

    this.needsSort = true;
  }

  /** Remove a callback */
  public remove(id: string): void {
    this.callbacks.delete(id);
    this.needsSort = true;
  }

  /** Enable a callback */
  public enable(id: string): void {
    const cb = this.callbacks.get(id);
    if (cb) {
      cb.active = true;
      this.needsSort = true;
    }
  }

  /** Disable a callback */
  public disable(id: string): void {
    const cb = this.callbacks.get(id);
    if (cb) {
      cb.active = false;
      this.needsSort = true;
    }
  }

  /** Check if a callback exists */
  public has(id: string): boolean {
    return this.callbacks.has(id);
  }

  /** Pause the ticker */
  public pause(): void {
    this.isPaused = true;
  }

  /** Resume the ticker */
  public resume(): void {
    this.isPaused = false;
  }

  /** Set time scale (slow motion / fast forward) */
  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }

  /** Get time scale */
  public getTimeScale(): number {
    return this.timeScale;
  }

  /** Get elapsed time in milliseconds */
  public getElapsedMs(): number {
    return this.elapsedMs;
  }

  /** Get current FPS */
  public getFPS(): number {
    return this.ticker.FPS;
  }

  /** Get delta time */
  public getDeltaTime(): number {
    return this.ticker.deltaTime * this.timeScale;
  }

  /** Get delta in milliseconds */
  public getDeltaMs(): number {
    return this.ticker.deltaMS * this.timeScale;
  }

  /** Destroy the ticker */
  public destroy(): void {
    this.ticker.remove(this.update, this);
    this.callbacks.clear();
    this.sortedCallbacks = [];
  }
}
