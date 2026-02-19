/**
 * FeatureState - Reactive feature state wrapper
 */

import { FeatureModel, FeatureMode, FeatureData, FreeSpinsState, HoldNSpinState, SeriesData, FeatureQueue, GambleState, BonusWheelState, LockedItem } from '../models/FeatureModel';
import { Position } from '../models/RoundModel';
import { EventBus } from '@/platform/events/EventBus';

export class FeatureState {
  private model: FeatureModel;
  private eventBus: EventBus;

  constructor(model?: FeatureModel) {
    this.model = model || new FeatureModel();
    this.eventBus = EventBus.getInstance();
  }

  // Mode management
  public getMode(): FeatureMode {
    return this.model.getMode();
  }

  public isInFeature(): boolean {
    return this.model.isInFeature();
  }

  public isInFreeSpins(): boolean {
    return this.model.getMode() === 'FS';
  }

  public isInHoldNSpin(): boolean {
    return this.model.getMode() === 'HNS';
  }

  // Series management
  public startSeries(series: SeriesData): void {
    this.model.startSeries(series);
    this.eventBus.emit('feature:start', {
      featureType: series.mode,
      featureData: { seriesId: series.seriesId },
    });
  }

  public getSeries(): SeriesData | null {
    return this.model.getSeries();
  }

  public endSeries(): void {
    const series = this.model.getSeries();
    this.model.endSeries();
    
    if (series) {
      this.eventBus.emit('feature:end', {
        featureType: series.mode,
        totalWin: 0,
        featureData: { seriesId: series.seriesId },
      });
    }
  }

  // Queue management
  public setQueue(queue: FeatureQueue[]): void {
    this.model.setQueue(queue);
  }

  public getQueue(): FeatureQueue[] {
    return this.model.getQueue();
  }

  public getNextQueuedFeature(): FeatureQueue | null {
    return this.model.getNextQueuedFeature();
  }

  // Free Spins
  public initFreeSpins(spinsAwarded: number, currency: string): void {
    this.model.initFreeSpins(spinsAwarded, currency);
    this.eventBus.emit('feature:freespins:init', { spinsAwarded });
  }

  public useFreeSpinSpin(): boolean {
    const result = this.model.useFreeSpinSpin();
    if (result) {
      const state = this.model.getFreeSpinsState();
      this.eventBus.emit('feature:freespins:spin', {
        remaining: state.remainingSpins,
        total: state.spinsAwarded,
      });
    }
    return result;
  }

  public addFreeSpinWin(amount: number): void {
    this.model.addFreeSpinWin(amount);
  }

  public retriggerFreeSpins(spins: number): void {
    this.model.retriggerFreeSpins(spins);
    this.eventBus.emit('feature:freespins:retrigger', { additionalSpins: spins });
  }

  public getFreeSpinsState(): FreeSpinsState {
    return this.model.getFreeSpinsState();
  }

  public addStickyWild(position: Position): void {
    this.model.addStickyWild(position);
    this.eventBus.emit('feature:sticky:add', { position });
  }

  // Hold N Spin
  public initHoldNSpin(startLives: number, lockedItems: LockedItem[], corPositions: number[], corValues: number[]): void {
    this.model.initHoldNSpin(startLives, lockedItems, corPositions, corValues);
    this.eventBus.emit('feature:hns:init', { 
      lives: startLives, 
      lockedCount: lockedItems.length,
    });
  }

  public useHNSLife(): boolean {
    const result = this.model.useHNSLife();
    if (result) {
      const state = this.model.getHoldNSpinState();
      this.eventBus.emit('feature:hns:life', { livesLeft: state.livesLeft });
    }
    return result;
  }

  public addLockedItem(item: LockedItem): void {
    this.model.addLockedItem(item);
    this.eventBus.emit('feature:hns:lock', { item });
  }

  public getHoldNSpinState(): HoldNSpinState {
    return this.model.getHoldNSpinState();
  }

  // Gamble
  public initGamble(offer: GambleState): void {
    this.model.initGamble(offer);
    this.eventBus.emit('feature:gamble:offer', { offer });
  }

  public getGambleState(): GambleState | null {
    return this.model.getGambleState();
  }

  public clearGamble(): void {
    this.model.clearGamble();
  }

  // Bonus Wheel
  public initBonusWheel(segments: string[], bias: 'uniform' | 'weighted'): void {
    this.model.initBonusWheel(segments, bias);
    this.eventBus.emit('feature:wheel:init', { segments });
  }

  public setBonusWheelResult(result: string, multiplier?: number): void {
    this.model.setBonusWheelResult(result, multiplier);
    this.eventBus.emit('feature:wheel:result', { result, multiplier });
  }

  public getBonusWheelState(): BonusWheelState | null {
    return this.model.getBonusWheelState();
  }

  // State access
  public getData(): FeatureData {
    return this.model.getData();
  }
}

export default FeatureState;
