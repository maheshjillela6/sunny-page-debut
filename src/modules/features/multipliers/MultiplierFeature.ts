/**
 * MultiplierFeature - Dynamic multipliers during gameplay
 */

import { SlotPlugin, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';

export interface MultiplierState {
  isActive: boolean;
  currentMultiplier: number;
  baseMultiplier: number;
  maxMultiplier: number;
  incrementOnWin: number;
  resetOnNoWin: boolean;
  cascadeMultiplier: boolean;
}

export class MultiplierFeature extends SlotPlugin {
  private eventBus: EventBus;
  private state: MultiplierState;

  constructor() {
    super({
      id: 'feature-multiplier',
      version: '1.0.0',
      priority: PluginPriority.NORMAL,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
    this.state = this.createInitialState();
  }

  private createInitialState(): MultiplierState {
    return {
      isActive: false,
      currentMultiplier: 1,
      baseMultiplier: 1,
      maxMultiplier: 10,
      incrementOnWin: 1,
      resetOnNoWin: true,
      cascadeMultiplier: false,
    };
  }

  public async onLoad(): Promise<void> {
    this.setupEventListeners();
  }

  public async onUnload(): Promise<void> {
    this.reset();
  }

  public onEnable(): void {
    this.state.isActive = true;
    console.log('[MultiplierFeature] Enabled');
  }

  public onDisable(): void {
    this.reset();
    console.log('[MultiplierFeature] Disabled');
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:start', () => {
      if (!this.state.cascadeMultiplier) {
        this.resetMultiplier();
      }
    });

    this.eventBus.on('game:win:detected', (payload) => {
      this.incrementMultiplier();
    });

    this.eventBus.on('game:cascade:complete', () => {
      if (this.state.resetOnNoWin) {
        this.resetMultiplier();
      }
    });

    this.eventBus.on('feature:start', (payload) => {
      if (payload.featureType === 'freeSpins') {
        this.state.cascadeMultiplier = true;
      }
    });

    this.eventBus.on('feature:end', () => {
      this.state.cascadeMultiplier = false;
      this.resetMultiplier();
    });
  }

  public incrementMultiplier(): void {
    if (!this.state.isActive) return;

    const newMultiplier = Math.min(
      this.state.currentMultiplier + this.state.incrementOnWin,
      this.state.maxMultiplier
    );

    if (newMultiplier !== this.state.currentMultiplier) {
      this.state.currentMultiplier = newMultiplier;
      
      this.eventBus.emit('feature:multiplier:change', {
        previousMultiplier: this.state.currentMultiplier - this.state.incrementOnWin,
        newMultiplier: this.state.currentMultiplier,
      });
    }
  }

  public setMultiplier(value: number): void {
    this.state.currentMultiplier = Math.min(value, this.state.maxMultiplier);
    
    this.eventBus.emit('feature:multiplier:change', {
      previousMultiplier: 1,
      newMultiplier: this.state.currentMultiplier,
    });
  }

  public resetMultiplier(): void {
    if (this.state.currentMultiplier !== this.state.baseMultiplier) {
      const previous = this.state.currentMultiplier;
      this.state.currentMultiplier = this.state.baseMultiplier;
      
      this.eventBus.emit('feature:multiplier:reset', {
        previousMultiplier: previous,
        newMultiplier: this.state.baseMultiplier,
      });
    }
  }

  public applyMultiplier(amount: number): number {
    return amount * this.state.currentMultiplier;
  }

  public getCurrentMultiplier(): number {
    return this.state.currentMultiplier;
  }

  public setMaxMultiplier(max: number): void {
    this.state.maxMultiplier = max;
  }

  public setIncrementOnWin(increment: number): void {
    this.state.incrementOnWin = increment;
  }

  public reset(): void {
    this.state = this.createInitialState();
  }

  public getState(): MultiplierState {
    return { ...this.state };
  }

  public isActive(): boolean {
    return this.state.isActive;
  }
}
