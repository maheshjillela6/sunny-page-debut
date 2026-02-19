/**
 * ReelStopAnimator - Snaps reels to final positions; visual bounce handled by landBounce tween
 */

import { ReelStripView } from './ReelStripView';

// Spring state removed — landing bounce is handled by the TweenFactory landBounce preset

export class ReelStopAnimator {
  private reel: ReelStripView;
  private isActive: boolean = false;
  private finalSymbols: string[] = [];
  private onComplete: (() => void) | null = null;
  private elapsedTime: number = 0;
  private phase: 'approach' | 'complete' = 'complete';
  private readonly APPROACH_DURATION = 0.2; // Time to reach target
  
  constructor(reel: ReelStripView) {
    this.reel = reel;
  }

  public start(finalSymbols: string[], onComplete: () => void): void {
    this.isActive = true;
    this.finalSymbols = finalSymbols;
    this.onComplete = onComplete;
    this.elapsedTime = 0;
    this.phase = 'approach';
  }

  public update(deltaTime: number): void {
    if (!this.isActive) return;

    this.elapsedTime += deltaTime;

    switch (this.phase) {
      case 'approach':
        this.updateApproach(deltaTime);
        break;
      case 'complete':
        this.complete();
        break;
    }
  }

  private updateApproach(deltaTime: number): void {
    const progress = Math.min(this.elapsedTime / this.APPROACH_DURATION, 1);

    if (progress >= 1) {
      // Snap to final positions; the landBounce tween handles the visual bounce
      this.setFinalSymbolPositions();
      this.phase = 'complete';
    }
  }

  private setFinalSymbolPositions(): void {
    const symbols = this.reel.getSymbols();
    const config = this.reel.getConfig();
    const isHorizontal = this.reel.isHorizontal();
    
    // Set final symbol IDs
    const visibleStart = 1;
    const visibleCount = isHorizontal ? config.cols : config.rows;
    for (let i = 0; i < this.finalSymbols.length && i < visibleCount; i++) {
      const symbol = symbols[visibleStart + i];
      if (symbol) {
        symbol.setSymbolId(this.finalSymbols[i]);
      }
    }
    
    // Reset positions to grid-aligned values
    if (isHorizontal) {
      const cellWidth = config.cellWidth + config.spacing;
      for (let i = 0; i < symbols.length; i++) {
        symbols[i].x = (i - 1) * cellWidth + config.cellWidth / 2;
        symbols[i].y = config.cellHeight / 2;
      }
    } else {
      const cellHeight = config.cellHeight + config.spacing;
      for (let i = 0; i < symbols.length; i++) {
        symbols[i].x = config.cellWidth / 2;
        symbols[i].y = (i - 1) * cellHeight + config.cellHeight / 2;
      }
    }
  }

  private complete(): void {
    if (!this.isActive) return;
    
    const symbols = this.reel.getSymbols();
    const config = this.reel.getConfig();
    const isHorizontal = this.reel.isHorizontal();
    
    if (isHorizontal) {
      const cellWidth = config.cellWidth + config.spacing;
      for (let i = 0; i < symbols.length; i++) {
        symbols[i].x = (i - 1) * cellWidth + config.cellWidth / 2;
        symbols[i].y = config.cellHeight / 2;
      }
    } else {
      const cellHeight = config.cellHeight + config.spacing;
      for (let i = 0; i < symbols.length; i++) {
        symbols[i].x = config.cellWidth / 2;
        symbols[i].y = (i - 1) * cellHeight + config.cellHeight / 2;
      }
    }
    
    this.isActive = false;
    this.phase = 'complete';
    
    if (this.onComplete) {
      this.onComplete();
      this.onComplete = null;
    }
  }




  public isAnimating(): boolean {
    return this.isActive;
  }

  public forceComplete(): void {
    if (this.isActive) {
      this.phase = 'complete';
      this.complete();
    }
  }
}
