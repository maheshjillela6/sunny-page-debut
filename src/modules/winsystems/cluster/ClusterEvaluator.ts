/**
 * ClusterEvaluator - Evaluates cluster wins
 */

import { SlotPlugin, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';
import { WinData } from '../../../platform/events/EventMap';
import { ClusterResolver, ClusterResult } from '../../mechanics/cluster/ClusterResolver';
 import { Logger } from '../../../platform/logger/Logger';

export interface ClusterEvaluatorConfig {
  minClusterSize: number;
  paytable: { [symbolId: string]: { [clusterSize: number]: number } };
  wildSymbol: string;
  allowDiagonal: boolean;
}

export class ClusterEvaluator extends SlotPlugin {
  private eventBus: EventBus;
  private config: ClusterEvaluatorConfig;
  private resolver: ClusterResolver;
   private logger: Logger;

  constructor(config?: Partial<ClusterEvaluatorConfig>) {
    super({
      id: 'winsystem-cluster',
      version: '1.0.0',
      priority: PluginPriority.HIGH,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
     this.logger = Logger.create('ClusterEvaluator');
    this.config = {
      minClusterSize: config?.minClusterSize ?? 5,
      paytable: config?.paytable ?? this.getDefaultPaytable(),
      wildSymbol: config?.wildSymbol ?? 'W',
      allowDiagonal: config?.allowDiagonal ?? false,
    };

    this.resolver = new ClusterResolver({
      minClusterSize: this.config.minClusterSize,
      allowDiagonal: this.config.allowDiagonal,
    });
  }

  private getDefaultPaytable(): { [symbolId: string]: { [clusterSize: number]: number } } {
    return {
      'A': { 5: 2, 6: 3, 7: 5, 8: 8, 9: 12, 10: 20 },
      'B': { 5: 1.5, 6: 2, 7: 4, 8: 6, 9: 10, 10: 15 },
      'C': { 5: 1, 6: 1.5, 7: 3, 8: 5, 9: 8, 10: 12 },
      'D': { 5: 0.8, 6: 1, 7: 2, 8: 4, 9: 6, 10: 10 },
      'E': { 5: 0.5, 6: 0.8, 7: 1.5, 8: 3, 9: 5, 10: 8 },
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
   * Evaluate cluster wins
   */
  public evaluate(symbols: string[][], bet: number): WinData[] {
    const wins: WinData[] = [];
    const rows = symbols.length;
    const cols = symbols[0]?.length ?? 0;
     this.logger.debug(`Evaluating cluster wins for ${cols}x${rows} grid, bet: ${bet}`);

    const result = this.resolver.findClusters(symbols, rows, cols);

    for (const cluster of result.clusters) {
      const positions = this.resolver.indicesToPositions(cluster, cols);
      const symbolId = symbols[positions[0].row][positions[0].col];
      
      const win = this.evaluateCluster(symbolId, cluster.length, positions, bet);
      if (win) {
        wins.push(win);
      }
    }

     this.logger.debug(`Found ${wins.length} cluster wins`);
    return wins;
  }

  private evaluateCluster(
    symbolId: string,
    clusterSize: number,
    positions: Array<{ row: number; col: number }>,
    bet: number
  ): WinData | null {
    const symbolPaytable = this.config.paytable[symbolId];
    if (!symbolPaytable) return null;

    // Find the highest matching payout tier
    let payout = 0;
    for (const [size, multiplier] of Object.entries(symbolPaytable)) {
      if (clusterSize >= parseInt(size) && multiplier > payout) {
        payout = multiplier;
      }
    }

    if (payout === 0) return null;

    const amount = payout * bet;

    return {
      lineId: -1, // Clusters don't use line IDs
      symbols: positions.map(() => symbolId),
      positions,
      amount,
      multiplier: 1,
    };
  }

  /**
   * Get cluster positions for removal/cascade
   */
  public getClusterPositions(symbols: string[][]): Array<Array<{ row: number; col: number }>> {
    const rows = symbols.length;
    const cols = symbols[0]?.length ?? 0;
    
    const result = this.resolver.findClusters(symbols, rows, cols);
    
    return result.clusters.map(cluster => 
      this.resolver.indicesToPositions(cluster, cols)
    );
  }

  public setConfig(config: Partial<ClusterEvaluatorConfig>): void {
    this.config = { ...this.config, ...config };
    this.resolver.setConfig({
      minClusterSize: this.config.minClusterSize,
      allowDiagonal: this.config.allowDiagonal,
    });
  }
}
