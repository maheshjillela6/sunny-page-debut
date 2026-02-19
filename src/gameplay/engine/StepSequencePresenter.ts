/**
 * StepSequencePresenter - Drives strict step-by-step presentation of spin results.
 *
 * After reels stop showing round.matrixString, this presenter processes each
 * step in order with strict phase sequencing:
 *
 *   RESULT → highlight wins, show step win amount (grid unchanged)
 *   CASCADE → removal → drop → refill → grid commit → cascade win highlight
 *
 * Maintains a mutable symbolMap[row][col] that tracks which PixiJS symbol
 * instance sits at each logical grid cell. The map is updated ONLY after
 * each animation phase completes — never at step start.
 *
 * Edge-case handling:
 *   • Duplicate removedPositions from multiple wins → deduplicated
 *   • Empty movements array with removals → fallback gravity derivation
 *   • Refill-only cascades (top-row removals, no drop needed)
 *   • Out-of-bounds row guards on derived movements
 *   • Safe symbol reuse pool with claimed-set tracking
 *
 * The total win popup is shown only after all steps finish.
 */

import { EventBus } from '../../platform/events/EventBus';
import { GridManager } from '../../presentation/grid/GridManager';
import { TweenFactory } from '../../runtime/animation/TweenFactory';
import type { SpinStep, ResultStep, CascadeStep, StepWinInfo } from '../../platform/networking/APIProtocol';
import type { WinData } from '../../platform/events/EventMap';
import { Logger } from '../../platform/logger/Logger';
import type { ConfigurableSymbolView } from '../../presentation/grid/symbols/ConfigurableSymbolView';

export interface StepPresentationConfig {
  /** Duration to display RESULT step wins before moving on (ms) */
  resultWinDisplayMs: number;
  /** Duration per payline in RESULT step (ms) */
  paylineStepMs: number;
  /** Removal animation duration (ms) */
  removalDurationMs: number;
  /** Drop/collapse animation duration (ms) */
  dropDurationMs: number;
  /** Refill drop-in animation duration (ms) */
  refillDurationMs: number;
  /** Stagger between refill symbols (ms) */
  refillStaggerMs: number;
  /** Pause after cascade win highlight before next step (ms) */
  cascadeWinDisplayMs: number;
}

const DEFAULT_CONFIG: StepPresentationConfig = {
  resultWinDisplayMs: 2000,
  paylineStepMs: 1500,
  removalDurationMs: 350,
  dropDurationMs: 400,
  refillDurationMs: 350,
  refillStaggerMs: 60,
  cascadeWinDisplayMs: 1500,
};

/**
 * Map server StepWinInfo[] to WinData[] that BaseScreen can highlight.
 */
export function mapStepWinsToWinData(wins: StepWinInfo[]): WinData[] {
  return wins.map((w, idx) => ({
    lineId: w.lineId ?? idx,
    symbols: w.positions.map(() => w.symbol),
    positions: w.positions.map(p => ({ row: p.row, col: p.col })),
    amount: w.amount,
    multiplier: w.multiplier ?? 1,
  }));
}

/** Internal type for the mutable symbol map */
type SymbolMap = (ConfigurableSymbolView | null)[][];

/** Position key for deduplication */
function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Deduplicate positions by (row,col). The server may send the same cell
 * multiple times when it belongs to multiple winning lines.
 */
function deduplicatePositions(
  positions: Array<{ row: number; col: number }>,
): Array<{ row: number; col: number }> {
  const seen = new Set<string>();
  const result: Array<{ row: number; col: number }> = [];
  for (const p of positions) {
    const key = posKey(p.row, p.col);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

export class StepSequencePresenter {
  private eventBus: EventBus;
  private logger = Logger.create('StepSequencePresenter');
  private config: StepPresentationConfig;
  private isRunning = false;
  private isCancelled = false;

  /** Mutable map: symbolMap[row][col] = the PixiJS symbol instance at that cell */
  private symbolMap: SymbolMap = [];
  private numRows = 0;
  private numCols = 0;
  private cellHeight = 0;

  constructor(config?: Partial<StepPresentationConfig>) {
    this.eventBus = EventBus.getInstance();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  // ── Entry point ─────────────────────────────────────────────────────

  public async execute(
    steps: SpinStep[],
    totalWin: number,
    bet: number,
  ): Promise<void> {
    if (steps.length === 0) return;

    this.isRunning = true;
    this.isCancelled = false;

    // Build the initial symbolMap from the current grid state
    this.buildSymbolMap();

    this.logger.info(`Starting step sequence: ${steps.length} steps, totalWin: ${totalWin}`);

    for (let i = 0; i < steps.length; i++) {
      if (this.isCancelled) break;

      const step = steps[i];

      if (step.type === 'RESULT') {
        await this.presentResultStep(step, bet);
      } else if (step.type === 'CASCADE') {
        await this.presentCascadeStep(step, bet);
      }

      this.logger.debug(`Step ${i} complete`);
    }

    // Clear per-step highlights
    this.eventBus.emit('game:win:interrupted', undefined as any);

    // Win presentation and total count-up are now owned by
    // ResultPresentationController — do NOT emit game:win or
    // wallet:win:counter:start here.

    this.isRunning = false;
    this.symbolMap = [];
    this.logger.info('Step sequence complete');
  }

  // ── Build symbol map from current grid ──────────────────────────────

  private buildSymbolMap(): void {
    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;

    const gridConfig = grid.getConfig();
    this.numRows = gridConfig.rows;
    this.numCols = gridConfig.cols;
    this.cellHeight = gridConfig.cellHeight + gridConfig.spacing;

    const reels = grid.getReels();
    this.symbolMap = [];

    for (let row = 0; row < this.numRows; row++) {
      this.symbolMap[row] = [];
      for (let col = 0; col < this.numCols; col++) {
        const reel = reels[col];
        // symbols array: index 0 = buffer above, 1..rows = visible cells
        const sym = reel ? reel.getSymbols()[1 + row] : null;
        this.symbolMap[row][col] = sym ?? null;
      }
    }

    this.logger.debug(`Symbol map built: ${this.numRows}×${this.numCols}`);
  }

  /** Get the canonical Y position for a row */
  private rowToY(row: number): number {
    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return 0;
    const cfg = grid.getConfig();
    return row * (cfg.cellHeight + cfg.spacing) + cfg.cellHeight / 2;
  }

  // ── RESULT step ─────────────────────────────────────────────────────

  private async presentResultStep(step: ResultStep, bet: number): Promise<number> {
    const wins = mapStepWinsToWinData(step.wins);
    const stepWin = step.totalWin.amount;

    if (wins.length === 0) return 0;

    this.logger.info(`RESULT step: ${wins.length} wins, total: ${stepWin}`);

    // Emit STEP_GRID_COMMITTED — the grid for a RESULT step is the initial
    // matrix that is already displayed after reel stop.
    const matrixString = step.grid?.matrixString ?? '';
    this.eventBus.emit('result:step:grid:committed', {
      resultFlowId: '',
      spinId: '',
      stepIndex: 0,
      stepType: 'RESULT' as const,
      matrixString,
    });
    this.logger.debug(`STEP_GRID_COMMITTED (RESULT): ${matrixString.substring(0, 30)}`);

    // Only emit game:win:detected AFTER grid commit.
    // game:win is owned exclusively by ResultPresentationController.
    this.eventBus.emit('game:win:detected', { wins, totalWin: stepWin });

    const displayTime = Math.max(
      this.config.resultWinDisplayMs,
      wins.length * this.config.paylineStepMs,
    );
    await this.delay(displayTime);

    return stepWin;
  }

  // ── CASCADE step ────────────────────────────────────────────────────

  /**
   * Full cascade step with strict phase ordering:
   *   REMOVAL → DROP → REFILL → COMMIT_GRID → HIGHLIGHT_PAYLINES
   *
   * All input data (removedPositions) is deduplicated up front.
   */
  private async presentCascadeStep(step: CascadeStep, bet: number): Promise<number> {
    // ── Deduplicate removedPositions ───────────────────────────────────
    // The server may include the same cell multiple times when it appears
    // in multiple winning lines. We must deduplicate to avoid:
    //   • Double tweens on the same symbol
    //   • Incorrect removedInCol count in fallback drop logic
    const uniqueRemovedPositions = deduplicatePositions(step.removedPositions);

    this.logger.info(
      `CASCADE step ${step.index}: ` +
      `remove=${uniqueRemovedPositions.length} (raw: ${step.removedPositions.length}), ` +
      `movements=${step.movements?.length ?? 0}, refill=${step.refills.length}`
    );

    // ── Phase 1: Removal ──────────────────────────────────────────────
    await this.phaseRemoval(uniqueRemovedPositions);
    if (this.isCancelled) return step.cumulativeWin.amount;

    // ── Phase 2: Drop (collapse existing symbols) ─────────────────────
    await this.phaseDrop(step, uniqueRemovedPositions);
    if (this.isCancelled) return step.cumulativeWin.amount;

    // ── Phase 3: Refill (new symbols from top) ────────────────────────
    await this.phaseRefill(step);
    if (this.isCancelled) return step.cumulativeWin.amount;

    // ── Phase 4: COMMIT_GRID_STATE → HIGHLIGHT_PAYLINES ──────────────
    // Clear previous step's win highlights AFTER all animations finish,
    // right before committing the new grid and showing new wins.
    this.eventBus.emit('game:win:interrupted', undefined as any);

    // Synchronize the symbolMap to match the server's gridAfter state.
    // This corrects any drift from animation phases.
    this.syncSymbolMapToMatrix(step.gridAfter?.matrixString ?? '');

    // Emit the factual STEP_GRID_COMMITTED milestone BEFORE any highlight.
    const cascadeMatrix = step.gridAfter?.matrixString ?? '';
    this.eventBus.emit('result:step:grid:committed', {
      resultFlowId: '',
      spinId: '',
      stepIndex: step.index,
      stepType: 'CASCADE' as const,
      matrixString: cascadeMatrix,
    });
    this.logger.debug(
      `STEP_GRID_COMMITTED (CASCADE step ${step.index}): ${cascadeMatrix.substring(0, 30)}`
    );

    const cascadeWins = mapStepWinsToWinData(step.wins);

    if (cascadeWins.length > 0) {
      this.debugValidateWinPositions(step.index, cascadeWins, cascadeMatrix);

      this.eventBus.emit('game:win:detected', {
        wins: cascadeWins,
        totalWin: step.cumulativeWin.amount,
      });

      await this.delay(this.config.cascadeWinDisplayMs);
    }

    return step.cumulativeWin.amount;
  }

  // ── Phase: Removal ──────────────────────────────────────────────────

  /**
   * Fade out + scale down removed symbols. Uses already-deduplicated positions
   * so each symbol gets exactly one tween.
   */
  private async phaseRemoval(
    uniquePositions: Array<{ row: number; col: number }>,
  ): Promise<void> {
    if (uniquePositions.length === 0) return;

    const durationSec = this.config.removalDurationMs / 1000;
    const promises: Promise<void>[] = [];

    this.logger.debug(`Removal phase: ${uniquePositions.length} unique symbols`);

    for (const pos of uniquePositions) {
      // Bounds check
      if (pos.row < 0 || pos.row >= this.numRows || pos.col < 0 || pos.col >= this.numCols) {
        this.logger.warn(`Removal out of bounds: (${pos.row},${pos.col})`);
        continue;
      }

      const symbol = this.symbolMap[pos.row]?.[pos.col];
      if (!symbol) {
        this.logger.warn(`No symbol at (${pos.row},${pos.col}) for removal`);
        continue;
      }

      // Kill any existing tweens on this symbol to prevent conflicts
      TweenFactory.kill(symbol);

      promises.push(new Promise<void>(resolve => {
        TweenFactory.to(symbol, {
          alpha: 0,
          duration: durationSec,
          ease: 'power2.in',
          onComplete: resolve,
        });
        TweenFactory.to(symbol.scale, {
          x: 0.3, y: 0.3,
          duration: durationSec,
          ease: 'power2.in',
        });
      }));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    // Update symbolMap: clear removed positions and hide symbols
    for (const pos of uniquePositions) {
      const symbol = this.symbolMap[pos.row]?.[pos.col];
      if (symbol) {
        symbol.visible = false;
        symbol.alpha = 0;
      }
      if (this.symbolMap[pos.row]) {
        this.symbolMap[pos.row][pos.col] = null;
      }
    }

    this.logger.debug('Removal phase complete');
  }

  // ── Phase: Drop (collapse) ──────────────────────────────────────────

  /**
   * Move surviving symbols down to fill gaps left by removal.
   *
   * Uses server movements when available. Falls back to gravity derivation
   * using the deduplicated removed positions.
   */
  private async phaseDrop(
    step: CascadeStep,
    uniqueRemovedPositions: Array<{ row: number; col: number }>,
  ): Promise<void> {
    const durationSec = this.config.dropDurationMs / 1000;

    // ── Server-provided movements ─────────────────────────────────────
    if (step.movements && step.movements.length > 0) {
      this.logger.debug(`Drop phase: ${step.movements.length} server movements`);

      // Deduplicate movements too (just in case)
      const seenMoves = new Set<string>();
      const uniqueMovements = step.movements.filter(mv => {
        const key = `${mv.from.row},${mv.from.col}->${mv.to.row},${mv.to.col}`;
        if (seenMoves.has(key)) return false;
        seenMoves.add(key);
        return true;
      });

      // Collect all movements first, then apply map changes after
      const moveOps: Array<{
        symbol: ConfigurableSymbolView;
        fromRow: number;
        fromCol: number;
        toRow: number;
        toCol: number;
      }> = [];
      const promises: Promise<void>[] = [];

      for (const mv of uniqueMovements) {
        // Bounds check
        if (
          mv.from.row < 0 || mv.from.row >= this.numRows ||
          mv.from.col < 0 || mv.from.col >= this.numCols ||
          mv.to.row < 0 || mv.to.row >= this.numRows ||
          mv.to.col < 0 || mv.to.col >= this.numCols
        ) {
          this.logger.warn(`Movement out of bounds: (${mv.from.row},${mv.from.col}) → (${mv.to.row},${mv.to.col})`);
          continue;
        }

        const symbol = this.symbolMap[mv.from.row]?.[mv.from.col];
        if (!symbol || !symbol.visible) continue;

        const targetY = this.rowToY(mv.to.row);

        promises.push(new Promise<void>(resolve => {
          TweenFactory.to(symbol, {
            y: targetY,
            duration: durationSec,
            ease: 'bounce.out',
            onComplete: resolve,
          });
        }));

        moveOps.push({
          symbol,
          fromRow: mv.from.row,
          fromCol: mv.from.col,
          toRow: mv.to.row,
          toCol: mv.to.col,
        });
      }

      // Apply all map changes at once (prevents read-after-write hazards)
      for (const op of moveOps) {
        if (this.symbolMap[op.fromRow]) {
          this.symbolMap[op.fromRow][op.fromCol] = null;
        }
      }
      for (const op of moveOps) {
        if (!this.symbolMap[op.toRow]) this.symbolMap[op.toRow] = [];
        this.symbolMap[op.toRow][op.toCol] = op.symbol;
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
      this.logger.debug('Drop phase complete (server movements)');
      return;
    }

    // ── Fallback: derive movements from removed positions ─────────────
    this.logger.debug('Drop phase: deriving movements from removed positions');

    // Build a set of removed positions (already deduplicated)
    const removedSet = new Set(
      uniqueRemovedPositions.map(p => posKey(p.row, p.col)),
    );

    // Count unique removed cells per column
    const removedPerCol = new Map<number, number>();
    for (const p of uniqueRemovedPositions) {
      removedPerCol.set(p.col, (removedPerCol.get(p.col) ?? 0) + 1);
    }

    const moveOps: Array<{
      symbol: ConfigurableSymbolView;
      fromRow: number;
      col: number;
      toRow: number;
    }> = [];
    const promises: Promise<void>[] = [];

    // Process column by column
    for (let col = 0; col < this.numCols; col++) {
      const removedInCol = removedPerCol.get(col) ?? 0;
      if (removedInCol === 0) continue;

      // Collect surviving symbols in this column, top to bottom
      const surviving: Array<{ row: number; symbol: ConfigurableSymbolView }> = [];
      for (let row = 0; row < this.numRows; row++) {
        if (!removedSet.has(posKey(row, col)) && this.symbolMap[row]?.[col]) {
          surviving.push({ row, symbol: this.symbolMap[row][col]! });
        }
      }

      // Surviving symbols pack to the bottom.
      // gapCount = removedInCol, so first surviving symbol lands at row gapCount.
      for (let i = 0; i < surviving.length; i++) {
        const targetRow = removedInCol + i;

        // Safety: clamp to grid bounds
        if (targetRow >= this.numRows) {
          this.logger.warn(
            `Drop target out of bounds: col=${col}, targetRow=${targetRow} >= numRows=${this.numRows}. ` +
            `removedInCol=${removedInCol}, survivingCount=${surviving.length}`
          );
          break;
        }

        const { row: fromRow, symbol } = surviving[i];

        if (fromRow !== targetRow) {
          const targetY = this.rowToY(targetRow);

          promises.push(new Promise<void>(resolve => {
            TweenFactory.to(symbol, {
              y: targetY,
              duration: durationSec,
              ease: 'bounce.out',
              onComplete: resolve,
            });
          }));

          moveOps.push({ symbol, fromRow, col, toRow: targetRow });
        }
      }
    }

    // Apply all map changes at once
    for (const op of moveOps) {
      if (this.symbolMap[op.fromRow]) {
        this.symbolMap[op.fromRow][op.col] = null;
      }
    }
    for (const op of moveOps) {
      if (!this.symbolMap[op.toRow]) this.symbolMap[op.toRow] = [];
      this.symbolMap[op.toRow][op.col] = op.symbol;
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    this.logger.debug('Drop phase complete');
  }

  // ── Phase: Refill ───────────────────────────────────────────────────

  /**
   * Drop new symbols in from above the grid. Reuses hidden symbol
   * instances from the reel's pool (symbols made invisible during removal).
   *
   * Uses a claimed-set to prevent the same instance being reused for
   * multiple refill cells.
   */
  private async phaseRefill(step: CascadeStep): Promise<void> {
    if (step.refills.length === 0) return;

    const durationSec = this.config.refillDurationMs / 1000;
    const staggerMs = this.config.refillStaggerMs;

    this.logger.debug(`Refill phase: ${step.refills.length} symbols`);

    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;
    const reels = grid.getReels();

    // Track which symbol instances have already been claimed for refill
    const claimedSymbols = new Set<ConfigurableSymbolView>();
    const promises: Promise<void>[] = [];

    for (let i = 0; i < step.refills.length; i++) {
      const refill = step.refills[i];
      const { row, col } = refill.position;

      // Bounds check
      if (row < 0 || row >= this.numRows || col < 0 || col >= this.numCols) {
        this.logger.warn(`Refill position out of bounds: (${row},${col})`);
        continue;
      }

      const reel = reels[col];
      if (!reel) continue;

      // Find a hidden, unclaimed symbol in this reel to reuse
      let symbol: ConfigurableSymbolView | null = null;
      const reelSymbols = reel.getSymbols();

      for (const s of reelSymbols) {
        if (s.visible || s.alpha > 0) continue; // Still visible — skip
        if (claimedSymbols.has(s)) continue;     // Already taken — skip

        // Also verify it's not still in the symbolMap at any position
        let inMap = false;
        for (let r = 0; r < this.numRows; r++) {
          if (this.symbolMap[r]?.[col] === s) {
            inMap = true;
            break;
          }
        }
        if (inMap) continue;

        symbol = s;
        break;
      }

      if (!symbol) {
        // Last resort: use the symbol at the target position in the reel array
        // (index 1+row). Force-reclaim it even if visible — better than skipping.
        const fallbackSymbol = reelSymbols[1 + row];
        if (fallbackSymbol && !claimedSymbols.has(fallbackSymbol)) {
          symbol = fallbackSymbol;
          this.logger.warn(`Refill fallback: reusing reel symbol at index ${1 + row} for (${row},${col})`);
        }
      }

      if (!symbol) {
        this.logger.warn(`No reusable symbol for refill at (${row},${col})`);
        continue;
      }

      claimedSymbols.add(symbol);

      const targetY = this.rowToY(row);
      const entryY = targetY - this.cellHeight * 2; // Start 2 cells above
      const delay = i * staggerMs;

      // Place symbol in map
      if (!this.symbolMap[row]) this.symbolMap[row] = [];
      this.symbolMap[row][col] = symbol;

      promises.push(new Promise<void>(resolve => {
        setTimeout(() => {
          if (this.isCancelled) { resolve(); return; }

          // Kill any lingering tweens from previous phases
          TweenFactory.kill(symbol!);

          symbol!.setSymbolId(refill.symbol);
          symbol!.visible = true;
          symbol!.alpha = 0;
          symbol!.scale.set(0.82);
          symbol!.y = entryY;

          TweenFactory.to(symbol!, {
            y: targetY,
            alpha: 1,
            duration: durationSec,
            ease: 'back.out(1.2)',
            onComplete: resolve,
          });
        }, delay);
      }));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
    this.logger.debug('Refill phase complete');
  }

  // ── Grid sync ──────────────────────────────────────────────────────

  /**
   * After all animation phases, synchronize the symbolMap and the actual
   * grid symbol views to match the server's expected matrix state.
   * This corrects any drift caused by animation glitches or edge cases.
   */
  private syncSymbolMapToMatrix(matrixString: string): void {
    if (!matrixString) return;

    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;
    const reels = grid.getReels();

    const rows = matrixString.split(';');
    const gridConfig = grid.getConfig();

    for (let rowIdx = 0; rowIdx < rows.length && rowIdx < this.numRows; rowIdx++) {
      const symbolIds = this.parseMatrixRow(rows[rowIdx]);
      for (let col = 0; col < symbolIds.length && col < this.numCols; col++) {
        const expectedId = symbolIds[col];
        const reel = reels[col];
        if (!reel) continue;

        const symbol = reel.getSymbols()[1 + rowIdx];
        if (!symbol) continue;

        // Ensure the symbol has the correct ID
        if (symbol.getSymbolId() !== expectedId) {
          symbol.setSymbolId(expectedId);
        }

        // Ensure visibility
        symbol.visible = true;
        symbol.alpha = 1;
        symbol.scale.set(0.82);

        // Ensure canonical Y position
        const canonicalY = rowIdx * (gridConfig.cellHeight + gridConfig.spacing) + gridConfig.cellHeight / 2;
        // Only snap if significantly drifted (allow minor tween residue)
        if (Math.abs(symbol.y - canonicalY) > 2) {
          symbol.y = canonicalY;
        }

        // Sync symbolMap
        if (!this.symbolMap[rowIdx]) this.symbolMap[rowIdx] = [];
        this.symbolMap[rowIdx][col] = symbol;
      }
    }

    this.logger.debug(`Symbol map synced to matrix: ${matrixString.substring(0, 30)}`);
  }

  /** Parse a matrix row handling multi-char symbols like "10" */
  private parseMatrixRow(rowStr: string): string[] {
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

  // ── Debug validation ─────────────────────────────────────────────────

  /**
   * Log each win position against the live grid to verify the highlight
   * will pass through the correct symbols.
   */
  private debugValidateWinPositions(
    stepIndex: number,
    wins: WinData[],
    matrixString: string,
  ): void {
    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;
    const reels = grid.getReels();

    for (const win of wins) {
      for (const pos of win.positions) {
        const reel = reels[pos.col];
        const sym = reel ? reel.getSymbols()[1 + pos.row] : null;
        const liveId = sym?.getSymbolId() ?? '?';
        const livePos = sym ? `(${sym.x.toFixed(0)},${sym.y.toFixed(0)})` : 'n/a';
        this.logger.debug(
          `Step ${stepIndex} validate: win line ${win.lineId} pos (${pos.row},${pos.col}) → ` +
          `liveSymbol=${liveId} @ ${livePos}`
        );
      }
    }
  }

  // ── Utils ───────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    if (ms <= 0 || this.isCancelled) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public destroy(): void {
    this.cancel();
    this.symbolMap = [];
  }
}
