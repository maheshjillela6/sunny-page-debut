/**
 * FlowOrchestrator - Orchestrates game flow sequences
 */

import { EventBus } from '../../platform/events/EventBus';
import { GameController, GameState } from './GameController';

export class FlowOrchestrator {
  private static instance: FlowOrchestrator | null = null;

  private eventBus: EventBus;
  private gameController: GameController;
  private isAutoPlay: boolean = false;
  private autoPlayRemaining: number = 0;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.gameController = GameController.getInstance();
    this.setupEventListeners();
  }

  public static getInstance(): FlowOrchestrator {
    if (!FlowOrchestrator.instance) {
      FlowOrchestrator.instance = new FlowOrchestrator();
    }
    return FlowOrchestrator.instance;
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:complete', () => {
      if (this.isAutoPlay && this.autoPlayRemaining > 0) {
        this.autoPlayRemaining--;
        if (this.autoPlayRemaining > 0) {
          setTimeout(() => {
            this.gameController.requestSpin();
          }, 500);
        } else {
          this.stopAutoPlay();
        }
      }
    });

    this.eventBus.on('ui:autoplay:start', (payload) => {
      this.startAutoPlay(payload.totalSpins);
    });

    this.eventBus.on('ui:autoplay:stop', () => {
      this.stopAutoPlay();
    });
  }

  public startAutoPlay(spins: number): void {
    this.isAutoPlay = true;
    this.autoPlayRemaining = spins;
    this.gameController.requestSpin();
  }

  public stopAutoPlay(): void {
    this.isAutoPlay = false;
    this.autoPlayRemaining = 0;
    this.eventBus.emit('ui:autoplay:stop', {
      reason: 'user',
      spinsCompleted: 0,
    });
  }

  public isAutoPlaying(): boolean {
    return this.isAutoPlay;
  }

  public getAutoPlayRemaining(): number {
    return this.autoPlayRemaining;
  }

  public destroy(): void {
    FlowOrchestrator.instance = null;
  }
}
