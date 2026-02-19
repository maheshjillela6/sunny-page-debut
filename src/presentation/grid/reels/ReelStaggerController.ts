/**
 * ReelStaggerController - Controls staggered reel timing
 */

import { ReelStripView } from './ReelStripView';

export interface StaggerConfig {
  startDelay: number;
  stopDelay: number;
  minSpinTime: number;
}

export class ReelStaggerController {
  private reels: ReelStripView[];
  private config: StaggerConfig;

  constructor(reels: ReelStripView[], config?: Partial<StaggerConfig>) {
    this.reels = reels;
    this.config = {
      startDelay: config?.startDelay ?? 80,
      stopDelay: config?.stopDelay ?? 120,
      minSpinTime: config?.minSpinTime ?? 500,
    };
  }

  public async startStaggeredSpin(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < this.reels.length; i++) {
      const delay = i * this.config.startDelay;
      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            this.reels[i].startSpin();
            resolve();
          }, delay);
        })
      );
    }

    await Promise.all(promises);
  }

  public async stopStaggeredSpin(symbolMatrix: string[][]): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < this.reels.length; i++) {
      const reelSymbols = symbolMatrix.map(row => row[i]);
      const delay = i * this.config.stopDelay;
      
      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            this.reels[i].stopSpin(reelSymbols);
            resolve();
          }, delay);
        })
      );
    }

    await Promise.all(promises);
  }

  public getConfig(): StaggerConfig {
    return { ...this.config };
  }

  public setConfig(config: Partial<StaggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
