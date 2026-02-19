/**
 * TickManager - Centralized tick management
 */

import { PixiRuntime } from '../../runtime/pixi/core/PixiRuntime';
import { PixiTicker, TickerPriority } from '../../runtime/pixi/core/PixiTicker';
import { ScreenManager } from '../../presentation/screens/ScreenManager';
import { GridManager } from '../../presentation/grid/GridManager';
import { EventBus } from '../../platform/events/EventBus';

export class TickManager {
  private static instance: TickManager | null = null;

  private ticker: PixiTicker | null = null;
  private screenManager: ScreenManager;
  private gridManager: GridManager;
  private eventBus: EventBus;
  private isRunning: boolean = false;

  private constructor() {
    this.screenManager = ScreenManager.getInstance();
    this.gridManager = GridManager.getInstance();
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): TickManager {
    if (!TickManager.instance) {
      TickManager.instance = new TickManager();
    }
    return TickManager.instance;
  }

  public initialize(ticker: PixiTicker): void {
    this.ticker = ticker;

    // Register update callbacks
    ticker.add('screen-update', (deltaTime) => {
      this.screenManager.update(deltaTime);
    }, TickerPriority.NORMAL);

    ticker.add('grid-update', (deltaTime) => {
      this.gridManager.update(deltaTime);
    }, TickerPriority.HIGH);

    this.isRunning = true;
  }

  public pause(): void {
    if (this.ticker) {
      this.ticker.pause();
    }
    this.isRunning = false;
  }

  public resume(): void {
    if (this.ticker) {
      this.ticker.resume();
    }
    this.isRunning = true;
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public destroy(): void {
    if (this.ticker) {
      this.ticker.remove('screen-update');
      this.ticker.remove('grid-update');
    }
    TickManager.instance = null;
  }
}
