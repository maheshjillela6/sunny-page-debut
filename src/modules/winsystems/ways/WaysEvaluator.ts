/**
 * WaysEvaluator - Evaluates 243 ways to win
 */

import { SlotPlugin, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';
import { WinData } from '../../../platform/events/EventMap';
 import { Logger } from '../../../platform/logger/Logger';

export interface WaysWin {
  symbolId: string;
  positions: Array<{ row: number; col: number }>;
  ways: number;
  amount: number;
  multiplier: number;
}

export interface WaysEvaluatorConfig {
  cols: number;
  rows: number;
  wildSymbol: string;
  paytable: { [symbolId: string]: { [matchCount: number]: number } };
  minMatch: number;
}

export class WaysEvaluator extends SlotPlugin {
  private eventBus: EventBus;
  private config: WaysEvaluatorConfig;
   private logger: Logger;

  constructor(config?: Partial<WaysEvaluatorConfig>) {
    super({
      id: 'winsystem-ways',
      version: '1.0.0',
      priority: PluginPriority.HIGH,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
     this.logger = Logger.create('WaysEvaluator');
    this.config = {
      cols: config?.cols ?? 5,
      rows: config?.rows ?? 3,
      wildSymbol: config?.wildSymbol ?? 'W',
      paytable: config?.paytable ?? this.getDefaultPaytable(),
      minMatch: config?.minMatch ?? 3,
    };
  }

  private getDefaultPaytable(): { [symbolId: string]: { [matchCount: number]: number } } {
    return {
      'A': { 3: 2, 4: 10, 5: 50 },
      'B': { 3: 1.5, 4: 8, 5: 40 },
      'C': { 3: 1, 4: 5, 5: 25 },
      'D': { 3: 0.8, 4: 4, 5: 20 },
      'E': { 3: 0.6, 4: 3, 5: 15 },
      'F': { 3: 0.4, 4: 2, 5: 10 },
      'W': { 3: 5, 4: 25, 5: 250 },
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
   * Calculate total ways for current grid configuration
   */
  public calculateTotalWays(): number {
    return Math.pow(this.config.rows, this.config.cols);
  }

  /**
   * Evaluate ways wins
   */
  public evaluate(symbols: string[][], bet: number): WinData[] {
    const wins: WinData[] = [];
    const evaluatedSymbols = new Set<string>();
     this.logger.debug(`Evaluating ways wins for ${this.config.cols}x${this.config.rows} grid, bet: ${bet}`);

    // Get all unique symbols from first reel
    const firstReelSymbols = new Set<string>();
    for (let row = 0; row < symbols.length; row++) {
      const symbol = symbols[row][0];
      if (symbol && symbol !== this.config.wildSymbol) {
        firstReelSymbols.add(symbol);
      }
    }

    // Add wild if present
    for (let row = 0; row < symbols.length; row++) {
      if (symbols[row][0] === this.config.wildSymbol) {
        firstReelSymbols.add(this.config.wildSymbol);
        break;
      }
    }

    // Evaluate each symbol
    for (const targetSymbol of firstReelSymbols) {
      if (evaluatedSymbols.has(targetSymbol)) continue;
      evaluatedSymbols.add(targetSymbol);

      const result = this.evaluateSymbol(symbols, targetSymbol, bet);
      if (result) {
        wins.push(result);
      }
    }

     this.logger.debug(`Found ${wins.length} ways wins`);
    return wins;
  }

  private evaluateSymbol(symbols: string[][], targetSymbol: string, bet: number): WinData | null {
    const positions: Array<Array<{ row: number; col: number }>> = [];
    let consecutiveReels = 0;

    // Check each reel from left to right
    for (let col = 0; col < this.config.cols; col++) {
      const reelPositions: Array<{ row: number; col: number }> = [];
      
      for (let row = 0; row < symbols.length; row++) {
        const symbol = symbols[row]?.[col];
        if (symbol === targetSymbol || symbol === this.config.wildSymbol) {
          reelPositions.push({ row, col });
        }
      }

      if (reelPositions.length === 0) {
        break;
      }

      positions.push(reelPositions);
      consecutiveReels++;
    }

    // Check if enough consecutive reels
    if (consecutiveReels < this.config.minMatch) return null;

    // Calculate number of ways
    const ways = positions.reduce((total, reelPos) => total * reelPos.length, 1);

    // Calculate payout
    const symbolPaytable = this.config.paytable[targetSymbol];
    if (!symbolPaytable || !symbolPaytable[consecutiveReels]) return null;

    const baseAmount = symbolPaytable[consecutiveReels] * bet;
    const amount = baseAmount * ways;

    // Flatten positions for WinData
    const allPositions = positions.flat();

    return {
      lineId: -1, // Ways don't use line IDs
      symbols: allPositions.map(() => targetSymbol),
      positions: allPositions,
      amount,
      multiplier: ways,
    };
  }

  public setConfig(config: Partial<WaysEvaluatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
