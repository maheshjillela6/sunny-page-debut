/**
 * MegawaysEvaluator - Evaluates megaways wins
 */

import { SlotPlugin, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';
import { WinData } from '../../../platform/events/EventMap';
import { MegawaysMapper, WayResult } from '../../mechanics/megaways/MegawaysMapper';
 import { Logger } from '../../../platform/logger/Logger';

export interface MegawaysEvaluatorConfig {
  reelCount: number;
  minMatch: number;
  wildSymbol: string;
  paytable: { [symbolId: string]: { [matchCount: number]: number } };
}

export class MegawaysEvaluator extends SlotPlugin {
  private eventBus: EventBus;
  private config: MegawaysEvaluatorConfig;
  private mapper: MegawaysMapper;
  private currentReelHeights: number[] = [];
   private logger: Logger;

  constructor(config?: Partial<MegawaysEvaluatorConfig>) {
    super({
      id: 'winsystem-megaways',
      version: '1.0.0',
      priority: PluginPriority.HIGH,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
     this.logger = Logger.create('MegawaysEvaluator');
    this.config = {
      reelCount: config?.reelCount ?? 6,
      minMatch: config?.minMatch ?? 3,
      wildSymbol: config?.wildSymbol ?? 'W',
      paytable: config?.paytable ?? this.getDefaultPaytable(),
    };

    this.mapper = new MegawaysMapper({
      reelCount: this.config.reelCount,
    });
  }

  private getDefaultPaytable(): { [symbolId: string]: { [matchCount: number]: number } } {
    return {
      'A': { 3: 1, 4: 2, 5: 5, 6: 10 },
      'B': { 3: 0.8, 4: 1.5, 5: 4, 6: 8 },
      'C': { 3: 0.6, 4: 1, 5: 3, 6: 6 },
      'D': { 3: 0.4, 4: 0.8, 5: 2, 6: 4 },
      'E': { 3: 0.3, 4: 0.6, 5: 1.5, 6: 3 },
      'W': { 3: 2, 4: 5, 5: 20, 6: 100 },
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
   * Set current reel heights for evaluation
   */
  public setReelHeights(heights: number[]): void {
    this.currentReelHeights = [...heights];
  }

  /**
   * Get total ways for current configuration
   */
  public getTotalWays(): number {
    return this.mapper.calculateWays(this.currentReelHeights);
  }

  /**
   * Evaluate megaways wins
   */
  public evaluate(symbols: string[][], bet: number): WinData[] {
    const wins: WinData[] = [];
    const reelHeights = this.currentReelHeights.length > 0 
      ? this.currentReelHeights 
      : symbols[0]?.map(() => symbols.length) ?? [];
     this.logger.debug(`Evaluating megaways wins, total ways: ${this.mapper.calculateWays(reelHeights)}, bet: ${bet}`);

    const wayResults = this.mapper.findWinningWays(symbols, reelHeights);

    for (const wayResult of wayResults) {
      const win = this.evaluateWay(wayResult, bet);
      if (win) {
        wins.push(win);
      }
    }

     this.logger.debug(`Found ${wins.length} megaways wins`);
    return wins;
  }

  private evaluateWay(wayResult: WayResult, bet: number): WinData | null {
    const symbolPaytable = this.config.paytable[wayResult.symbolId];
    if (!symbolPaytable || !symbolPaytable[wayResult.length]) return null;

    const basePay = symbolPaytable[wayResult.length];
    const amount = basePay * bet;

    const positions = wayResult.positions.map(p => ({
      row: p.row,
      col: p.reel,
    }));

    return {
      lineId: -1,
      symbols: positions.map(() => wayResult.symbolId),
      positions,
      amount,
      multiplier: 1,
    };
  }

  public setConfig(config: Partial<MegawaysEvaluatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
