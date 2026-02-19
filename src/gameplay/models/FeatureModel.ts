/**
 * FeatureModel - Feature/bonus state model
 */

import { MoneyValue } from './WalletModel';
import { Position } from './RoundModel';

export type FeatureMode = 'BASE' | 'FS' | 'HNS' | 'BONUS' | 'GAMBLE';
export type FeatureState = 'inactive' | 'triggered' | 'pending' | 'active' | 'complete';

export interface LockedItem {
  row: number;
  col: number;
  amount: number;
  symbol?: string;
  multiplier?: number;
}

export interface HoldNSpinState {
  startLives: number;
  livesLeft: number;
  lockedItems: LockedItem[];
  corPositions: number[];
  corValues: number[];
  totalCollected: number;
  grandPrizeAvailable: boolean;
}

export interface FreeSpinsState {
  spinsAwarded: number;
  remainingSpins: number;
  totalWin: MoneyValue;
  multiplier: number;
  retriggerSpins: number;
  stickyWilds: Position[];
}

export interface GambleState {
  mode: 'DOUBLE' | 'COLLECT' | 'HALF';
  pWin: number;
  stake: MoneyValue;
  maxPayout: MoneyValue;
  history: Array<{ won: boolean; amount: number }>;
}

export interface BonusWheelState {
  segments: string[];
  bias: 'uniform' | 'weighted';
  result?: string;
  multiplier?: number;
}

export interface FeatureQueue {
  featureType: string;
  state: 'PENDING' | 'ACTIVE' | 'COMPLETE';
  priority: number;
}

export interface SeriesData {
  seriesId: string;
  mode: FeatureMode;
  remainingSpins?: number;
  remainingRespins?: number;
  resumeToken: string;
  retrigger?: { spins: number };
  spinsAwarded?: number;
}

export interface FeatureData {
  currentMode: FeatureMode;
  state: FeatureState;
  series: SeriesData | null;
  queue: FeatureQueue[];
  freeSpins: FreeSpinsState;
  holdNSpin: HoldNSpinState;
  gamble: GambleState | null;
  bonusWheel: BonusWheelState | null;
}

export class FeatureModel {
  private data: FeatureData;

  constructor() {
    this.data = this.createDefaultData();
  }

  private createDefaultData(): FeatureData {
    return {
      currentMode: 'BASE',
      state: 'inactive',
      series: null,
      queue: [],
      freeSpins: {
        spinsAwarded: 0,
        remainingSpins: 0,
        totalWin: { amount: 0, currency: 'GBP' },
        multiplier: 1,
        retriggerSpins: 0,
        stickyWilds: [],
      },
      holdNSpin: {
        startLives: 3,
        livesLeft: 3,
        lockedItems: [],
        corPositions: [],
        corValues: [],
        totalCollected: 0,
        grandPrizeAvailable: true,
      },
      gamble: null,
      bonusWheel: null,
    };
  }

  // Mode management
  public setMode(mode: FeatureMode): void {
    this.data.currentMode = mode;
  }

  public getMode(): FeatureMode {
    return this.data.currentMode;
  }

  public isInFeature(): boolean {
    return this.data.currentMode !== 'BASE';
  }

  // State management
  public setState(state: FeatureState): void {
    this.data.state = state;
  }

  public getState(): FeatureState {
    return this.data.state;
  }

  // Series management
  public startSeries(series: SeriesData): void {
    this.data.series = series;
    this.data.currentMode = series.mode;
    this.data.state = 'active';
  }

  public getSeries(): SeriesData | null {
    return this.data.series ? { ...this.data.series } : null;
  }

  public updateSeries(updates: Partial<SeriesData>): void {
    if (this.data.series) {
      this.data.series = { ...this.data.series, ...updates };
    }
  }

  public endSeries(): void {
    this.data.series = null;
    this.data.currentMode = 'BASE';
    this.data.state = 'inactive';
    this.resetFreeSpins();
    this.resetHoldNSpin();
  }

  // Queue management
  public setQueue(queue: FeatureQueue[]): void {
    this.data.queue = queue.sort((a, b) => a.priority - b.priority);
  }

  public getQueue(): FeatureQueue[] {
    return [...this.data.queue];
  }

  public getNextQueuedFeature(): FeatureQueue | null {
    const pending = this.data.queue.find(f => f.state === 'PENDING');
    return pending || null;
  }

  public updateQueueItem(featureType: string, state: FeatureQueue['state']): void {
    const item = this.data.queue.find(f => f.featureType === featureType);
    if (item) {
      item.state = state;
    }
  }

  // Free Spins
  public initFreeSpins(spinsAwarded: number, currency: string): void {
    this.data.freeSpins = {
      spinsAwarded,
      remainingSpins: spinsAwarded,
      totalWin: { amount: 0, currency },
      multiplier: 1,
      retriggerSpins: 0,
      stickyWilds: [],
    };
  }

  public useFreeSpinSpin(): boolean {
    if (this.data.freeSpins.remainingSpins <= 0) return false;
    this.data.freeSpins.remainingSpins--;
    return true;
  }

  public addFreeSpinWin(amount: number): void {
    this.data.freeSpins.totalWin.amount += amount;
  }

  public retriggerFreeSpins(spins: number): void {
    this.data.freeSpins.remainingSpins += spins;
    this.data.freeSpins.spinsAwarded += spins;
    this.data.freeSpins.retriggerSpins += spins;
  }

  public setFreeSpinMultiplier(multiplier: number): void {
    this.data.freeSpins.multiplier = multiplier;
  }

  public addStickyWild(position: Position): void {
    if (!this.data.freeSpins.stickyWilds.some(
      p => p.row === position.row && p.col === position.col
    )) {
      this.data.freeSpins.stickyWilds.push(position);
    }
  }

  public getFreeSpinsState(): FreeSpinsState {
    return { ...this.data.freeSpins };
  }

  private resetFreeSpins(): void {
    this.data.freeSpins = {
      spinsAwarded: 0,
      remainingSpins: 0,
      totalWin: { amount: 0, currency: 'GBP' },
      multiplier: 1,
      retriggerSpins: 0,
      stickyWilds: [],
    };
  }

  // Hold N Spin
  public initHoldNSpin(startLives: number, lockedItems: LockedItem[], corPositions: number[], corValues: number[]): void {
    this.data.holdNSpin = {
      startLives,
      livesLeft: startLives,
      lockedItems,
      corPositions,
      corValues,
      totalCollected: lockedItems.reduce((sum, item) => sum + item.amount, 0),
      grandPrizeAvailable: true,
    };
  }

  public useHNSLife(): boolean {
    if (this.data.holdNSpin.livesLeft <= 0) return false;
    this.data.holdNSpin.livesLeft--;
    return true;
  }

  public resetHNSLives(): void {
    this.data.holdNSpin.livesLeft = this.data.holdNSpin.startLives;
  }

  public addLockedItem(item: LockedItem): void {
    this.data.holdNSpin.lockedItems.push(item);
    this.data.holdNSpin.totalCollected += item.amount;
    this.data.holdNSpin.livesLeft = this.data.holdNSpin.startLives;
  }

  public getHoldNSpinState(): HoldNSpinState {
    return { ...this.data.holdNSpin };
  }

  private resetHoldNSpin(): void {
    this.data.holdNSpin = {
      startLives: 3,
      livesLeft: 3,
      lockedItems: [],
      corPositions: [],
      corValues: [],
      totalCollected: 0,
      grandPrizeAvailable: true,
    };
  }

  // Gamble
  public initGamble(gambleOffer: GambleState): void {
    this.data.gamble = gambleOffer;
  }

  public getGambleState(): GambleState | null {
    return this.data.gamble ? { ...this.data.gamble } : null;
  }

  public clearGamble(): void {
    this.data.gamble = null;
  }

  // Bonus Wheel
  public initBonusWheel(segments: string[], bias: 'uniform' | 'weighted'): void {
    this.data.bonusWheel = { segments, bias };
  }

  public setBonusWheelResult(result: string, multiplier?: number): void {
    if (this.data.bonusWheel) {
      this.data.bonusWheel.result = result;
      this.data.bonusWheel.multiplier = multiplier;
    }
  }

  public getBonusWheelState(): BonusWheelState | null {
    return this.data.bonusWheel ? { ...this.data.bonusWheel } : null;
  }

  public clearBonusWheel(): void {
    this.data.bonusWheel = null;
  }

  // Serialization
  public getData(): FeatureData {
    return { ...this.data };
  }

  public toJSON(): FeatureData {
    return this.getData();
  }

  public static fromJSON(json: FeatureData): FeatureModel {
    const model = new FeatureModel();
    model.data = json;
    return model;
  }
}

export default FeatureModel;
