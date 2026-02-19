/**
 * GridContainer - Main container for the slot grid with pluggable spin strategies
 * Now integrates the config-driven FrameLayer plugin system.
 */

import { Container, Graphics } from 'pixi.js';
import { GridConfig } from './GridManager';
import { ReelStripView } from './reels/ReelStripView';
import { GridMask } from './GridMask';
import { SpinStrategyRegistry } from '../../modules/registry/SpinStrategyRegistry';
import { SpinConfig } from '../../gameplay/interfaces/ISpinStrategy';
import { FrameLayer } from './frame/FrameLayer';

export class GridContainer extends Container {
  private config: GridConfig;
  private reels: ReelStripView[] = [];
  private gridMask: GridMask;
  private background: Graphics;
  private reelContainer: Container;
  private currentStrategyId: string = 'top_to_bottom';
  private isHorizontalLayout: boolean = false;
  private frameLayer: FrameLayer;

  constructor(config: GridConfig) {
    super();
    this.label = 'GridContainer';
    this.config = config;

    // ── Frame Layer (config-driven, replaces hardcoded background) ──
    this.frameLayer = new FrameLayer();
    this.addChild(this.frameLayer.getDisplayObject());

    // Legacy background fallback (drawn behind frame layer in case frame is disabled)
    this.background = new Graphics();
    this.drawBackground();
    this.addChild(this.background);

    // Reel container
    this.reelContainer = new Container();
    this.reelContainer.label = 'ReelContainer';
    this.addChild(this.reelContainer);

    // Create mask
    const gridWidth = config.cols * config.cellWidth + (config.cols - 1) * config.spacing;
    const gridHeight = config.rows * config.cellHeight + (config.rows - 1) * config.spacing;
    this.gridMask = new GridMask(gridWidth, gridHeight);
    this.addChild(this.gridMask);
    this.reelContainer.mask = this.gridMask;

    // Create reels
    this.createReels();

    // Initialize frame layer asynchronously — when ready it hides legacy background
    void this.initFrameLayer();
  }

  private async initFrameLayer(): Promise<void> {
    try {
      await this.frameLayer.initialize(this.config);
      // Hide legacy background once frame layer is active
      this.background.visible = false;
    } catch (e) {
      console.warn('[GridContainer] FrameLayer init failed, using legacy background:', e);
    }
  }

  private drawBackground(): void {
    const gridWidth = this.config.cols * this.config.cellWidth + (this.config.cols - 1) * this.config.spacing;
    const gridHeight = this.config.rows * this.config.cellHeight + (this.config.rows - 1) * this.config.spacing;

    this.background.roundRect(-10, -10, gridWidth + 20, gridHeight + 20, 8);
    this.background.fill({ color: 0x1a1f2e, alpha: 0.8 });
    this.background.stroke({ color: 0x3b82f6, width: 2 });
  }

  // ... keep existing code (createReels, setSpinStrategy, setReelSpinStrategy, getSpinStrategyId, getAvailableStrategies, getReels, getReel)

  private createReels(): void {
    if (this.isHorizontalLayout) {
      this.createHorizontalReels();
    } else {
      this.createVerticalReels();
    }
  }

  /** Standard vertical reels (one per column) */
  private createVerticalReels(): void {
    for (let col = 0; col < this.config.cols; col++) {
      const reel = new ReelStripView(col, this.config, this.config.cols, false);
      reel.x = col * (this.config.cellWidth + this.config.spacing);
      this.reelContainer.addChild(reel);
      this.reels.push(reel);
    }
  }

  /** Horizontal reels (one per row) for right-to-left / left-to-right strategies */
  private createHorizontalReels(): void {
    for (let row = 0; row < this.config.rows; row++) {
      const reel = new ReelStripView(row, this.config, this.config.rows, true);
      reel.y = row * (this.config.cellHeight + this.config.spacing);
      this.reelContainer.addChild(reel);
      this.reels.push(reel);
    }
  }

  private isHorizontalStrategy(strategyId: string): boolean {
    return strategyId === 'right_to_left' || strategyId === 'left_to_right';
  }

  public setSpinStrategy(strategyId: string, config?: Partial<SpinConfig>): void {
    this.currentStrategyId = strategyId;
    const needsHorizontal = this.isHorizontalStrategy(strategyId);

    // If orientation changed, destroy old reels and recreate
    if (needsHorizontal !== this.isHorizontalLayout) {
      for (const reel of this.reels) {
        reel.destroy();
      }
      this.reels = [];
      this.isHorizontalLayout = needsHorizontal;
      this.createReels();
      // Recreate mask for new orientation
      this.reelContainer.mask = null;
      if (this.gridMask) this.removeChild(this.gridMask);
      const gridWidth = this.config.cols * this.config.cellWidth + (this.config.cols - 1) * this.config.spacing;
      const gridHeight = this.config.rows * this.config.cellHeight + (this.config.rows - 1) * this.config.spacing;
      this.gridMask = new GridMask(gridWidth, gridHeight);
      this.addChild(this.gridMask);
      this.reelContainer.mask = this.gridMask;
    }

    const registry = SpinStrategyRegistry.getInstance();
    const strategies = registry.createForReels(strategyId, this.reels.length, config);
    
    for (let i = 0; i < this.reels.length; i++) {
      this.reels[i].setSpinStrategyInstance(strategies[i]);
    }
    
    console.log(`[GridContainer] Set spin strategy: ${strategyId} (horizontal=${needsHorizontal}) for ${this.reels.length} reels`);
  }

  public setReelSpinStrategy(reelIndex: number, strategyId: string, config?: Partial<SpinConfig>): void {
    const reel = this.reels[reelIndex];
    if (reel) {
      reel.setSpinStrategy(strategyId, config);
    }
  }

  public getSpinStrategyId(): string {
    return this.currentStrategyId;
  }

  public getAvailableStrategies(): string[] {
    return SpinStrategyRegistry.getInstance().list();
  }

  public getReels(): ReelStripView[] {
    return this.reels;
  }

  public getReel(index: number): ReelStripView | undefined {
    return this.reels[index];
  }

  // ── Frame Layer public API ──────────────────────────────────────────────

  /** Access the frame layer for runtime variant switching */
  public getFrameLayer(): FrameLayer {
    return this.frameLayer;
  }

  // ── Update / Lifecycle ──────────────────────────────────────────────────

  public update(deltaTime: number): void {
    for (const reel of this.reels) {
      reel.update(deltaTime);
    }
    this.frameLayer.update(deltaTime);
  }

  public startSpin(): void {
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      const delay = reel.getStaggerDelay();
      
      setTimeout(() => {
        reel.startSpin();
      }, delay);
    }
  }

  public stopSpin(symbols: string[][]): void {
    for (let i = 0; i < this.reels.length; i++) {
      const reel = this.reels[i];
      let reelSymbols: string[];

      if (this.isHorizontalLayout) {
        // Horizontal: each reel is a row, symbols[i] is the row's symbols
        reelSymbols = symbols[i] || [];
      } else {
        // Vertical: each reel is a column, extract column i from each row
        reelSymbols = symbols.map(row => row[i]);
      }

      const baseDelay = reel.getStaggerDelay();
      setTimeout(() => {
        reel.stopSpin(reelSymbols);
      }, baseDelay + 100);
    }
  }

  public isSpinning(): boolean {
    return this.reels.some(reel => reel.isSpinning());
  }

  public getConfig(): GridConfig {
    return this.config;
  }

  public override destroy(): void {
    this.frameLayer.destroy();
    for (const reel of this.reels) {
      reel.destroy();
    }
    this.reels = [];
    super.destroy({ children: true });
  }
}
