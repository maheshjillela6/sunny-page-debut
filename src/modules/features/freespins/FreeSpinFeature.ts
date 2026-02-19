/**
 * FreeSpinFeature - Free spins bonus feature
 */

import { SlotPlugin, PluginConfig, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';

export interface FreeSpinState {
  isActive: boolean;
  totalSpins: number;
  remainingSpins: number;
  totalWin: number;
  multiplier: number;
  triggerSymbol: string;
  triggerCount: number;
}

export class FreeSpinFeature extends SlotPlugin {
  private eventBus: EventBus;
  private state: FreeSpinState;

  constructor() {
    super({
      id: 'feature-freespins',
      version: '1.0.0',
      priority: PluginPriority.NORMAL,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
    this.state = this.createInitialState();
  }

  private createInitialState(): FreeSpinState {
    return {
      isActive: false,
      totalSpins: 0,
      remainingSpins: 0,
      totalWin: 0,
      multiplier: 1,
      triggerSymbol: 'S',
      triggerCount: 3,
    };
  }

  public async onLoad(): Promise<void> {
    this.setupEventListeners();
  }

  public async onUnload(): Promise<void> {
    this.reset();
  }

  public onEnable(): void {
    console.log('[FreeSpinFeature] Enabled');
  }

  public onDisable(): void {
    this.reset();
    console.log('[FreeSpinFeature] Disabled');
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:result', (payload) => {
      this.checkTrigger(payload.symbols);
    });

    this.eventBus.on('feature:freespins:trigger', (payload) => {
      this.trigger(payload.spins, payload.multiplier);
    });

    this.eventBus.on('feature:freespins:spin:complete', () => {
      this.onSpinComplete();
    });

    this.eventBus.on('feature:freespins:retrigger', (payload) => {
      this.retrigger(payload.additionalSpins);
    });
  }

  private checkTrigger(symbols: string[][]): void {
    if (this.state.isActive) return;

    let triggerCount = 0;
    for (const row of symbols) {
      for (const symbol of row) {
        if (symbol === this.state.triggerSymbol) {
          triggerCount++;
        }
      }
    }

    if (triggerCount >= this.state.triggerCount) {
      const spins = this.calculateSpins(triggerCount);
      this.eventBus.emit('feature:freespins:trigger', { 
        spins, 
        multiplier: 1,
        triggerCount 
      });
    }
  }

  private calculateSpins(triggerCount: number): number {
    const baseSpins: Record<number, number> = {
      3: 10,
      4: 15,
      5: 20,
    };
    return baseSpins[triggerCount] ?? 10;
  }

  public trigger(spins: number, multiplier: number = 1): void {
    this.state = {
      ...this.state,
      isActive: true,
      totalSpins: spins,
      remainingSpins: spins,
      totalWin: 0,
      multiplier,
    };

    this.eventBus.emit('feature:start', {
      featureType: 'freeSpins',
      featureData: { ...this.state },
    });

    console.log(`[FreeSpinFeature] Triggered ${spins} free spins with ${multiplier}x multiplier`);
  }

  public onSpinComplete(): void {
    if (!this.state.isActive) return;

    this.state.remainingSpins--;

    this.eventBus.emit('feature:update', {
      featureType: 'freeSpins',
      featureData: { ...this.state },
    });

    if (this.state.remainingSpins <= 0) {
      this.complete();
    }
  }

  public retrigger(additionalSpins: number): void {
    if (!this.state.isActive) return;

    this.state.totalSpins += additionalSpins;
    this.state.remainingSpins += additionalSpins;

    this.eventBus.emit('feature:update', {
      featureType: 'freeSpins',
      featureData: { ...this.state },
    });

    console.log(`[FreeSpinFeature] Retriggered +${additionalSpins} spins`);
  }

  public addWin(amount: number): void {
    this.state.totalWin += amount * this.state.multiplier;
  }

  public setMultiplier(multiplier: number): void {
    this.state.multiplier = multiplier;
  }

  private complete(): void {
    this.eventBus.emit('feature:end', {
      featureType: 'freeSpins',
      totalWin: this.state.totalWin,
      featureData: { ...this.state },
    });

    console.log(`[FreeSpinFeature] Complete - Total win: ${this.state.totalWin}`);
    this.reset();
  }

  public reset(): void {
    this.state = this.createInitialState();
  }

  public getState(): FreeSpinState {
    return { ...this.state };
  }

  public isActive(): boolean {
    return this.state.isActive;
  }
}
