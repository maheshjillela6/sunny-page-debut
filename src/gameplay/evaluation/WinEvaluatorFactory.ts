/**
 * WinEvaluatorFactory - Creates win evaluators based on game config type
 * Loads paytable from game config files (symbols.config.json)
 */

import { IWinEvaluator, EvaluationConfig, EvaluationResult, EvaluatedWin } from '../interfaces/IWinEvaluator';
import { Position } from '../models/RoundModel';
import { LineEvaluator, PaylineDefinition, PayTable } from '@/modules/winsystems/paylines/LineEvaluator';
import { WaysEvaluator } from '@/modules/winsystems/ways/WaysEvaluator';
import { ClusterEvaluator } from '@/modules/winsystems/cluster/ClusterEvaluator';
import { MegawaysEvaluator } from '@/modules/winsystems/megaways/MegawaysEvaluator';
import { ConfigManager, SymbolDefinition } from '@/content/ConfigManager';
import { Logger } from '@/platform/logger/Logger';

export type EvaluatorType = 'lines' | 'ways' | 'cluster' | 'megaways';

/**
 * Build a paytable from symbol config PAYOUTS arrays
 * PAYOUTS format: [0-match, 1-match, 2-match, 3-match, 4-match, ...]
 */
function buildPaytableFromConfig(symbols: Record<string, SymbolDefinition>, minMatch: number): { [symbolId: string]: { [matchCount: number]: number } } {
  const paytable: { [symbolId: string]: { [matchCount: number]: number } } = {};

  for (const [id, sym] of Object.entries(symbols)) {
    if (!sym.payouts || sym.payouts.length === 0) continue;
    
    const symPayouts: { [matchCount: number]: number } = {};
    for (let i = minMatch; i < sym.payouts.length; i++) {
      if (sym.payouts[i] > 0) {
        symPayouts[i] = sym.payouts[i];
      }
    }
    
    if (Object.keys(symPayouts).length > 0) {
      paytable[id] = symPayouts;
    }
  }

  return paytable;
}

/**
 * Unified wrapper that adapts different evaluators to common interface
 */
class UnifiedWinEvaluator implements IWinEvaluator {
  public readonly id: string;
  public readonly type: EvaluatorType;
  
  private lineEvaluator: LineEvaluator | null = null;
  private waysEvaluator: WaysEvaluator | null = null;
  private clusterEvaluator: ClusterEvaluator | null = null;
  private megawaysEvaluator: MegawaysEvaluator | null = null;
  private logger: Logger;

  constructor(type: EvaluatorType, gameId: string) {
    this.id = `win-evaluator-${gameId}`;
    this.type = type;
    this.logger = Logger.create('WinEvaluator');
    
    this.initializeEvaluator(type);
  }

  private initializeEvaluator(type: EvaluatorType): void {
    const config = ConfigManager.getInstance().getConfig();
    const gridConfig = config?.manifest.grid;
    const minMatch = config?.manifest.paylines?.minMatch ?? 3;
    
    // Build paytable from symbols.config.json PAYOUTS
    const symbolMap = config?.symbolMap;
    const configPaytable = symbolMap?.symbols 
      ? buildPaytableFromConfig(symbolMap.symbols, minMatch) 
      : {};
    
    const wildSymbol = this.findWildSymbol(symbolMap?.symbols);
    
    this.logger.info(`Building paytable from config: ${Object.keys(configPaytable).length} symbols`);

    switch (type) {
      case 'lines': {
        // Build paylines from manifest definitions (flat indices) or symbolMap paylines
        const cols = gridConfig?.cols ?? 5;
        const manifestDefs = (config?.manifest.paylines as any)?.definitions as number[][] | undefined;
        const paylines = this.buildPaylinesFromDefinitions(manifestDefs, symbolMap?.paylines, cols, gridConfig?.rows ?? 3);
        this.lineEvaluator = new LineEvaluator({
          minMatch,
          paylines,
          paytable: configPaytable as PayTable,
          wildSymbol,
        });
        this.logger.info(`Initialized LineEvaluator with ${paylines.length} paylines`);
        break;
      }
        
      case 'ways':
        this.waysEvaluator = new WaysEvaluator({
          cols: gridConfig?.cols ?? 5,
          rows: gridConfig?.rows ?? 3,
          minMatch,
          paytable: configPaytable,
          wildSymbol,
        });
        this.logger.info('Initialized WaysEvaluator');
        break;
        
      case 'cluster':
        this.clusterEvaluator = new ClusterEvaluator({
          minClusterSize: minMatch,
          paytable: configPaytable,
          wildSymbol,
        });
        this.logger.info('Initialized ClusterEvaluator');
        break;
        
      case 'megaways':
        this.megawaysEvaluator = new MegawaysEvaluator({
          reelCount: gridConfig?.cols ?? 6,
          minMatch,
          paytable: configPaytable,
          wildSymbol,
        });
        this.logger.info('Initialized MegawaysEvaluator');
        break;
    }
  }

  private findWildSymbol(symbols?: Record<string, SymbolDefinition>): string {
    if (!symbols) return 'W';
    for (const [id, sym] of Object.entries(symbols)) {
      if (sym.substitutes === true) return id;
    }
    // Fallback: look for symbol named WILD or W
    if (symbols['WILD']) return 'WILD';
    if (symbols['W']) return 'W';
    return 'W';
  }

  /**
   * Build PaylineDefinitions from flat-index definitions (from manifest) or row-per-col arrays (from symbolMap).
   * Flat index format: each payline is [idx0, idx1, idx2, ...] where idx = row * cols + col.
   */
  private buildPaylinesFromDefinitions(
    flatDefs?: number[][],
    rowDefs?: number[][],
    cols: number = 5,
    rows: number = 3
  ): PaylineDefinition[] {
    // Prefer flat-index definitions from manifest
    if (flatDefs && flatDefs.length > 0) {
      return flatDefs.map((line, idx) => ({
        id: idx,
        positions: line.map(flatIdx => ({
          row: Math.floor(flatIdx / cols),
          col: flatIdx % cols,
        })),
      }));
    }
    // Fallback to row-per-col format from symbolMap
    if (rowDefs && rowDefs.length > 0) {
      return rowDefs.map((line, idx) => ({
        id: idx,
        positions: line.map((row, col) => ({ row, col })),
      }));
    }
    // Default: straight horizontal lines
    const defaults: PaylineDefinition[] = [];
    for (let row = 0; row < rows; row++) {
      defaults.push({
        id: row,
        positions: Array.from({ length: cols }, (_, col) => ({ row, col })),
      });
    }
    return defaults;
  }

  public evaluate(
    matrix: string[][],
    bet: number,
    _paytable: Map<string, number[]>,
    config?: EvaluationConfig
  ): EvaluationResult {
    let wins: EvaluatedWin[] = [];
    let totalWin = 0;

    this.logger.debug(`Evaluating ${this.type} wins for bet: ${bet}, matrix: ${matrix.length}x${matrix[0]?.length}`);

    try {
      switch (this.type) {
        case 'lines':
          if (this.lineEvaluator) {
            const lineWins = this.lineEvaluator.evaluate(matrix, bet);
            wins = this.convertWinDataToWinInfo(lineWins);
            totalWin = lineWins.reduce((sum, w) => sum + w.amount, 0);
          }
          break;
          
        case 'ways':
          if (this.waysEvaluator) {
            const waysWins = this.waysEvaluator.evaluate(matrix, bet);
            wins = this.convertWinDataToWinInfo(waysWins);
            totalWin = waysWins.reduce((sum, w) => sum + w.amount, 0);
          }
          break;
          
        case 'cluster':
          if (this.clusterEvaluator) {
            const clusterWins = this.clusterEvaluator.evaluate(matrix, bet);
            wins = this.convertWinDataToWinInfo(clusterWins);
            totalWin = clusterWins.reduce((sum, w) => sum + w.amount, 0);
          }
          break;
          
        case 'megaways':
          if (this.megawaysEvaluator) {
            if (config?.reelHeights) {
              this.megawaysEvaluator.setReelHeights(config.reelHeights);
            }
            const megawaysWins = this.megawaysEvaluator.evaluate(matrix, bet);
            wins = this.convertWinDataToWinInfo(megawaysWins);
            totalWin = megawaysWins.reduce((sum, w) => sum + w.amount, 0);
          }
          break;
      }
    } catch (error) {
      this.logger.error('Error evaluating wins', error);
    }

    const winType = this.determineWinType(totalWin, bet);
    
    this.logger.info(`Evaluation: ${wins.length} wins, total: ${totalWin.toFixed(2)}, type: ${winType}`);

    return {
      wins,
      totalWin,
      hasWin: totalWin > 0,
      winType,
    };
  }

  private convertWinDataToWinInfo(winData: { lineId: number; symbols: string[]; positions: { row: number; col: number }[]; amount: number; multiplier: number }[]): EvaluatedWin[] {
    return winData.map(w => ({
      lineId: w.lineId,
      symbols: w.symbols,
      positions: w.positions,
      amount: w.amount,
      multiplier: w.multiplier,
    }));
  }

  private determineWinType(totalWin: number, bet: number): 'normal' | 'big' | 'mega' | 'epic' {
    const multiplier = totalWin / bet;
    
    if (multiplier >= 50) return 'epic';
    if (multiplier >= 20) return 'mega';
    if (multiplier >= 10) return 'big';
    return 'normal';
  }

  public getWinningPositions(wins: EvaluatedWin[]): Position[] {
    const positions: Position[] = [];
    const seen = new Set<string>();
    
    for (const win of wins) {
      for (const pos of win.positions) {
        const key = `${pos.row}-${pos.col}`;
        if (!seen.has(key)) {
          seen.add(key);
          positions.push(pos);
        }
      }
    }
    
    return positions;
  }
}

/**
 * Factory to create appropriate evaluator based on game config
 */
export class WinEvaluatorFactory {
  private static evaluators: Map<string, IWinEvaluator> = new Map();
  private static logger = Logger.create('WinEvaluatorFactory');

  /**
   * Create or get cached evaluator for current game
   */
  public static create(gameId: string): IWinEvaluator {
    // Return cached
    if (this.evaluators.has(gameId)) {
      return this.evaluators.get(gameId)!;
    }

    const config = ConfigManager.getInstance().getConfig();
    const paylineType = config?.manifest.paylines?.type ?? 'ways';
    
    this.logger.info(`Creating ${paylineType} evaluator for game: ${gameId} (paytable from config)`);
    
    const evaluator = new UnifiedWinEvaluator(paylineType as EvaluatorType, gameId);
    this.evaluators.set(gameId, evaluator);
    
    return evaluator;
  }

  /**
   * Clear cached evaluators
   */
  public static clear(): void {
    this.evaluators.clear();
  }

  /**
   * Get evaluator for specific game
   */
  public static get(gameId: string): IWinEvaluator | null {
    return this.evaluators.get(gameId) ?? null;
  }
}

export default WinEvaluatorFactory;