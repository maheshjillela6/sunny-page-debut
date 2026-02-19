/**
 * ClusterResolver - Finds connected clusters of matching symbols
 */

export interface ClusterConfig {
  minClusterSize: number;
  allowDiagonal: boolean;
}

export interface ClusterResult {
  clusters: number[][];
  totalClustered: number;
  symbolCounts: Map<string, number>;
}

export class ClusterResolver {
  private config: ClusterConfig;

  constructor(config: Partial<ClusterConfig> = {}) {
    this.config = {
      minClusterSize: config.minClusterSize ?? 5,
      allowDiagonal: config.allowDiagonal ?? false,
    };
  }

  /**
   * Find all clusters in a symbol grid
   */
  public findClusters(grid: string[][], rows: number, cols: number): ClusterResult {
    const visited = new Set<string>();
    const clusters: number[][] = [];
    const symbolCounts = new Map<string, number>();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const key = `${row},${col}`;
        if (visited.has(key)) continue;

        const symbolId = grid[row][col];
        const cluster = this.floodFill(grid, row, col, rows, cols, symbolId, visited);

        if (cluster.length >= this.config.minClusterSize) {
          clusters.push(cluster);
          symbolCounts.set(symbolId, (symbolCounts.get(symbolId) ?? 0) + cluster.length);
        }
      }
    }

    return {
      clusters,
      totalClustered: clusters.reduce((sum, c) => sum + c.length, 0),
      symbolCounts,
    };
  }

  /**
   * Flood fill algorithm to find connected symbols
   */
  private floodFill(
    grid: string[][],
    startRow: number,
    startCol: number,
    rows: number,
    cols: number,
    targetSymbol: string,
    visited: Set<string>
  ): number[] {
    const cluster: number[] = [];
    const stack: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }];

    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      const key = `${row},${col}`;

      if (visited.has(key)) continue;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (grid[row][col] !== targetSymbol) continue;

      visited.add(key);
      cluster.push(row * cols + col); // Convert to linear index

      // Add adjacent cells
      stack.push({ row: row - 1, col }); // Up
      stack.push({ row: row + 1, col }); // Down
      stack.push({ row, col: col - 1 }); // Left
      stack.push({ row, col: col + 1 }); // Right

      if (this.config.allowDiagonal) {
        stack.push({ row: row - 1, col: col - 1 }); // Top-left
        stack.push({ row: row - 1, col: col + 1 }); // Top-right
        stack.push({ row: row + 1, col: col - 1 }); // Bottom-left
        stack.push({ row: row + 1, col: col + 1 }); // Bottom-right
      }
    }

    return cluster;
  }

  /**
   * Convert linear indices to grid positions
   */
  public indicesToPositions(indices: number[], cols: number): Array<{ row: number; col: number }> {
    return indices.map(index => ({
      row: Math.floor(index / cols),
      col: index % cols,
    }));
  }

  /**
   * Check if two positions are adjacent
   */
  public areAdjacent(pos1: { row: number; col: number }, pos2: { row: number; col: number }): boolean {
    const rowDiff = Math.abs(pos1.row - pos2.row);
    const colDiff = Math.abs(pos1.col - pos2.col);

    if (this.config.allowDiagonal) {
      return rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0);
    }

    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  }

  public setConfig(config: Partial<ClusterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
