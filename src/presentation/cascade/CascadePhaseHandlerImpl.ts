/**
 * CascadePhaseHandlerImpl - Concrete visual handler for cascade phases.
 *
 * Animates symbols on the grid during each cascade phase:
 *  - Win presentation: pulse/highlight winning symbols, dim others
 *  - Removal: fade out + scale down removed symbols
 *  - Collapse: move remaining symbols down to fill gaps
 *  - Refill: drop new symbols in from above the grid
 */

import type { ICascadePhaseHandler } from './CascadePresenter';
import type { CascadeStep } from './CascadeDataTypes';
import type {
  WinPresentationPhaseConfig,
  RemovalPhaseConfig,
  CollapsePhaseConfig,
  RefillPhaseConfig,
} from './CascadeConfigTypes';
import { GridManager } from '../grid/GridManager';
import { TweenFactory } from '../../runtime/animation/TweenFactory';
import { Logger } from '../../platform/logger/Logger';

export class CascadePhaseHandlerImpl implements ICascadePhaseHandler {
  private logger = Logger.create('CascadePhaseHandler');

  async onWinPresentation(
    step: CascadeStep,
    config: WinPresentationPhaseConfig,
  ): Promise<void> {
    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;

    const reels = grid.getReels();
    const winPositions = new Set<string>();

    for (const win of step.wins) {
      for (const pos of win.positions) {
        winPositions.add(`${pos.row},${pos.col}`);
      }
    }

    if (winPositions.size === 0) return;
    this.logger.debug(`Win presentation: ${winPositions.size} symbols`);

    // Dim non-winning symbols
    if (config.dimNonWinning) {
      const dimAlpha = config.dimAlpha ?? 0.3;
      for (const reel of reels) {
        const symbols = reel.getSymbols();
        const col = reel.getReelIndex();
        for (let row = 0; row < symbols.length - 2; row++) {
          const symbol = symbols[1 + row];
          if (symbol && !winPositions.has(`${row},${col}`)) {
            TweenFactory.play(symbol, { type: 'fadeOut', duration: 0.2 });
          }
        }
      }
    }

    // Pulse winning symbols
    const promises: Promise<void>[] = [];
    const staggerMs = config.staggerMs ?? 0;
    let idx = 0;
    const durationMs = config.animation.durationMs || 500;

    for (const key of winPositions) {
      const [row, col] = key.split(',').map(Number);
      const reel = reels[col];
      if (!reel) continue;
      const symbol = reel.getSymbols()[1 + row];
      if (!symbol) continue;

      const delay = idx * staggerMs;
      idx++;

      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            symbol.playWin('low');
            TweenFactory.play(symbol, {
              type: 'winPulse',
              duration: durationMs / 1000,
            });
            setTimeout(resolve, durationMs);
          }, delay);
        }),
      );
    }

    await Promise.all(promises);
  }

  async onRemoval(
    step: CascadeStep,
    config: RemovalPhaseConfig,
  ): Promise<void> {
    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;

    const reels = grid.getReels();
    if (step.removedPositions.length === 0) return;

    this.logger.debug(`Removal: ${step.removedPositions.length} symbols, style=${config.style}`);

    const promises: Promise<void>[] = [];
    const staggerMs = config.staggerMs ?? 0;
    const durationMs = config.animation.durationMs || 300;

    for (let i = 0; i < step.removedPositions.length; i++) {
      const pos = step.removedPositions[i];
      const reel = reels[pos.col];
      if (!reel) continue;
      const symbol = reel.getSymbols()[1 + pos.row];
      if (!symbol) continue;

      const delay = i * staggerMs;

      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            const tweenType = config.style === 'explode' ? 'zoomOut' : 'fadeOut';
            TweenFactory.play(symbol, {
              type: tweenType,
              duration: durationMs / 1000,
              scale: config.style === 'explode' ? 1.5 : 0.5,
            });
            setTimeout(resolve, durationMs);
          }, delay);
        }),
      );
    }

    await Promise.all(promises);

    // Hide removed symbols
    for (const pos of step.removedPositions) {
      const reel = reels[pos.col];
      if (!reel) continue;
      const symbol = reel.getSymbols()[1 + pos.row];
      if (symbol) {
        symbol.visible = false;
        symbol.alpha = 0;
      }
    }
  }

  async onCollapse(
    step: CascadeStep,
    config: CollapsePhaseConfig,
  ): Promise<void> {
    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;

    const reels = grid.getReels();
    const gridConfig = grid.getConfig();
    const cellHeight = gridConfig.cellHeight + gridConfig.spacing;

    if (step.movements.length === 0) return;
    this.logger.debug(`Collapse: ${step.movements.length} movements`);

    const durationMs = config.animation.durationMs || 400;
    const columnStaggerMs = config.columnStaggerMs ?? 0;
    const promises: Promise<void>[] = [];

    // Group by column
    const columnMovements = new Map<number, typeof step.movements>();
    for (const m of step.movements) {
      const arr = columnMovements.get(m.from.col) || [];
      arr.push(m);
      columnMovements.set(m.from.col, arr);
    }

    for (const [col, movements] of columnMovements) {
      const reel = reels[col];
      if (!reel) continue;
      const delay = col * columnStaggerMs;

      for (const movement of movements) {
        const symbol = reel.getSymbols()[1 + movement.from.row];
        if (!symbol || !symbol.visible) continue;

        const distance = (movement.to.row - movement.from.row) * cellHeight;

        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              TweenFactory.play(symbol, {
                type: 'drop',
                duration: durationMs / 1000,
                distance,
              });
              setTimeout(resolve, durationMs);
            }, delay);
          }),
        );
      }
    }

    await Promise.all(promises);
  }

  async onRefill(
    step: CascadeStep,
    config: RefillPhaseConfig,
  ): Promise<void> {
    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;

    const reels = grid.getReels();
    const gridConfig = grid.getConfig();
    const cellHeight = gridConfig.cellHeight + gridConfig.spacing;

    if (step.refills.length === 0) return;
    this.logger.debug(`Refill: ${step.refills.length} symbols`);

    const durationMs = config.animation.durationMs || 350;
    const staggerMs = config.staggerMs ?? 60;
    const entryOffsetY = config.entryOffset?.y ?? -300;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < step.refills.length; i++) {
      const refill = step.refills[i];
      const reel = reels[refill.position.col];
      if (!reel) continue;

      const symbol = reel.getSymbols()[1 + refill.position.row];
      if (!symbol) continue;

      const delay = i * staggerMs;
      const targetY = refill.position.row * cellHeight + gridConfig.cellHeight / 2;

      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            // Set new symbol identity
            symbol.setSymbolId(refill.symbol);
            symbol.visible = true;
            symbol.alpha = 1;
            symbol.scale.set(0.82);

            // Start above grid
            symbol.y = targetY + entryOffsetY;

            // Drop down
            TweenFactory.play(symbol, {
              type: 'drop',
              duration: durationMs / 1000,
              distance: Math.abs(entryOffsetY),
            });

            setTimeout(resolve, durationMs);
          }, delay);
        }),
      );
    }

    await Promise.all(promises);

    // Restore final grid state
    this.restoreGrid(step);
  }

  /** Parse a matrix row that may contain multi-char symbols like "10" */
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

  /** Restore all symbols to final matrix state */
  private restoreGrid(step: CascadeStep): void {
    const grid = GridManager.getInstance().getGridContainer();
    if (!grid) return;

    const reels = grid.getReels();
    const finalMatrix = step.matrixAfter.split(';').map((r) => this.parseMatrixRow(r));

    for (let col = 0; col < reels.length; col++) {
      const reel = reels[col];
      const symbols = reel.getSymbols();
      for (let row = 0; row < finalMatrix.length; row++) {
        const symbol = symbols[1 + row];
        if (symbol && finalMatrix[row] && finalMatrix[row][col]) {
          symbol.setSymbolId(finalMatrix[row][col]);
          symbol.visible = true;
          symbol.alpha = 1;
          symbol.scale.set(0.82);
          symbol.setState('idle', true);
        }
      }
    }
  }
}
