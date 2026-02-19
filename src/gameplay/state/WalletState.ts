/**
 * WalletState - Reactive wallet state wrapper with singleton pattern
 */

import { WalletModel, WalletData, BetConfig } from '../models/WalletModel';
import { EventBus } from '@/platform/events/EventBus';

export class WalletState {
  private static instance: WalletState | null = null;
  
  private model: WalletModel;
  private eventBus: EventBus;
  private currency: string = 'GBP';

  private constructor(model?: WalletModel) {
    this.model = model || new WalletModel();
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): WalletState {
    if (!WalletState.instance) {
      WalletState.instance = new WalletState();
    }
    return WalletState.instance;
  }

  // Reactive getters with event emissions
  public getBalance(): number {
    return this.model.getBalance();
  }

  public getBet(): number {
    return this.model.getBet();
  }

  public getLines(): number {
    return this.model.getLines();
  }

  public getCurrency(): string {
    return this.currency;
  }

  public canAffordBet(): boolean {
    return this.model.canAffordBet();
  }

  public formatBalance(): string {
    return this.model.formatAmount(this.model.getBalance());
  }

  public formatBet(): string {
    return this.model.formatAmount(this.model.getBet());
  }

  // Actions
  public setBalance(amount: number): void {
    const prev = this.model.getBalance();
    this.model.setBalance(amount);
    this.eventBus.emit('wallet:balance:update', {
      previousBalance: prev,
      newBalance: amount,
      change: amount - prev,
    });
    this.notifyChange();
  }

  public setBet(amount: number): void {
    this.model.setBet(amount);
    this.notifyChange();
  }

  public setCurrency(currency: string): void {
    this.currency = currency;
  }

  public increaseBet(): boolean {
    const result = this.model.increaseBet();
    if (result) this.notifyChange();
    return result;
  }

  public decreaseBet(): boolean {
    const result = this.model.decreaseBet();
    if (result) this.notifyChange();
    return result;
  }

  public deductBet(): boolean {
    return this.model.deductBet();
  }

  public addWin(amount: number): void {
    this.model.addWin(amount);
    this.notifyChange();
  }

  // State access
  public getData(): WalletData {
    return this.model.getData();
  }

  public getBetConfig(): BetConfig {
    return this.model.getBetConfig();
  }

  public getStatistics() {
    return this.model.getStatistics();
  }

  public reset(): void {
    this.model = new WalletModel();
    this.currency = 'GBP';
  }

  private notifyChange(): void {
    this.eventBus.emit('wallet:state:change', {
      balance: this.getBalance(),
      bet: this.getBet(),
    });
  }

  public static reset(): void {
    if (WalletState.instance) {
      WalletState.instance.reset();
      WalletState.instance = null;
    }
  }
}

export default WalletState;
