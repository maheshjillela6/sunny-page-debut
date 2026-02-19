/**
 * BonusFeature - Bonus mini-game feature
 */

import { SlotPlugin, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';

export enum BonusType {
  PICK = 'pick',
  WHEEL = 'wheel',
  TRAIL = 'trail',
  REVEAL = 'reveal',
}

export interface BonusPrize {
  id: string;
  type: 'credits' | 'multiplier' | 'freespins' | 'jackpot' | 'collect';
  value: number;
  revealed: boolean;
}

export interface BonusState {
  isActive: boolean;
  bonusType: BonusType;
  picks: number;
  picksRemaining: number;
  totalWin: number;
  prizes: BonusPrize[];
  selectedPrizes: BonusPrize[];
  triggerSymbol: string;
  triggerCount: number;
}

export class BonusFeature extends SlotPlugin {
  private eventBus: EventBus;
  private state: BonusState;

  constructor() {
    super({
      id: 'feature-bonus',
      version: '1.0.0',
      priority: PluginPriority.NORMAL,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
    this.state = this.createInitialState();
  }

  private createInitialState(): BonusState {
    return {
      isActive: false,
      bonusType: BonusType.PICK,
      picks: 3,
      picksRemaining: 3,
      totalWin: 0,
      prizes: [],
      selectedPrizes: [],
      triggerSymbol: 'B',
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
    console.log('[BonusFeature] Enabled');
  }

  public onDisable(): void {
    this.reset();
    console.log('[BonusFeature] Disabled');
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:result', (payload) => {
      if (!this.state.isActive) {
        this.checkTrigger(payload.symbols);
      }
    });

    this.eventBus.on('bonus:pick', (payload) => {
      this.handlePick(payload.prizeId);
    });
  }

  private checkTrigger(symbols: string[][]): void {
    let triggerCount = 0;
    
    for (const row of symbols) {
      for (const symbol of row) {
        if (symbol === this.state.triggerSymbol) {
          triggerCount++;
        }
      }
    }

    if (triggerCount >= this.state.triggerCount) {
      this.trigger(BonusType.PICK, this.calculatePicks(triggerCount));
    }
  }

  private calculatePicks(triggerCount: number): number {
    return triggerCount; // 1 pick per trigger symbol
  }

  public trigger(type: BonusType, picks: number): void {
    this.state = {
      ...this.createInitialState(),
      isActive: true,
      bonusType: type,
      picks,
      picksRemaining: picks,
      prizes: this.generatePrizes(type),
    };

    this.eventBus.emit('feature:start', {
      featureType: 'bonus',
      featureData: { ...this.state },
    });

    console.log(`[BonusFeature] Triggered ${type} bonus with ${picks} picks`);
  }

  private generatePrizes(type: BonusType): BonusPrize[] {
    const prizes: BonusPrize[] = [];
    const prizeCount = 12; // Standard pick game size

    // Generate prize distribution
    const distribution: Array<{ type: BonusPrize['type']; value: number; count: number }> = [
      { type: 'credits', value: 10, count: 3 },
      { type: 'credits', value: 25, count: 3 },
      { type: 'credits', value: 50, count: 2 },
      { type: 'credits', value: 100, count: 1 },
      { type: 'multiplier', value: 2, count: 1 },
      { type: 'multiplier', value: 3, count: 1 },
      { type: 'collect', value: 0, count: 1 },
    ];

    let id = 0;
    for (const item of distribution) {
      for (let i = 0; i < item.count; i++) {
        prizes.push({
          id: `prize_${id++}`,
          type: item.type,
          value: item.value,
          revealed: false,
        });
      }
    }

    // Shuffle prizes
    for (let i = prizes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [prizes[i], prizes[j]] = [prizes[j], prizes[i]];
    }

    return prizes;
  }

  public handlePick(prizeId: string): void {
    if (!this.state.isActive || this.state.picksRemaining <= 0) return;

    const prize = this.state.prizes.find(p => p.id === prizeId);
    if (!prize || prize.revealed) return;

    prize.revealed = true;
    this.state.selectedPrizes.push(prize);
    this.state.picksRemaining--;

    // Process prize
    if (prize.type === 'credits') {
      this.state.totalWin += prize.value;
    } else if (prize.type === 'multiplier') {
      this.state.totalWin *= prize.value;
    }

    this.eventBus.emit('bonus:prize:revealed', {
      prize: { ...prize },
      totalWin: this.state.totalWin,
      picksRemaining: this.state.picksRemaining,
    });

    // Check for end conditions
    if (prize.type === 'collect' || this.state.picksRemaining <= 0) {
      this.complete();
    }
  }

  private complete(): void {
    this.eventBus.emit('feature:end', {
      featureType: 'bonus',
      totalWin: this.state.totalWin,
      featureData: { ...this.state },
    });

    console.log(`[BonusFeature] Complete - Total win: ${this.state.totalWin}`);
    this.reset();
  }

  public reset(): void {
    this.state = this.createInitialState();
  }

  public getState(): BonusState {
    return { 
      ...this.state,
      prizes: this.state.prizes.map(p => ({ ...p })),
      selectedPrizes: this.state.selectedPrizes.map(p => ({ ...p })),
    };
  }

  public isActive(): boolean {
    return this.state.isActive;
  }
}
