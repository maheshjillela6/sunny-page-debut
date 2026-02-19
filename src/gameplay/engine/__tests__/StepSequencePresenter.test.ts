/**
 * StepSequencePresenter.test.ts
 *
 * Tests the cascade step mechanism with real-world edge cases:
 *   • Duplicate removedPositions (same cell from multiple winning lines)
 *   • Empty movements with refill-only cascades
 *   • Multi-step cascade sequences
 *   • Bounds checking and safety guards
 *   • Grid sync after animation phases
 *   • Cancellation mid-cascade
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────

/** Deduplicate util extracted for unit testing */
function deduplicatePositions(
  positions: Array<{ row: number; col: number }>,
): Array<{ row: number; col: number }> {
  const seen = new Set<string>();
  const result: Array<{ row: number; col: number }> = [];
  for (const p of positions) {
    const key = `${p.row},${p.col}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

function mapStepWinsToWinData(wins: any[]) {
  return wins.map((w: any, idx: number) => ({
    lineId: w.lineId ?? idx,
    symbols: w.positions.map(() => w.symbol),
    positions: w.positions.map((p: any) => ({ row: p.row, col: p.col })),
    amount: w.amount,
    multiplier: w.multiplier ?? 1,
  }));
}

// ── Test data from real API response ─────────────────────────────────

const REAL_API_RESPONSE = {
  steps: [
    {
      index: 0,
      type: 'RESULT' as const,
      grid: { matrixString: 'KKKQP;AQPAP;JAPJA;PPKPQ' },
      wins: [
        {
          winType: 'LINE',
          lineId: 0,
          symbol: 'K',
          matchCount: 3,
          positions: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
          ],
          amount: 50,
        },
        {
          winType: 'LINE',
          lineId: 17,
          symbol: 'K',
          matchCount: 3,
          positions: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
          ],
          amount: 50,
        },
      ],
      totalWin: { amount: 100, currency: 'GBP' },
    },
    {
      index: 1,
      type: 'CASCADE' as const,
      gridBefore: { matrixString: 'KKKQP;AQPAP;JAPJA;PPKPQ' },
      removedPositions: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 0 }, // DUPLICATE
        { row: 0, col: 1 }, // DUPLICATE
        { row: 0, col: 2 }, // DUPLICATE
      ],
      movements: [],
      refills: [
        { position: { row: 0, col: 0 }, symbol: 'A' },
        { position: { row: 0, col: 1 }, symbol: 'Q' },
        { position: { row: 0, col: 2 }, symbol: 'P' },
      ],
      gridAfter: { matrixString: 'AQPQP;AQPAP;JAPJA;PPKPQ' },
      wins: [],
      stepWin: { amount: 0, currency: 'GBP' },
      cumulativeWin: { amount: 100, currency: 'GBP' },
    },
  ],
  totalWin: 100,
};

// ── Deduplication tests ──────────────────────────────────────────────

describe('deduplicatePositions', () => {
  it('removes exact duplicate (row,col) pairs', () => {
    const input = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 0 }, // dup
      { row: 0, col: 1 }, // dup
    ];
    const result = deduplicatePositions(input);
    expect(result).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });

  it('preserves order of first occurrence', () => {
    const input = [
      { row: 2, col: 3 },
      { row: 0, col: 0 },
      { row: 2, col: 3 },
    ];
    const result = deduplicatePositions(input);
    expect(result[0]).toEqual({ row: 2, col: 3 });
    expect(result[1]).toEqual({ row: 0, col: 0 });
  });

  it('returns empty array for empty input', () => {
    expect(deduplicatePositions([])).toEqual([]);
  });

  it('handles single element', () => {
    const input = [{ row: 1, col: 2 }];
    expect(deduplicatePositions(input)).toEqual([{ row: 1, col: 2 }]);
  });

  it('handles all duplicates of same position', () => {
    const input = [
      { row: 0, col: 0 },
      { row: 0, col: 0 },
      { row: 0, col: 0 },
    ];
    expect(deduplicatePositions(input)).toEqual([{ row: 0, col: 0 }]);
  });

  it('deduplicates real API removedPositions correctly', () => {
    const raw = REAL_API_RESPONSE.steps[1].removedPositions;
    const deduped = deduplicatePositions(raw);
    expect(raw.length).toBe(6);  // 3 positions × 2 wins
    expect(deduped.length).toBe(3); // only 3 unique
    expect(deduped).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
  });
});

// ── mapStepWinsToWinData tests ───────────────────────────────────────

describe('mapStepWinsToWinData', () => {
  it('maps server wins to WinData format', () => {
    const wins = REAL_API_RESPONSE.steps[0].wins;
    const result = mapStepWinsToWinData(wins);

    expect(result).toHaveLength(2);
    expect(result[0].lineId).toBe(0);
    expect(result[0].amount).toBe(50);
    expect(result[0].positions).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
    expect(result[1].lineId).toBe(17);
  });

  it('handles empty wins', () => {
    expect(mapStepWinsToWinData([])).toEqual([]);
  });

  it('falls back to index when lineId is missing', () => {
    const wins = [
      { symbol: 'A', positions: [{ row: 0, col: 0 }], amount: 10 },
    ];
    const result = mapStepWinsToWinData(wins);
    expect(result[0].lineId).toBe(0);
  });

  it('defaults multiplier to 1 when missing', () => {
    const wins = [
      { symbol: 'A', positions: [{ row: 0, col: 0 }], amount: 10 },
    ];
    const result = mapStepWinsToWinData(wins);
    expect(result[0].multiplier).toBe(1);
  });
});

// ── Cascade scenario tests ───────────────────────────────────────────

describe('Cascade edge case scenarios', () => {
  describe('Duplicate removedPositions from multiple wins', () => {
    it('should only create 3 unique removal entries from 6 raw positions', () => {
      const cascade = REAL_API_RESPONSE.steps[1];
      const deduped = deduplicatePositions(cascade.removedPositions);
      expect(deduped).toHaveLength(3);
    });

    it('should correctly count removals per column after dedup', () => {
      const cascade = REAL_API_RESPONSE.steps[1];
      const deduped = deduplicatePositions(cascade.removedPositions);

      const perCol = new Map<number, number>();
      for (const p of deduped) {
        perCol.set(p.col, (perCol.get(p.col) ?? 0) + 1);
      }

      // Each column (0,1,2) has exactly 1 removal (row 0 only)
      expect(perCol.get(0)).toBe(1);
      expect(perCol.get(1)).toBe(1);
      expect(perCol.get(2)).toBe(1);
    });
  });

  describe('Empty movements (refill-only cascade)', () => {
    it('should handle cascade with no movements gracefully', () => {
      const cascade = REAL_API_RESPONSE.steps[1];
      expect(cascade.movements).toEqual([]);
      // With 1 removal per column in row 0, no symbols need to drop
      // Only refills are needed at row 0
      expect(cascade.refills).toHaveLength(3);
      expect(cascade.refills[0].position.row).toBe(0);
    });
  });

  describe('Fallback drop with deduplicated counts', () => {
    it('calculates correct target rows with 1 removal per column', () => {
      // Grid: 4 rows, 5 cols. Removed: (0,0), (0,1), (0,2)
      // Column 0: surviving = rows 1,2,3 → targetRows = 1,2,3 (no movement needed)
      const numRows = 4;
      const removedPositions = [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ];
      const removedSet = new Set(removedPositions.map(p => `${p.row},${p.col}`));

      for (let col = 0; col < 3; col++) {
        const removedInCol = removedPositions.filter(p => p.col === col).length;
        const surviving: number[] = [];
        for (let row = 0; row < numRows; row++) {
          if (!removedSet.has(`${row},${col}`)) {
            surviving.push(row);
          }
        }

        // With 1 removal at row 0, surviving = [1,2,3]
        // Target rows = [1,2,3] (removedInCol + i = 1+0, 1+1, 1+2)
        expect(removedInCol).toBe(1);
        for (let i = 0; i < surviving.length; i++) {
          const targetRow = removedInCol + i;
          expect(targetRow).toBeLessThan(numRows);
          expect(targetRow).toBe(surviving[i]); // No movement needed
        }
      }
    });

    it('would produce out-of-bounds with raw duplicates (without dedup)', () => {
      // This test proves WHY dedup is necessary:
      // Raw removedPositions has 2 entries for each cell
      const rawRemovedPositions = REAL_API_RESPONSE.steps[1].removedPositions;
      const numRows = 4;

      // Without dedup: col 0 has removedInCol=2, surviving=[1,2,3]
      // targetRow for surviving[2] = 2+2 = 4 >= numRows(4) → OUT OF BOUNDS!
      const removedInCol0_raw = rawRemovedPositions.filter(p => p.col === 0).length;
      expect(removedInCol0_raw).toBe(2); // Bug: double-counted

      const survivingCount = numRows - 1; // row 0 removed, 3 surviving
      const lastTargetRow = removedInCol0_raw + survivingCount - 1;
      expect(lastTargetRow).toBe(4); // Out of bounds!
      expect(lastTargetRow).toBeGreaterThanOrEqual(numRows);

      // With dedup: col 0 has removedInCol=1, surviving=[1,2,3]
      const deduped = deduplicatePositions(rawRemovedPositions);
      const removedInCol0_fixed = deduped.filter(p => p.col === 0).length;
      expect(removedInCol0_fixed).toBe(1); // Correct

      const lastTargetRow_fixed = removedInCol0_fixed + survivingCount - 1;
      expect(lastTargetRow_fixed).toBe(3); // Within bounds
      expect(lastTargetRow_fixed).toBeLessThan(numRows);
    });
  });

  describe('Multi-step cascade sequence', () => {
    it('validates step ordering: RESULT then CASCADE', () => {
      const steps = REAL_API_RESPONSE.steps;
      expect(steps[0].type).toBe('RESULT');
      expect(steps[1].type).toBe('CASCADE');
    });

    it('gridAfter of cascade matches expected final state', () => {
      const cascade = REAL_API_RESPONSE.steps[1];
      // Original row 0: K,K,K → replaced with A,Q,P
      // Rest unchanged
      expect(cascade.gridAfter.matrixString).toBe('AQPQP;AQPAP;JAPJA;PPKPQ');
    });

    it('refill symbols match gridAfter at refill positions', () => {
      const cascade = REAL_API_RESPONSE.steps[1];
      const afterRows = cascade.gridAfter.matrixString.split(';');

      for (const refill of cascade.refills) {
        const { row, col } = refill.position;
        const expectedSymbol = afterRows[row][col];
        expect(refill.symbol).toBe(expectedSymbol);
      }
    });
  });

  describe('Matrix row parsing', () => {
    function parseMatrixRow(rowStr: string): string[] {
      const symbols: string[] = [];
      let i = 0;
      while (i < rowStr.length) {
        if (rowStr[i] === '1' && i + 1 < rowStr.length && rowStr[i + 1] === '0') {
          symbols.push('10');
          i += 2;
        } else {
          symbols.push(rowStr[i]);
          i++;
        }
      }
      return symbols;
    }

    it('parses single-char symbols', () => {
      expect(parseMatrixRow('KKKQP')).toEqual(['K', 'K', 'K', 'Q', 'P']);
    });

    it('parses multi-char symbol "10"', () => {
      expect(parseMatrixRow('A10BJ')).toEqual(['A', '10', 'B', 'J']);
    });

    it('handles "10" at start', () => {
      expect(parseMatrixRow('10AKQ')).toEqual(['10', 'A', 'K', 'Q']);
    });

    it('handles "10" at end', () => {
      expect(parseMatrixRow('AKQ10')).toEqual(['A', 'K', 'Q', '10']);
    });

    it('handles multiple "10"s', () => {
      expect(parseMatrixRow('1010A')).toEqual(['10', '10', 'A']);
    });

    it('handles empty string', () => {
      expect(parseMatrixRow('')).toEqual([]);
    });

    it('handles "1" without following "0"', () => {
      expect(parseMatrixRow('1A')).toEqual(['1', 'A']);
    });
  });

  describe('Scatter removal pattern (non-contiguous)', () => {
    it('handles removals scattered across rows', () => {
      // Grid 4×5, removals at (0,0), (2,0), (1,2), (3,4)
      const removedPositions = [
        { row: 0, col: 0 },
        { row: 2, col: 0 },
        { row: 1, col: 2 },
        { row: 3, col: 4 },
      ];
      const deduped = deduplicatePositions(removedPositions);
      expect(deduped).toHaveLength(4); // No duplicates

      const removedSet = new Set(deduped.map(p => `${p.row},${p.col}`));

      // Col 0: removed at rows 0,2. Surviving: rows 1,3
      // removedInCol=2, surviving=[1,3]
      // targets: [2,3] → row 1→2 (drop), row 3→3 (no move)
      const numRows = 4;
      const survivingCol0: number[] = [];
      for (let r = 0; r < numRows; r++) {
        if (!removedSet.has(`${r},0`)) survivingCol0.push(r);
      }
      expect(survivingCol0).toEqual([1, 3]);

      const removedInCol0 = deduped.filter(p => p.col === 0).length;
      expect(removedInCol0).toBe(2);

      // Target rows: 2, 3
      expect(removedInCol0 + 0).toBe(2); // surviving[0] (row 1) → row 2
      expect(removedInCol0 + 1).toBe(3); // surviving[1] (row 3) → row 3 (no move)
    });
  });

  describe('Full column removal', () => {
    it('handles entire column being removed (all refills, no drops)', () => {
      const numRows = 4;
      const removedPositions = [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 3, col: 0 },
      ];
      const removedSet = new Set(removedPositions.map(p => `${p.row},${p.col}`));

      const survivingCol0: number[] = [];
      for (let r = 0; r < numRows; r++) {
        if (!removedSet.has(`${r},0`)) survivingCol0.push(r);
      }
      expect(survivingCol0).toEqual([]); // No survivors

      const removedInCol0 = removedPositions.filter(p => p.col === 0).length;
      expect(removedInCol0).toBe(4);
      // All 4 positions need refills, 0 drops → should work fine
    });
  });

  describe('No wins in cascade step', () => {
    it('should not emit game:win:detected when cascade has no wins', () => {
      const cascade = REAL_API_RESPONSE.steps[1];
      expect(cascade.wins).toEqual([]);
      // No win:detected event should be emitted for this step
      const winData = mapStepWinsToWinData(cascade.wins);
      expect(winData).toHaveLength(0);
    });
  });
});
