/**
 * BaseScreen - Main slot game screen
 * Uses ConfigManager for all grid/layout configuration
 *
 * Win presentation timeline:
 * 1. If big/mega/epic win → show BigWin celebration overlay first
 * 2. After celebration (or immediately for normal wins) → loop individual paylines
 * 3. Each payline step: highlight that payline + animate ONLY that payline's symbols
 * 4. Player can spin at any time during payline loop → immediately clears & spins
 */

import { Container } from 'pixi.js';
import { ScreenBase } from '../ScreenBase';
import { GridManager } from '../../grid/GridManager';
import { GridContainer } from '../../grid/GridContainer';
import { WinLayer } from '../../layers/WinLayer';
import { FeatureLayer } from '../../layers/FeatureLayer';
import { LineHighlighter } from '../../../modules/winsystems/paylines/LineHighlighter';
import { EventBus } from '../../../platform/events/EventBus';
import { ConfigManager } from '../../../content/ConfigManager';
import { WinData } from '../../../platform/events/EventMap';

/** Win tiers that require a celebration overlay before payline loop */
type WinTier = 'normal' | 'big' | 'mega' | 'epic';

const PAYLINE_COLORS = [
  0xf1c40f, 0xe74c3c, 0x3498db, 0x2ecc71, 0xe67e22, 0x9b59b6,
  0xff6b6b, 0x48dbfb, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x01a3a4,
  0xf368e0, 0xff9f43, 0xee5a24, 0x0abde3, 0x10ac84, 0xe55039,
  0x3dc1d3, 0xfc427b,
];

export class BaseScreen extends ScreenBase {
  private gridManager: GridManager;
  private gridContainer: GridContainer | null = null;
  private secondaryGridContainer: GridContainer | null = null;
  private winLayer: WinLayer;
  private featureLayer: FeatureLayer;
  private fxLayer: Container;
  private eventBus: EventBus;
  private configManager: ConfigManager;
  private lineHighlighter: LineHighlighter | null = null;
  private highlightContainer: Container | null = null;

  // ── Win presentation state ────────────────────────────────────────────
  private winCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private bigWinTimer: ReturnType<typeof setTimeout> | null = null;
  private currentWins: WinData[] = [];
  private currentWinIndex: number = 0;
  private isShowingPaylines: boolean = false;
  private lineDisplayDuration: number = 1500;
  private pendingWinTier: WinTier = 'normal';
  private pendingTotalWin: number = 0;

  /** Set of "row,col" keys for symbols currently in win animation state */
  private activeWinPositions = new Set<string>();

  constructor() {
    super('BaseScreen');
    this.gridManager = GridManager.getInstance();
    this.eventBus = EventBus.getInstance();
    this.configManager = ConfigManager.getInstance();

    this.winLayer = new WinLayer();
    this.featureLayer = new FeatureLayer();
    this.fxLayer = new Container();
    this.fxLayer.label = 'FxLayer';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  public override onInit(): void {
    this.gridContainer = this.gridManager.initializeFromConfig();

    if (!this.gridContainer) {
      console.error('[BaseScreen] Failed to initialize grid from config');
      return;
    }

    this.gridManager.setParentContainer(this);

    const config = this.gridContainer.getConfig();
    this.highlightContainer = new Container();
    this.highlightContainer.label = 'LineHighlightOverlay';
    this.highlightContainer.x = this.gridContainer.x;
    this.highlightContainer.y = this.gridContainer.y;
    this.addChild(this.highlightContainer);

    this.addChild(this.gridContainer);

    // ── Secondary grid (dual-board games) ──────────────────────────────
    this.secondaryGridContainer = this.gridManager.initializeSecondaryGrid();
    if (this.secondaryGridContainer) {
      this.addChild(this.secondaryGridContainer);
      console.log('[BaseScreen] Secondary grid added for dual-board game');
    }

    this.addChild(this.winLayer);
    this.addChild(this.featureLayer);
    this.addChild(this.fxLayer);

    this.winLayer.x = this.gridContainer.x;
    this.winLayer.y = this.gridContainer.y;

    this.lineHighlighter = new LineHighlighter(
      this.highlightContainer,
      config.cellWidth,
      config.cellHeight,
      config.spacing,
    );

    this.setupEventListeners();
    this.setupResponsiveListeners();
  }

  // ── Event wiring ──────────────────────────────────────────────────────

  private setupEventListeners(): void {
    // Clear highlights on spin start (normal flow)
    this.eventBus.on('game:spin:start', () => {
      this.clearAllWinVisuals();
    });

    // Capture win tier from game:win (only emitted by ResultPresentationController
    // after the full step sequence completes — never per-step)
    this.eventBus.on('game:win', (payload) => {
      this.pendingWinTier = (payload?.winType as WinTier) ?? 'normal';
      this.pendingTotalWin = payload?.amount ?? 0;
    });

    // Main win presentation entry point — highlights winning symbols.
    // During step sequence this fires per-step with pendingWinTier='normal'
    // so big-win celebration overlays are never triggered per-step.
    this.eventBus.on('game:win:detected', (payload) => {
      this.onWinDetected(payload.wins, payload.totalWin);
    });

    // Spin interrupted during win presentation — clear everything immediately
    this.eventBus.on('game:win:interrupted', () => {
      this.clearAllWinVisuals();
    });

    // On spin complete: clear win visuals (highlights, timers) but do NOT
    // touch symbol IDs or positions — the grid is already in its final state
    // from applyFinalGrid. Only clear overlays and animation state.
    this.eventBus.on('game:spin:complete', () => {
      this.clearAllWinVisuals();
    });
  }

  private setupResponsiveListeners(): void {
    // Re-sync overlay positions on ANY resize (not just breakpoint change)
    this.eventBus.on('viewport:resize', () => {
      this.syncOverlayPositions();
    });

    this.eventBus.on('game:update', (payload: any) => {
      if (payload?.type !== 'grid:relayout') return;

      const newGrid = this.gridManager.getGridContainer();
      if (!newGrid) return;

      this.gridContainer = newGrid;
      this.syncOverlayPositions();

      const config = newGrid.getConfig();
      if (this.highlightContainer) {
        this.lineHighlighter = new LineHighlighter(
          this.highlightContainer,
          config.cellWidth,
          config.cellHeight,
          config.spacing,
        );
      }

      console.log('[BaseScreen] Responsive relayout applied');
    });
  }

  /** Keep highlight / win overlays aligned with the grid container */
  private syncOverlayPositions(): void {
    if (!this.gridContainer) return;

    if (this.highlightContainer) {
      this.highlightContainer.x = this.gridContainer.x;
      this.highlightContainer.y = this.gridContainer.y;
    }

    this.winLayer.x = this.gridContainer.x;
    this.winLayer.y = this.gridContainer.y;
  }

  // ── Win presentation entry ────────────────────────────────────────────

  private onWinDetected(wins: WinData[], totalWin: number): void {
    if (!wins || wins.length === 0 || !this.gridContainer) return;

    this.currentWins = wins;
    this.currentWinIndex = 0;

    const tier = this.pendingWinTier;
    const mode = this.configManager.getConfig()?.manifest?.paylines?.type ?? 'lines';

    // Timings from config
    const timings = (this.configManager.getConfig() as any)?.timings ?? {};
    this.lineDisplayDuration = timings['win.paylineLoop.step'] ?? 1500;

    console.log(`[BaseScreen] Win detected: ${wins.length} paylines, total: $${totalWin.toFixed(2)}, tier: ${tier}`);

    // ── Phase 1: Big win celebration (if applicable) ────────────────────
    if (tier === 'big' || tier === 'mega' || tier === 'epic') {
      // During celebration, show ALL winning symbols animated
      this.setSymbolWinStates(this.getAllWinPositions(), 'low');

      const celebrationDuration = tier === 'epic' ? 5500 : tier === 'mega' ? 4500 : 3500;

      this.eventBus.emit('game:bigwin:show', {
        amount: totalWin,
        type: tier,
      });

      // After celebration completes, start payline loop
      this.bigWinTimer = setTimeout(() => {
        this.bigWinTimer = null;
        // Reset all win symbol states before starting per-line loop
        this.resetAllWinSymbolStates();

        if (mode === 'ways') {
          this.presentWaysWin(wins, totalWin);
        } else {
          this.startPaylineLoop(totalWin);
        }
      }, celebrationDuration);

      return;
    }

    // ── Phase 2 (normal wins): Jump straight to payline loop ────────────
    if (mode === 'ways') {
      this.presentWaysWin(wins, totalWin);
    } else {
      this.startPaylineLoop(totalWin);
    }
  }

  // ── Payline loop ──────────────────────────────────────────────────────

  private startPaylineLoop(totalWin: number): void {
    this.isShowingPaylines = true;
    this.currentWinIndex = 0;
    this.showNextPayline(totalWin);
  }

  /**
   * Show one payline at a time:
   *  - Highlight that payline's positions (overlay + line path)
   *  - Set ONLY that payline's symbols to win state (others idle)
   *  - Show that line's payout text
   *  - After duration, advance to next payline (loops)
   */
  private showNextPayline(totalWin: number): void {
    if (!this.gridContainer || !this.isShowingPaylines) return;

    const config = this.gridContainer.getConfig();
    const gridCenterX = (config.cols * (config.cellWidth + config.spacing) - config.spacing) / 2;
    const gridCenterY = (config.rows * (config.cellHeight + config.spacing) - config.spacing) / 2;

    // Clear previous line visuals & symbol states
    this.winLayer.clearHighlights();
    this.winLayer.clearWinText();
    if (this.lineHighlighter) this.lineHighlighter.clear();
    this.resetAllWinSymbolStates();

    // Wrap index to loop
    if (this.currentWinIndex >= this.currentWins.length) {
      this.currentWinIndex = 0;
    }

    const win = this.currentWins[this.currentWinIndex];
    const color = PAYLINE_COLORS[Math.abs(win.lineId) % PAYLINE_COLORS.length];

    // Draw the connecting payline path only (no cell rectangles)
    if (this.lineHighlighter) {
      this.lineHighlighter.highlight([{ ...win, lineId: win.lineId }]);
      this.lineHighlighter.animateLine(0);
    }

    // Animate ONLY this payline's symbols
    const posKeys = win.positions.map(p => `${p.row},${p.col}`);
    this.setSymbolWinStates(new Set(posKeys), 'low');

    // Show this line's payout
    this.winLayer.showLineWin(
      win.amount,
      this.currentWinIndex + 1,
      this.currentWins.length,
      gridCenterX,
      gridCenterY,
    );

    // Schedule next payline
    this.currentWinIndex++;
    this.winCycleTimer = setTimeout(() => {
      this.showNextPayline(totalWin);
    }, this.lineDisplayDuration);
  }

  // ── Ways win (no payline cycling) ─────────────────────────────────────

  private presentWaysWin(wins: WinData[], totalWin: number): void {
    if (!this.gridContainer) return;

    const config = this.gridContainer.getConfig();
    const gridCenterX = (config.cols * (config.cellWidth + config.spacing) - config.spacing) / 2;
    const gridCenterY = (config.rows * (config.cellHeight + config.spacing) - config.spacing) / 2;

    const highlights = wins.map((w) => ({ positions: w.positions, color: 0xf1c40f }));
    this.winLayer.showHighlights(highlights, config.cellWidth, config.cellHeight, 0, 0);
    if (this.lineHighlighter) this.lineHighlighter.clear();
    this.winLayer.showWinAmount(totalWin, gridCenterX, gridCenterY);

    // Animate all winning symbols
    this.setSymbolWinStates(this.getAllWinPositions(), 'low');
  }

  // ── Symbol win state helpers ──────────────────────────────────────────

  /** Collect unique positions across all current wins */
  private getAllWinPositions(): Set<string> {
    const positions = new Set<string>();
    for (const win of this.currentWins) {
      for (const pos of win.positions) {
        positions.add(`${pos.row},${pos.col}`);
      }
    }
    return positions;
  }

  /**
   * Set specific symbols to win state, resetting any previously active ones first.
   */
  private setSymbolWinStates(positions: Set<string>, tier: 'low' | 'high'): void {
    if (!this.gridContainer) return;

    const reels = this.gridContainer.getReels();

    // Reset previously active win positions that are NOT in the new set
    for (const key of this.activeWinPositions) {
      if (!positions.has(key)) {
        const [row, col] = key.split(',').map(Number);
        const reel = reels[col];
        if (reel) {
          const symbol = reel.getSymbols()[1 + row];
          symbol?.setState('idle', true);
        }
      }
    }

    // Activate new win positions
    for (const key of positions) {
      const [row, col] = key.split(',').map(Number);
      const reel = reels[col];
      if (!reel) continue;
      const symbol = reel.getSymbols()[1 + row];
      if (symbol) {
        symbol.playWin(tier);
      }
    }

    this.activeWinPositions = new Set(positions);
  }

  /** Reset all active win symbols to idle */
  private resetAllWinSymbolStates(): void {
    if (!this.gridContainer || this.activeWinPositions.size === 0) return;

    const reels = this.gridContainer.getReels();
    for (const key of this.activeWinPositions) {
      const [row, col] = key.split(',').map(Number);
      const reel = reels[col];
      if (!reel) continue;
      const symbol = reel.getSymbols()[1 + row];
      symbol?.setState('idle', true);
    }
    this.activeWinPositions.clear();
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  private stopWinCycle(): void {
    if (this.winCycleTimer) {
      clearTimeout(this.winCycleTimer);
      this.winCycleTimer = null;
    }
    if (this.bigWinTimer) {
      clearTimeout(this.bigWinTimer);
      this.bigWinTimer = null;
    }
    this.isShowingPaylines = false;
  }

  private clearAllWinVisuals(): void {
    this.stopWinCycle();
    this.resetAllWinSymbolStates();

    this.currentWins = [];
    this.currentWinIndex = 0;
    this.pendingWinTier = 'normal';
    this.pendingTotalWin = 0;

    this.winLayer.clearHighlights();
    this.winLayer.clearWinText();
    this.winLayer.clearParticles();
    if (this.lineHighlighter) {
      this.lineHighlighter.clear();
    }
  }

  // ── Lifecycle overrides ───────────────────────────────────────────────

  public override onEnter(): void {
    console.log('[BaseScreen] Entered');
  }

  public override onExit(): void {
    this.clearAllWinVisuals();
    console.log('[BaseScreen] Exited');
  }

  public override onUpdate(deltaTime: number): void {
    this.gridManager.update(deltaTime);
  }

  // ── Public API ────────────────────────────────────────────────────────

  public getGridContainer(): GridContainer | null {
    return this.gridContainer;
  }

  public getWinLayer(): WinLayer {
    return this.winLayer;
  }

  public showWinHighlights(positions: { row: number; col: number }[], color: number = 0xf1c40f): void {
    if (!this.gridContainer) return;

    const config = this.gridContainer.getConfig();
    this.winLayer.showHighlights(
      [{ positions, color }],
      config.cellWidth,
      config.cellHeight,
      0,
      0,
    );
  }

  public clearWinHighlights(): void {
    this.clearAllWinVisuals();
  }

  public override onDestroy(): void {
    this.clearAllWinVisuals();
    if (this.lineHighlighter) {
      this.lineHighlighter.clear();
    }
    this.gridManager.destroy();
  }
}
