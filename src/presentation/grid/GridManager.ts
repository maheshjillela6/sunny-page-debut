/**
 * GridManager - Manages the slot grid and reels with smooth updates
 * All config values come from ConfigManager - no hardcoded values
 *
 * Responsive: listens for viewport:breakpoint:changed and re-initialises the
 * grid with the layout / cell sizes defined for that breakpoint.
 */

import { Container } from 'pixi.js';
import { GridContainer } from './GridContainer';
import { EventBus } from '../../platform/events/EventBus';
import { ConfigManager } from '../../content/ConfigManager';
import { PixiRuntime, type Breakpoint } from '../../runtime/pixi/core/PixiRuntime';

export interface GridConfig {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  spacing: number;
}

export class GridManager {
  private static instance: GridManager | null = null;

  private gridContainer: GridContainer | null = null;
  private config: GridConfig | null = null;
  private eventBus: EventBus;
  private configManager: ConfigManager;
  private lastUpdateTime: number = 0;
  private maxDelta: number;

  /** Secondary grid for dual-board games */
  private secondaryGridContainer: GridContainer | null = null;
  private secondaryConfig: GridConfig | null = null;

  /** Parent container so we can swap GridContainers on relayout */
  private parentContainer: Container | null = null;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.configManager = ConfigManager.getInstance();
    
    const engineConfig = this.configManager.getEngineConfig();
    this.maxDelta = engineConfig.maxDeltaTime;

    // Listen for breakpoint changes to relayout grid
    this.eventBus.on('viewport:breakpoint:changed', (payload) => {
      this.relayout(payload.breakpoint);
    });

    // Listen for all resizes to reposition grid (e.g. window resize within same breakpoint)
    this.eventBus.on('viewport:resize', () => {
      if (this.gridContainer && this.config) {
        this.positionGrid(this.gridContainer, this.config);
      }
      if (this.secondaryGridContainer && this.secondaryConfig) {
        this.positionSecondaryGrid(this.secondaryGridContainer);
      }
    });
  }

  public static getInstance(): GridManager {
    if (!GridManager.instance) {
      GridManager.instance = new GridManager();
    }
    return GridManager.instance;
  }

  public initialize(config: GridConfig): GridContainer {
    this.config = config;
    this.gridContainer = new GridContainer(config);
    this.lastUpdateTime = performance.now();
    
    this.positionGrid(this.gridContainer, config);
    return this.gridContainer;
  }

  /**
   * Initialize from game manifest config
   */
  public initializeFromManifest(manifest: {
    grid: { cols: number; rows: number; cellWidth: number; cellHeight: number; spacing: number };
  }): GridContainer {
    return this.initialize(manifest.grid);
  }

  /**
   * Initialize from ConfigManager (preferred method)
   */
  public initializeFromConfig(): GridContainer | null {
    const gridConfig = this.configManager.getGridConfig();
    if (!gridConfig) {
      console.warn('[GridManager] No grid config available');
      return null;
    }
    return this.initialize(gridConfig);
  }

  /**
   * Initialize a secondary grid for dual-board games.
   * Reads secondary grid config from ConfigManager.
   */
  public initializeSecondaryGrid(): GridContainer | null {
    const secondaryConfig = this.configManager.getSecondaryGridConfig();
    if (!secondaryConfig) {
      console.log('[GridManager] No secondary grid config — single grid game');
      return null;
    }

    console.log(`[GridManager] Secondary grid config found: ${JSON.stringify(secondaryConfig)}`);

    this.secondaryConfig = secondaryConfig;
    this.secondaryGridContainer = new GridContainer(secondaryConfig);
    this.positionSecondaryGrid(this.secondaryGridContainer);

    // Set right-to-left spin strategy from manifest if available
    const config = this.configManager.getConfig() as any;
    const secondaryStrategy = config?.manifest?.features?.baseGame?.secondaryGrid?.spinStrategy;
    console.log(`[GridManager] Secondary spin strategy from manifest: ${secondaryStrategy}`);
    if (secondaryStrategy) {
      this.secondaryGridContainer.setSpinStrategy(secondaryStrategy);
    } else {
      console.warn('[GridManager] No secondary spin strategy found in manifest, using default');
    }

    console.log(`[GridManager] Secondary grid initialized: ${secondaryConfig.cols}×${secondaryConfig.rows}, reels: ${this.secondaryGridContainer.getReels().length}`);
    return this.secondaryGridContainer;
  }

  /** Position the secondary grid using layout config, with auto-stacking on small screens */
  private positionSecondaryGrid(gc: GridContainer): void {
    const pos = this.configManager.getSecondaryGridPosition();
    const runtime = PixiRuntime.getInstance();
    const vw = runtime.getVirtualWidth();

    if (this.gridContainer && this.config && this.secondaryConfig) {
      const primaryWidth = this.config.cols * this.config.cellWidth + (this.config.cols - 1) * this.config.spacing;
      const primaryHeight = this.config.rows * this.config.cellHeight + (this.config.rows - 1) * this.config.spacing;
      const secondaryWidth = this.secondaryConfig.cols * this.secondaryConfig.cellWidth + (this.secondaryConfig.cols - 1) * this.secondaryConfig.spacing;

      // Check if both grids fit side-by-side
      const sideByMinWidth = this.gridContainer.x + primaryWidth + 40 + secondaryWidth + 20;
      
      if (pos && sideByMinWidth <= vw) {
        // Use config position if they fit side-by-side
        gc.x = Math.round(pos.x);
        gc.y = Math.round(pos.y);
      } else if (sideByMinWidth <= vw) {
        // Default side-by-side
        gc.x = Math.round(this.gridContainer.x + primaryWidth + 40);
        gc.y = Math.round(this.gridContainer.y + (primaryHeight - (this.secondaryConfig.rows * this.secondaryConfig.cellHeight + (this.secondaryConfig.rows - 1) * this.secondaryConfig.spacing)) / 2);
      } else {
        // Stack vertically - center the secondary grid below the primary
        const secondaryGridWidth = secondaryWidth;
        gc.x = Math.round(this.gridContainer.x + (primaryWidth - secondaryGridWidth) / 2);
        gc.y = Math.round(this.gridContainer.y + primaryHeight + 30);
      }
    } else if (pos) {
      gc.x = Math.round(pos.x);
      gc.y = Math.round(pos.y);
    }
  }

  public getSecondaryGridContainer(): GridContainer | null {
    return this.secondaryGridContainer;
  }

  /** Store a reference to the parent so relayout can swap containers */
  public setParentContainer(parent: Container): void {
    this.parentContainer = parent;
  }

  // ── Responsive relayout ──────────────────────────────────────────────────

  /**
   * Called when the viewport breakpoint changes.
   * Reads the responsive layout for the new breakpoint and reinitialises the
   * grid with updated cell sizes / positions.
   */
  private relayout(breakpoint: Breakpoint): void {
    const responsiveLayout = this.configManager.getResponsiveLayout(breakpoint);
    if (!responsiveLayout?.grid) {
      console.log(`[GridManager] No responsive grid config for breakpoint: ${breakpoint}`);
      return;
    }

    const baseConfig = this.configManager.getGridConfig();
    if (!baseConfig) return;

    const overrideGrid = responsiveLayout.grid;

    const newConfig: GridConfig = {
      cols: overrideGrid.cols ?? baseConfig.cols,
      rows: overrideGrid.rows ?? baseConfig.rows,
      cellWidth: overrideGrid.cellWidth ?? baseConfig.cellWidth,
      cellHeight: overrideGrid.cellHeight ?? baseConfig.cellHeight,
      spacing: overrideGrid.spacing ?? baseConfig.spacing,
    };

    // Preserve spinning state symbols if possible
    const wasSpinning = this.gridContainer?.isSpinning() ?? false;

    // Create new grid container
    const oldContainer = this.gridContainer;
    this.config = newConfig;
    this.gridContainer = new GridContainer(newConfig);
    this.positionGrid(this.gridContainer, newConfig, responsiveLayout);

    // Swap in parent
    if (this.parentContainer && oldContainer) {
      const idx = this.parentContainer.getChildIndex(oldContainer);
      this.parentContainer.removeChild(oldContainer);
      oldContainer.destroy();
      this.parentContainer.addChildAt(this.gridContainer, idx);
    }

    console.log(`[GridManager] Relayout for ${breakpoint}: ${newConfig.cols}×${newConfig.rows}, cell ${newConfig.cellWidth}×${newConfig.cellHeight}`);

    // Relayout secondary grid if present
    if (this.secondaryGridContainer && this.secondaryConfig) {
      const secOverride = responsiveLayout.secondaryGrid;
      if (secOverride) {
        const baseSecConfig = this.configManager.getSecondaryGridConfig();
        if (baseSecConfig) {
          const newSecConfig: GridConfig = {
            cols: secOverride.cols ?? baseSecConfig.cols,
            rows: secOverride.rows ?? baseSecConfig.rows,
            cellWidth: secOverride.cellWidth ?? baseSecConfig.cellWidth,
            cellHeight: secOverride.cellHeight ?? baseSecConfig.cellHeight,
            spacing: secOverride.spacing ?? baseSecConfig.spacing,
          };
          const oldSec = this.secondaryGridContainer;
          this.secondaryConfig = newSecConfig;
          this.secondaryGridContainer = new GridContainer(newSecConfig);
          
          // Re-apply spin strategy
          const config = this.configManager.getConfig() as any;
          const secondaryStrategy = config?.manifest?.features?.baseGame?.secondaryGrid?.spinStrategy;
          if (secondaryStrategy) {
            this.secondaryGridContainer.setSpinStrategy(secondaryStrategy);
          }
          
          this.positionSecondaryGrid(this.secondaryGridContainer);

          if (this.parentContainer) {
            const idx = this.parentContainer.getChildIndex(oldSec);
            this.parentContainer.removeChild(oldSec);
            oldSec.destroy();
            this.parentContainer.addChildAt(this.secondaryGridContainer, idx);
          }
        }
      } else {
        // Just reposition with new primary grid position
        this.positionSecondaryGrid(this.secondaryGridContainer);
      }
    }

    // Emit so other systems (BaseScreen, LineHighlighter) can readjust
    this.eventBus.emit('game:update', { type: 'grid:relayout', data: { breakpoint, config: newConfig } });
  }

  /**
   * Position grid container using layout config or responsive override.
   */
  private positionGrid(gc: GridContainer, config: GridConfig, responsiveLayout?: any): void {
    // Always use the responsive layout for the current breakpoint so grid
    // stays correctly positioned after resize within the same breakpoint.
    const runtime = PixiRuntime.getInstance();
    const currentBreakpoint = runtime.getBreakpoint();
    const layoutConfig = responsiveLayout
      ?? this.configManager.getResponsiveLayout(currentBreakpoint)
      ?? this.configManager.getLayoutConfig();

    if (layoutConfig?.grid?.x !== undefined && layoutConfig?.grid?.y !== undefined) {
      gc.x = Math.round(layoutConfig.grid.x);
      gc.y = Math.round(layoutConfig.grid.y);
    } else {
      const runtime = PixiRuntime.getInstance();
      const vw = runtime.getVirtualWidth();
      const vh = runtime.getVirtualHeight();
      const gridWidth = config.cols * config.cellWidth + (config.cols - 1) * config.spacing;
      const gridHeight = config.rows * config.cellHeight + (config.rows - 1) * config.spacing;
      gc.x = Math.round((vw - gridWidth) / 2);
      gc.y = Math.round((vh - gridHeight) / 2 + 30);
    }
  }

  // ── Public API (unchanged) ───────────────────────────────────────────────

  public getGridContainer(): GridContainer | null {
    return this.gridContainer;
  }

  public getConfig(): GridConfig | null {
    return this.config;
  }

  public getGridPosition(): { x: number; y: number } {
    if (!this.gridContainer) return { x: 0, y: 0 };
    return { x: this.gridContainer.x, y: this.gridContainer.y };
  }

  public getGridSize(): { width: number; height: number } {
    if (!this.config) return { width: 0, height: 0 };
    return {
      width: this.config.cols * this.config.cellWidth + (this.config.cols - 1) * this.config.spacing,
      height: this.config.rows * this.config.cellHeight + (this.config.rows - 1) * this.config.spacing,
    };
  }

  public update(deltaTime: number): void {
    const cappedDelta = Math.min(deltaTime, this.maxDelta);
    if (this.gridContainer) {
      this.gridContainer.update(cappedDelta);
    }
    if (this.secondaryGridContainer) {
      this.secondaryGridContainer.update(cappedDelta);
    }
  }

  public setSpinStrategy(strategyId: string): void {
    if (this.gridContainer) {
      this.gridContainer.setSpinStrategy(strategyId);
    }
  }

  public startSpin(): void {
    if (this.gridContainer) {
      this.gridContainer.startSpin();
    }
    if (this.secondaryGridContainer) {
      console.log(`[GridManager] Starting secondary grid spin, reels: ${this.secondaryGridContainer.getReels().length}`);
      this.secondaryGridContainer.startSpin();
    } else {
      console.log('[GridManager] No secondary grid to spin');
    }
  }

  public stopSpin(symbols: string[][], secondarySymbols?: string[][]): void {
    if (this.gridContainer) {
      this.gridContainer.stopSpin(symbols);
    }
    if (this.secondaryGridContainer) {
      const secSymbols = secondarySymbols || this.generateRandomSecondarySymbols();
      console.log(`[GridManager] Stopping secondary grid with ${secSymbols.length} rows`);
      this.secondaryGridContainer.stopSpin(secSymbols);
    }
  }

  /** Generate random symbols for secondary grid when server doesn't provide them */
  private generateRandomSecondarySymbols(): string[][] {
    if (!this.secondaryConfig) return [];
    const defaultSymbols = ['A', 'B', 'C', 'D', 'E', 'F', 'W', 'S'];
    const matrix: string[][] = [];
    for (let r = 0; r < this.secondaryConfig.rows; r++) {
      matrix[r] = [];
      for (let c = 0; c < this.secondaryConfig.cols; c++) {
        matrix[r][c] = defaultSymbols[Math.floor(Math.random() * defaultSymbols.length)];
      }
    }
    return matrix;
  }

  public isSpinning(): boolean {
    const primarySpinning = this.gridContainer?.isSpinning() ?? false;
    const secondarySpinning = this.secondaryGridContainer?.isSpinning() ?? false;
    return primarySpinning || secondarySpinning;
  }

  public destroy(): void {
    if (this.gridContainer) {
      this.gridContainer.destroy();
      this.gridContainer = null;
    }
    if (this.secondaryGridContainer) {
      this.secondaryGridContainer.destroy();
      this.secondaryGridContainer = null;
    }
    this.config = null;
    this.secondaryConfig = null;
    this.parentContainer = null;
    GridManager.instance = null;
  }

  public static reset(): void {
    if (GridManager.instance) {
      GridManager.instance.destroy();
    }
    GridManager.instance = null;
  }
}
