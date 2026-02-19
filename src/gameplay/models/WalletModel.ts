/**
 * WalletModel - Wallet/balance data model
 */

import { EventBus } from '@/platform/events/EventBus';

export interface MoneyValue {
  amount: number;
  currency: string;
}

export interface WalletData {
  balance: MoneyValue;
  pendingWin: MoneyValue;
  totalWagered: MoneyValue;
  totalWon: MoneyValue;
  sessionProfit: MoneyValue;
}

export interface BetConfig {
  total: MoneyValue;
  lines: number;
  coin: MoneyValue;
  coinsPerLine: number;
  minBet: number;
  maxBet: number;
  betLevels: number[];
  coinValues: number[];
}

export class WalletModel {
  private data: WalletData;
  private betConfig: BetConfig;
  private eventBus: EventBus;
  private sessionStartBalance: number;

  constructor(currency: string = 'GBP') {
    this.eventBus = EventBus.getInstance();
    this.sessionStartBalance = 0;

    this.data = {
      balance: { amount: 0, currency },
      pendingWin: { amount: 0, currency },
      totalWagered: { amount: 0, currency },
      totalWon: { amount: 0, currency },
      sessionProfit: { amount: 0, currency },
    };

    this.betConfig = {
      total: { amount: 10, currency },
      lines: 1024,
      coin: { amount: 1, currency },
      coinsPerLine: 1,
      minBet: 0.10,
      maxBet: 100.00,
      betLevels: [0.10, 0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00],
      coinValues: [0.01, 0.02, 0.05, 0.10, 0.20, 0.50, 1.00],
    };
  }

  // Balance operations
  public setBalance(amount: number): void {
    const previousBalance = this.data.balance.amount;
    this.data.balance.amount = amount;
    this.updateSessionProfit();

    this.eventBus.emit('wallet:balance:update', {
      previousBalance,
      newBalance: amount,
      change: amount - previousBalance,
    });
  }

  public getBalance(): number {
    return this.data.balance.amount;
  }

  public getBalanceValue(): MoneyValue {
    return { ...this.data.balance };
  }

  public deductBet(): boolean {
    const betAmount = this.betConfig.total.amount;
    
    if (this.data.balance.amount < betAmount) {
      return false;
    }

    const previousBalance = this.data.balance.amount;
    this.data.balance.amount -= betAmount;
    this.data.totalWagered.amount += betAmount;
    this.updateSessionProfit();

    this.eventBus.emit('wallet:balance:update', {
      previousBalance,
      newBalance: this.data.balance.amount,
      change: -betAmount,
    });

    return true;
  }

  public addWin(amount: number): void {
    const previousBalance = this.data.balance.amount;
    this.data.balance.amount += amount;
    this.data.totalWon.amount += amount;
    this.data.pendingWin.amount = 0;
    this.updateSessionProfit();

    this.eventBus.emit('wallet:balance:update', {
      previousBalance,
      newBalance: this.data.balance.amount,
      change: amount,
    });

    this.eventBus.emit('wallet:win:counter:start', {
      targetValue: amount,
      duration: 1000,
    });
  }

  public setPendingWin(amount: number): void {
    this.data.pendingWin.amount = amount;
  }

  public getPendingWin(): number {
    return this.data.pendingWin.amount;
  }

  // Bet operations
  public getBet(): number {
    return this.betConfig.total.amount;
  }

  public getBetConfig(): BetConfig {
    return { ...this.betConfig };
  }

  public setBet(amount: number): void {
    const clampedBet = Math.max(
      this.betConfig.minBet,
      Math.min(this.betConfig.maxBet, amount)
    );
    
    this.betConfig.total.amount = clampedBet;
    
    this.eventBus.emit('ui:bet:change', {
      previousBet: this.betConfig.total.amount,
      newBet: clampedBet,
    });
  }

  public setLines(lines: number): void {
    this.betConfig.lines = lines;
  }

  public getLines(): number {
    return this.betConfig.lines;
  }

  public canAffordBet(): boolean {
    return this.data.balance.amount >= this.betConfig.total.amount;
  }

  public increaseBet(): boolean {
    const currentIndex = this.betConfig.betLevels.indexOf(this.betConfig.total.amount);
    if (currentIndex < this.betConfig.betLevels.length - 1) {
      this.setBet(this.betConfig.betLevels[currentIndex + 1]);
      return true;
    }
    return false;
  }

  public decreaseBet(): boolean {
    const currentIndex = this.betConfig.betLevels.indexOf(this.betConfig.total.amount);
    if (currentIndex > 0) {
      this.setBet(this.betConfig.betLevels[currentIndex - 1]);
      return true;
    }
    return false;
  }

  // Session tracking
  public startSession(balance: number): void {
    this.sessionStartBalance = balance;
    this.setBalance(balance);
  }

  private updateSessionProfit(): void {
    this.data.sessionProfit.amount = this.data.balance.amount - this.sessionStartBalance;
  }

  public getSessionProfit(): number {
    return this.data.sessionProfit.amount;
  }

  public getStatistics(): {
    totalWagered: number;
    totalWon: number;
    sessionProfit: number;
    rtp: number;
  } {
    const rtp = this.data.totalWagered.amount > 0
      ? (this.data.totalWon.amount / this.data.totalWagered.amount) * 100
      : 0;

    return {
      totalWagered: this.data.totalWagered.amount,
      totalWon: this.data.totalWon.amount,
      sessionProfit: this.data.sessionProfit.amount,
      rtp,
    };
  }

  // Currency helpers
  public getCurrency(): string {
    return this.data.balance.currency;
  }

  public formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: this.data.balance.currency,
    }).format(amount);
  }

  // Serialization
  public getData(): WalletData {
    return {
      balance: { ...this.data.balance },
      pendingWin: { ...this.data.pendingWin },
      totalWagered: { ...this.data.totalWagered },
      totalWon: { ...this.data.totalWon },
      sessionProfit: { ...this.data.sessionProfit },
    };
  }

  public toJSON(): { data: WalletData; betConfig: BetConfig } {
    return {
      data: this.getData(),
      betConfig: this.getBetConfig(),
    };
  }

  public static fromJSON(json: { data: WalletData; betConfig: BetConfig }): WalletModel {
    const model = new WalletModel(json.data.balance.currency);
    model.data = json.data;
    model.betConfig = json.betConfig;
    return model;
  }
}

export default WalletModel;
