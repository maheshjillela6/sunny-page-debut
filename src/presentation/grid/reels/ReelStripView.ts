/**
 * ReelStripView - Visual representation of a single reel with pluggable spin strategy
 */

import { Container } from 'pixi.js';
import { GridConfig } from '../GridManager';
import { ConfigurableSymbolView } from '../symbols/ConfigurableSymbolView';
import { ConfigurableSymbolPool } from '../symbols/ConfigurableSymbolPool';
import { PluggableReelAnimator } from './PluggableReelAnimator';
import { ReelStopAnimator } from './ReelStopAnimator';
import { EventBus } from '../../../platform/events/EventBus';
import { ISpinStrategy, SpinConfig } from '../../../gameplay/interfaces/ISpinStrategy';
import { TweenFactory } from '../../../runtime/animation/TweenFactory';
import type { TweenHandle } from '../../../runtime/animation/TweenTypes';
import { SpinStrategyRegistry } from '../../../modules/registry/SpinStrategyRegistry';

export enum ReelState {
  IDLE = 'idle',
  SPINNING = 'spinning',
  STOPPING = 'stopping',
}

export class ReelStripView extends Container {
  private reelIndex: number;
  private totalReels: number;
  private config: GridConfig;
  private state: ReelState = ReelState.IDLE;
  private symbols: ConfigurableSymbolView[] = [];
  private symbolPool: ConfigurableSymbolPool;
  private pluggableAnimator: PluggableReelAnimator;
  private stopAnimator: ReelStopAnimator;
  private symbolContainer: Container;
  private pendingSymbols: string[] = [];
  private eventBus: EventBus;
  private landingTween: TweenHandle | null = null;
  private currentStrategyId: string = 'top_to_bottom';
  private horizontal: boolean;

  constructor(reelIndex: number, config: GridConfig, totalReels: number = 5, horizontal: boolean = false) {
    super();
    this.label = `Reel_${reelIndex}`;
    this.reelIndex = reelIndex;
    this.totalReels = totalReels;
    this.config = config;
    this.horizontal = horizontal;
    this.eventBus = EventBus.getInstance();

    this.symbolPool = ConfigurableSymbolPool.getInstance();
    
    this.symbolContainer = new Container();
    this.symbolContainer.label = 'SymbolContainer';
    this.addChild(this.symbolContainer);

    // Create pluggable animator
    this.pluggableAnimator = new PluggableReelAnimator({
      reelIndex,
      totalReels,
      rows: config.rows,
      cellWidth: config.cellWidth,
      cellHeight: config.cellHeight,
      spacing: config.spacing,
    });
    this.pluggableAnimator.bind(this.symbolContainer);

    this.stopAnimator = new ReelStopAnimator(this);

    this.createInitialSymbols();
  }

  private createInitialSymbols(): void {
    // Scale symbols relative to cell size (pool creates them at 120px)
    const baseSymbolSize = 120;
    const cellSize = Math.min(this.config.cellWidth, this.config.cellHeight);
    const symbolScale = (cellSize / baseSymbolSize) * 0.82;

    if (this.horizontal) {
      const totalSymbols = this.config.cols + 2;
      for (let i = 0; i < totalSymbols; i++) {
        const symbol = this.symbolPool.acquire();
        if (symbol) {
          symbol.setRandomSymbol();
          symbol.x = (i - 1) * (this.config.cellWidth + this.config.spacing) + this.config.cellWidth / 2;
          symbol.y = this.config.cellHeight / 2;
          symbol.scale.set(symbolScale);
          this.symbolContainer.addChild(symbol);
          this.symbols.push(symbol);
        }
      }
    } else {
      const totalSymbols = this.config.rows + 2;
      for (let i = 0; i < totalSymbols; i++) {
        const symbol = this.symbolPool.acquire();
        if (symbol) {
          symbol.setRandomSymbol();
          symbol.x = this.config.cellWidth / 2;
          symbol.y = (i - 1) * (this.config.cellHeight + this.config.spacing) + this.config.cellHeight / 2;
          symbol.scale.set(symbolScale);
          this.symbolContainer.addChild(symbol);
          this.symbols.push(symbol);
        }
      }
    }
  }

  /**
   * Set the spin strategy for this reel
   */
  public setSpinStrategy(strategyId: string, config?: Partial<SpinConfig>): void {
    this.currentStrategyId = strategyId;
    this.pluggableAnimator.setStrategy(strategyId, config);
  }

  /**
   * Set strategy instance directly
   */
  public setSpinStrategyInstance(strategy: ISpinStrategy): void {
    this.pluggableAnimator.setStrategyInstance(strategy);
  }

  /**
   * Get current strategy ID
   */
  public getSpinStrategyId(): string {
    return this.currentStrategyId;
  }

  /**
   * Get current strategy
   */
  public getSpinStrategy(): ISpinStrategy {
    return this.pluggableAnimator.getStrategy();
  }

  /**
   * Get stagger delay based on current strategy
   */
  public getStaggerDelay(): number {
    return this.pluggableAnimator.getStaggerDelay();
  }

  public getReelIndex(): number {
    return this.reelIndex;
  }

  public getState(): ReelState {
    return this.state;
  }

  public isSpinning(): boolean {
    return this.state !== ReelState.IDLE;
  }

  public isHorizontal(): boolean {
    return this.horizontal;
  }

  public getConfig(): GridConfig {
    return this.config;
  }

  public getSymbolContainer(): Container {
    return this.symbolContainer;
  }

  public getSymbols(): ConfigurableSymbolView[] {
    return this.symbols;
  }

  public startSpin(): void {
    if (this.state !== ReelState.IDLE) return;
    
    this.state = ReelState.SPINNING;
    this.pluggableAnimator.start();
    this.eventBus.emit('game:reel:spin:start', { reelIndex: this.reelIndex });
  }

  public stopSpin(finalSymbols: string[]): void {
    if (this.state !== ReelState.SPINNING) return;
    
    this.pendingSymbols = finalSymbols;
    this.state = ReelState.STOPPING;
    this.pluggableAnimator.stop(finalSymbols);
    this.stopAnimator.start(finalSymbols, () => {
      this.onStopComplete();
    });
  }

  private onStopComplete(): void {
    this.state = ReelState.IDLE;
    this.pluggableAnimator.reset();

    // Kill any previous landing tween
    this.landingTween?.kill();
    TweenFactory.kill(this.symbolContainer);

    // Unified reel strip landing: bounce the entire symbolContainer as one unit
    // Use horizontal bounce for horizontal reels (right-to-left / left-to-right)
    const bounceDistance = 10;
    const reelDelay = this.reelIndex * 0.06;

    if (this.horizontal) {
      this.landingTween = TweenFactory.play(this.symbolContainer, {
        type: 'landBounceHorizontal',
        duration: 0.35,
        delay: reelDelay,
        distance: bounceDistance,
        direction: 'left',
      });
    } else {
      this.landingTween = TweenFactory.play(this.symbolContainer, {
        type: 'landBounce',
        duration: 0.35,
        delay: reelDelay,
        distance: bounceDistance,
      });
    }

    this.eventBus.emit('game:reel:spin:stop', { 
      reelIndex: this.reelIndex, 
      symbols: this.pendingSymbols 
    });
  }

  public update(deltaTime: number): void {
    switch (this.state) {
      case ReelState.SPINNING:
        this.pluggableAnimator.update(deltaTime);
        this.handleSymbolRecycling();
        break;
      case ReelState.STOPPING:
        this.pluggableAnimator.update(deltaTime);
        this.stopAnimator.update(deltaTime);
        break;
    }
  }

  /**
   * Handle symbol recycling based on strategy direction
   */
  private handleSymbolRecycling(): void {
    const strategy = this.pluggableAnimator.getStrategy();
    const cellHeight = this.config.cellHeight + this.config.spacing;
    const cellWidth = this.config.cellWidth + this.config.spacing;
    
    // For vertical strategies (top-to-bottom), recycle when symbol goes below
    if (strategy.direction === 'top_to_bottom') {
      if (this.symbols.length > 0 && this.symbols[0].y > cellHeight) {
        for (const symbol of this.symbols) {
          symbol.y -= cellHeight;
        }
        const lastSymbol = this.symbols[this.symbols.length - 1];
        if (lastSymbol) {
          lastSymbol.setRandomSymbol();
        }
      }
    }
    // For bottom-to-top, recycle when symbol goes above
    else if (strategy.direction === 'bottom_to_top') {
      const lastIdx = this.symbols.length - 1;
      if (lastIdx >= 0 && this.symbols[lastIdx].y < -cellHeight) {
        for (const symbol of this.symbols) {
          symbol.y += cellHeight;
        }
        const firstSymbol = this.symbols[0];
        if (firstSymbol) {
          firstSymbol.setRandomSymbol();
        }
      }
    }
    // For right-to-left, recycle when leftmost symbol goes past left edge
    else if (strategy.direction === 'right_to_left') {
      // Find the leftmost symbol
      let minX = Infinity;
      for (const symbol of this.symbols) {
        if (symbol.x < minX) minX = symbol.x;
      }
      if (minX < -cellWidth / 2) {
        for (const symbol of this.symbols) {
          symbol.x += cellWidth;
        }
        // Randomize the symbol that wrapped to the right
        let rightmost: ConfigurableSymbolView | null = null;
        let maxX = -Infinity;
        for (const symbol of this.symbols) {
          if (symbol.x > maxX) { maxX = symbol.x; rightmost = symbol; }
        }
        if (rightmost) rightmost.setRandomSymbol();
      }
    }
    // For left-to-right, recycle when rightmost symbol goes past right edge
    else if (strategy.direction === 'left_to_right') {
      const totalWidth = (this.config.cols + 2) * cellWidth;
      let maxX = -Infinity;
      for (const symbol of this.symbols) {
        if (symbol.x > maxX) maxX = symbol.x;
      }
      if (maxX > totalWidth) {
        for (const symbol of this.symbols) {
          symbol.x -= cellWidth;
        }
        let leftmost: ConfigurableSymbolView | null = null;
        let minX = Infinity;
        for (const symbol of this.symbols) {
          if (symbol.x < minX) { minX = symbol.x; leftmost = symbol; }
        }
        if (leftmost) leftmost.setRandomSymbol();
      }
    }
    // Other strategies handle positioning internally
  }

  public recycleTopSymbol(): void {
    if (this.symbols.length === 0) return;

    const topSymbol = this.symbols.shift();
    if (topSymbol) {
      this.symbolPool.release(topSymbol);
      this.symbolContainer.removeChild(topSymbol);
    }

    const newSymbol = this.symbolPool.acquire();
    if (newSymbol) {
      newSymbol.setRandomSymbol();
      newSymbol.x = this.config.cellWidth / 2;
      const lastSymbol = this.symbols[this.symbols.length - 1];
      newSymbol.y = lastSymbol.y + this.config.cellHeight + this.config.spacing;
      const cellSize = Math.min(this.config.cellWidth, this.config.cellHeight);
      newSymbol.scale.set((cellSize / 120) * 0.82);
      this.symbolContainer.addChild(newSymbol);
      this.symbols.push(newSymbol);
    }
  }

  public setFinalSymbols(symbolIds: string[]): void {
    const visibleStart = 1;
    const count = this.horizontal ? this.config.cols : this.config.rows;
    for (let i = 0; i < Math.min(symbolIds.length, count); i++) {
      const symbol = this.symbols[visibleStart + i];
      if (symbol) {
        symbol.setSymbolId(symbolIds[i]);
      }
    }
  }

  public override destroy(): void {
    for (const symbol of this.symbols) {
      this.symbolPool.release(symbol);
    }
    this.symbols = [];
    this.pluggableAnimator.reset();
    super.destroy({ children: true });
  }
}
