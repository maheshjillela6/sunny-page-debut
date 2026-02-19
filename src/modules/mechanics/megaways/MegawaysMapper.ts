/**
 * MegawaysMapper - Maps dynamic reel configurations to ways
 */

export interface MegawaysConfig {
  minSymbolsPerReel: number;
  maxSymbolsPerReel: number;
  reelCount: number;
}

export interface WayResult {
  positions: Array<{ reel: number; row: number }>;
  symbolId: string;
  length: number;
}

export class MegawaysMapper {
  private config: MegawaysConfig;

  constructor(config: Partial<MegawaysConfig> = {}) {
    this.config = {
      minSymbolsPerReel: config.minSymbolsPerReel ?? 2,
      maxSymbolsPerReel: config.maxSymbolsPerReel ?? 7,
      reelCount: config.reelCount ?? 6,
    };
  }

  /**
   * Calculate total ways for given reel heights
   */
  public calculateWays(reelHeights: number[]): number {
    return reelHeights.reduce((ways, height) => ways * height, 1);
  }

  /**
   * Generate random reel heights
   */
  public generateReelHeights(): number[] {
    const heights: number[] = [];
    for (let i = 0; i < this.config.reelCount; i++) {
      const range = this.config.maxSymbolsPerReel - this.config.minSymbolsPerReel + 1;
      const height = this.config.minSymbolsPerReel + Math.floor(Math.random() * range);
      heights.push(height);
    }
    return heights;
  }

  /**
   * Find all winning ways in the grid
   */
  public findWinningWays(grid: string[][], reelHeights: number[]): WayResult[] {
    const results: WayResult[] = [];
    const reelCount = grid[0]?.length ?? 0;

    if (reelCount === 0) return results;

    // Get all symbols on the first reel
    const firstReelSymbols = new Set<string>();
    for (let row = 0; row < reelHeights[0]; row++) {
      if (grid[row]?.[0]) {
        firstReelSymbols.add(grid[row][0]);
      }
    }

    // For each starting symbol, find all ways
    for (const targetSymbol of firstReelSymbols) {
      const ways = this.findWaysForSymbol(grid, reelHeights, targetSymbol);
      results.push(...ways);
    }

    return results;
  }

  /**
   * Find all ways for a specific symbol
   */
  private findWaysForSymbol(grid: string[][], reelHeights: number[], targetSymbol: string): WayResult[] {
    const reelCount = grid[0]?.length ?? 0;
    const reelPositions: Array<Array<{ reel: number; row: number }>> = [];

    // Find matching positions on each reel
    for (let reel = 0; reel < reelCount; reel++) {
      const positions: Array<{ reel: number; row: number }> = [];
      for (let row = 0; row < reelHeights[reel]; row++) {
        if (grid[row]?.[reel] === targetSymbol) {
          positions.push({ reel, row });
        }
      }
      reelPositions.push(positions);
    }

    // Build ways from left to right
    const ways: WayResult[] = [];
    let currentWay: Array<{ reel: number; row: number }> = [];
    
    for (let reel = 0; reel < reelCount; reel++) {
      if (reelPositions[reel].length === 0) {
        // No matching symbol on this reel, way ends here
        if (currentWay.length >= 3) {
          ways.push({
            positions: [...currentWay],
            symbolId: targetSymbol,
            length: currentWay.length,
          });
        }
        break;
      }

      // Add first matching position (simplified - real implementation would track all paths)
      currentWay.push(reelPositions[reel][0]);
    }

    // Add final way if valid
    if (currentWay.length >= 3) {
      ways.push({
        positions: currentWay,
        symbolId: targetSymbol,
        length: currentWay.length,
      });
    }

    return ways;
  }

  /**
   * Calculate payout multiplier based on way length
   */
  public getPayoutMultiplier(symbolId: string, length: number): number {
    // Base multipliers - should come from paytable
    const baseMultipliers: Record<number, number> = {
      3: 1,
      4: 2,
      5: 5,
      6: 10,
    };
    return baseMultipliers[length] ?? 0;
  }

  public setConfig(config: Partial<MegawaysConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
