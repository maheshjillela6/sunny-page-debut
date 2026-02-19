/**
 * StickyWildFeature - Wilds that stick for multiple spins
 */

import { SlotPlugin, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';

export interface StickyWild {
  row: number;
  col: number;
  remainingSpins: number;
  multiplier?: number;
}

export interface StickyWildState {
  isActive: boolean;
  stickyWilds: StickyWild[];
  defaultDuration: number;
}

export class StickyWildFeature extends SlotPlugin {
  private eventBus: EventBus;
  private state: StickyWildState;

  constructor() {
    super({
      id: 'feature-stickywild',
      version: '1.0.0',
      priority: PluginPriority.HIGH,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
    this.state = this.createInitialState();
  }

  private createInitialState(): StickyWildState {
    return {
      isActive: false,
      stickyWilds: [],
      defaultDuration: 3,
    };
  }

  public async onLoad(): Promise<void> {
    this.setupEventListeners();
  }

  public async onUnload(): Promise<void> {
    this.reset();
  }

  public onEnable(): void {
    console.log('[StickyWildFeature] Enabled');
  }

  public onDisable(): void {
    this.reset();
    console.log('[StickyWildFeature] Disabled');
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:result', (payload) => {
      this.processWilds(payload.symbols);
    });

    this.eventBus.on('game:spin:start', () => {
      this.decrementDurations();
    });
  }

  private processWilds(symbols: string[][]): void {
    for (let row = 0; row < symbols.length; row++) {
      for (let col = 0; col < symbols[row].length; col++) {
        if (symbols[row][col] === 'W' || symbols[row][col] === 'WILD') {
          if (!this.hasWildAt(row, col)) {
            this.addStickyWild(row, col);
          }
        }
      }
    }
  }

  public addStickyWild(row: number, col: number, duration?: number, multiplier?: number): void {
    if (this.hasWildAt(row, col)) return;

    const wild: StickyWild = {
      row,
      col,
      remainingSpins: duration ?? this.state.defaultDuration,
      multiplier: multiplier ?? 1,
    };

    this.state.stickyWilds.push(wild);
    this.state.isActive = true;

    this.eventBus.emit('feature:wild:sticky:add', {
      row,
      col,
      duration: wild.remainingSpins,
      multiplier: wild.multiplier,
    });
  }

  public hasWildAt(row: number, col: number): boolean {
    return this.state.stickyWilds.some(w => w.row === row && w.col === col);
  }

  private decrementDurations(): void {
    const expiredWilds: StickyWild[] = [];

    for (const wild of this.state.stickyWilds) {
      wild.remainingSpins--;
      if (wild.remainingSpins <= 0) {
        expiredWilds.push(wild);
      }
    }

    // Remove expired wilds
    for (const expired of expiredWilds) {
      this.removeStickyWild(expired.row, expired.col);
    }

    if (this.state.stickyWilds.length === 0) {
      this.state.isActive = false;
    }
  }

  public removeStickyWild(row: number, col: number): void {
    const index = this.state.stickyWilds.findIndex(w => w.row === row && w.col === col);
    if (index !== -1) {
      this.state.stickyWilds.splice(index, 1);
      
      this.eventBus.emit('feature:wild:sticky:remove', { row, col });
    }
  }

  public applyToGrid(symbols: string[][]): string[][] {
    const result = symbols.map(row => [...row]);
    
    for (const wild of this.state.stickyWilds) {
      if (result[wild.row] && result[wild.row][wild.col] !== undefined) {
        result[wild.row][wild.col] = 'W';
      }
    }
    
    return result;
  }

  public getMultiplierAt(row: number, col: number): number {
    const wild = this.state.stickyWilds.find(w => w.row === row && w.col === col);
    return wild?.multiplier ?? 1;
  }

  public reset(): void {
    this.state = this.createInitialState();
  }

  public getState(): StickyWildState {
    return {
      ...this.state,
      stickyWilds: this.state.stickyWilds.map(w => ({ ...w })),
    };
  }

  public getStickyPositions(): Array<{ row: number; col: number }> {
    return this.state.stickyWilds.map(w => ({ row: w.row, col: w.col }));
  }

  public isActive(): boolean {
    return this.state.isActive;
  }
}
