/**
 * SpinLoop - Manages the spin lifecycle
 */

import { GridManager } from '../../presentation/grid/GridManager';
import { EventBus } from '../../platform/events/EventBus';
 import { Logger } from '../../platform/logger/Logger';

export enum SpinPhase {
  IDLE = 'idle',
  STARTING = 'starting',
  SPINNING = 'spinning',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
}

export class SpinLoop {
  private gridManager: GridManager;
  private eventBus: EventBus;
  private phase: SpinPhase = SpinPhase.IDLE;
  private spinStartTime: number = 0;
  private minSpinDuration: number = 500;
   private logger: Logger;

  constructor() {
    this.gridManager = GridManager.getInstance();
    this.eventBus = EventBus.getInstance();
     this.logger = Logger.create('SpinLoop');
  }

  public startSpin(): void {
     if (this.phase !== SpinPhase.IDLE) {
       this.logger.warn(`Cannot start spin - not idle, current phase: ${this.phase}`);
       return;
     }

    this.phase = SpinPhase.STARTING;
    this.spinStartTime = performance.now();
     this.logger.debug('Spin starting');

    // Use GridManager to start all grids (primary + secondary)
    this.gridManager.startSpin();

    this.phase = SpinPhase.SPINNING;
     this.logger.debug('Reels spinning');
  }

  public stopSpin(symbols: string[][], secondarySymbols?: string[][]): void {
     if (this.phase !== SpinPhase.SPINNING) {
       this.logger.warn(`Cannot stop spin - not spinning, current phase: ${this.phase}`);
       return;
     }

    const elapsed = performance.now() - this.spinStartTime;
    const delay = Math.max(0, this.minSpinDuration - elapsed);
     this.logger.debug(`Stopping spin after ${elapsed.toFixed(0)}ms (delay: ${delay}ms)`);

    setTimeout(() => {
      this.phase = SpinPhase.STOPPING;
       this.logger.debug('Reels stopping');
      
      // Use GridManager to stop all grids (primary + secondary)
      this.gridManager.stopSpin(symbols, secondarySymbols);

      // Wait for all reels to stop
      this.waitForStop();
    }, delay);
  }

  private waitForStop(): void {
    const checkStopped = () => {
      // Check GridManager.isSpinning() which covers both primary + secondary grids
      if (!this.gridManager.isSpinning()) {
        this.phase = SpinPhase.STOPPED;
         this.logger.debug('All reels stopped');
        
        // Emit reels stopped event
        this.eventBus.emit('game:reels:stopped', { symbols: [] });
        
         // Immediately transition to IDLE to allow next spin
        setTimeout(() => {
          this.phase = SpinPhase.IDLE;
           this.logger.debug('Phase set to IDLE - ready for next spin');
         }, 50);
      } else {
        requestAnimationFrame(checkStopped);
      }
    };

    requestAnimationFrame(checkStopped);
  }

  public getPhase(): SpinPhase {
    return this.phase;
  }

  public isSpinning(): boolean {
    return this.phase !== SpinPhase.IDLE && this.phase !== SpinPhase.STOPPED;
  }

  public forceStop(): void {
    // Emergency stop
    this.phase = SpinPhase.IDLE;
     this.logger.warn('Force stopped - phase reset to IDLE');
  }
}
