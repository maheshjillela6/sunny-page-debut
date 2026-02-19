/**
 * LineEvaluator - Evaluates wins on paylines
 */

import { SlotPlugin, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';
import { WinData } from '../../../platform/events/EventMap';
 import { Logger } from '../../../platform/logger/Logger';

export interface PaylineDefinition {
  id: number;
  positions: Array<{ row: number; col: number }>;
}

export interface PayTable {
  [symbolId: string]: {
    [matchCount: number]: number;
  };
}

export interface LineEvaluatorConfig {
  paylines: PaylineDefinition[];
  paytable: PayTable;
  minMatch: number;
  wildSymbol: string;
}

export class LineEvaluator extends SlotPlugin {
  private eventBus: EventBus;
  private config: LineEvaluatorConfig;
   private logger: Logger;

  constructor(config?: Partial<LineEvaluatorConfig>) {
    super({
      id: 'winsystem-paylines',
      version: '1.0.0',
      priority: PluginPriority.HIGH,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
     this.logger = Logger.create('LineEvaluator');
    this.config = {
      paylines: config?.paylines ?? this.getDefaultPaylines(),
      paytable: config?.paytable ?? this.getDefaultPaytable(),
      minMatch: config?.minMatch ?? 3,
      wildSymbol: config?.wildSymbol ?? 'W',
    };
  }

  private getDefaultPaylines(): PaylineDefinition[] {
    // Standard 20 paylines for 5x3 grid
    return [
      { id: 0, positions: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }] },
      { id: 1, positions: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 }] },
      { id: 2, positions: [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }] },
      { id: 3, positions: [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 1, col: 3 }, { row: 0, col: 4 }] },
      { id: 4, positions: [{ row: 2, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 3 }, { row: 2, col: 4 }] },
    ];
  }

  private getDefaultPaytable(): PayTable {
    return {
      'A': { 3: 5, 4: 20, 5: 100 },
      'B': { 3: 4, 4: 15, 5: 75 },
      'C': { 3: 3, 4: 10, 5: 50 },
      'D': { 3: 2, 4: 8, 5: 40 },
      'E': { 3: 2, 4: 5, 5: 25 },
      'F': { 3: 1, 4: 3, 5: 15 },
      'W': { 3: 10, 4: 50, 5: 500 },
      'S': { 3: 5, 4: 20, 5: 100 },
    };
  }

  public async onLoad(): Promise<void> {
     this.logger.info('Loaded');
  }

  public async onUnload(): Promise<void> {
     this.logger.info('Unloaded');
  }

  public onEnable(): void {
     this.logger.info('Enabled');
  }

  public onDisable(): void {
     this.logger.info('Disabled');
  }

  /**
   * Evaluate all paylines for wins
   */
  public evaluate(symbols: string[][], bet: number): WinData[] {
    const wins: WinData[] = [];
     this.logger.debug(`Evaluating ${this.config.paylines.length} paylines for bet: ${bet}`);

    for (const payline of this.config.paylines) {
      const lineSymbols = this.getLineSymbols(symbols, payline);
      const win = this.evaluateLine(payline, lineSymbols, bet);
      
      if (win) {
        wins.push(win);
      }
    }

     this.logger.debug(`Found ${wins.length} line wins`);
    return wins;
  }

  private getLineSymbols(symbols: string[][], payline: PaylineDefinition): string[] {
    return payline.positions.map(pos => symbols[pos.row]?.[pos.col] ?? '');
  }

  private evaluateLine(payline: PaylineDefinition, lineSymbols: string[], bet: number): WinData | null {
    if (lineSymbols.length === 0) return null;

    // Get first non-wild symbol
    let matchSymbol = lineSymbols[0];
    let startIdx = 0;
    
    for (let i = 0; i < lineSymbols.length; i++) {
      if (lineSymbols[i] !== this.config.wildSymbol) {
        matchSymbol = lineSymbols[i];
        break;
      }
      startIdx = i + 1;
    }

    // If all wilds, use wild as match symbol
    if (startIdx >= lineSymbols.length) {
      matchSymbol = this.config.wildSymbol;
      startIdx = 0;
    }

    // Count consecutive matches from left
    let matchCount = 0;
    const positions: { row: number; col: number }[] = [];
    const matchedSymbols: string[] = [];

    for (let i = 0; i < lineSymbols.length; i++) {
      const symbol = lineSymbols[i];
      if (symbol === matchSymbol || symbol === this.config.wildSymbol) {
        matchCount++;
        positions.push(payline.positions[i]);
        matchedSymbols.push(symbol);
      } else {
        break;
      }
    }

    // Check if enough matches
    if (matchCount < this.config.minMatch) return null;

    // Calculate payout
    const symbolPaytable = this.config.paytable[matchSymbol];
    if (!symbolPaytable || !symbolPaytable[matchCount]) return null;

    const amount = symbolPaytable[matchCount] * bet;

    return {
      lineId: payline.id,
      symbols: matchedSymbols,
      positions,
      amount,
      multiplier: 1,
    };
  }

  public setPaylines(paylines: PaylineDefinition[]): void {
    this.config.paylines = paylines;
  }

  public setPaytable(paytable: PayTable): void {
    this.config.paytable = paytable;
  }

  public getPaylines(): PaylineDefinition[] {
    return [...this.config.paylines];
  }

  public getPaytable(): PayTable {
    return { ...this.config.paytable };
  }
}
