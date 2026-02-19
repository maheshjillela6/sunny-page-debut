/**
 * ReelController - Controls reel spinning logic
 */

import { ReelStripView, ReelState } from './ReelStripView';
import { EventBus } from '../../../platform/events/EventBus';

export class ReelController {
  private reels: ReelStripView[] = [];
  private eventBus: EventBus;
  private isSpinning: boolean = false;
  private stoppingReels: number = 0;

  constructor(reels: ReelStripView[]) {
    this.reels = reels;
    this.eventBus = EventBus.getInstance();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:reel:spin:stop', (payload) => {
      this.stoppingReels++;
      if (this.stoppingReels >= this.reels.length) {
        this.onAllReelsStopped();
      }
    });
  }

  public startSpin(): void {
    if (this.isSpinning) return;
    
    this.isSpinning = true;
    this.stoppingReels = 0;

    for (let i = 0; i < this.reels.length; i++) {
      setTimeout(() => {
        this.reels[i].startSpin();
      }, i * 80);
    }
  }

  public stopSpin(symbolMatrix: string[][]): void {
    if (!this.isSpinning) return;

    for (let i = 0; i < this.reels.length; i++) {
      const reelSymbols = symbolMatrix.map(row => row[i]);
      setTimeout(() => {
        this.reels[i].stopSpin(reelSymbols);
      }, i * 120);
    }
  }

  private onAllReelsStopped(): void {
    this.isSpinning = false;
    const symbols = this.getCurrentSymbols();
    this.eventBus.emit('game:reels:stopped', { symbols });
  }

  public getCurrentSymbols(): string[][] {
    const result: string[][] = [];
    const rows = this.reels[0]?.getConfig().rows ?? 3;

    for (let row = 0; row < rows; row++) {
      result[row] = [];
      for (let col = 0; col < this.reels.length; col++) {
        const symbols = this.reels[col].getSymbols();
        const symbol = symbols[row + 1];
        result[row][col] = symbol?.getSymbolId() ?? 'unknown';
      }
    }

    return result;
  }

  public isCurrentlySpinning(): boolean {
    return this.isSpinning;
  }

  public getReels(): ReelStripView[] {
    return this.reels;
  }
}
