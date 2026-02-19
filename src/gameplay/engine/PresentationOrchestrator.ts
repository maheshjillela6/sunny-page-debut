/**
 * PresentationOrchestrator - Orchestrates visual presentations
 */

import { EventBus } from '../../platform/events/EventBus';
import { ScreenManager } from '../../presentation/screens/ScreenManager';
import { BaseScreen } from '../../presentation/screens/base/BaseScreen';
import { WinData } from '../../platform/events/EventMap';

export class PresentationOrchestrator {
  private static instance: PresentationOrchestrator | null = null;

  private eventBus: EventBus;
  private screenManager: ScreenManager;
  private currentWins: WinData[] = [];
  private winDisplayIndex: number = 0;
  private isShowingWins: boolean = false;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.screenManager = ScreenManager.getInstance();
    this.setupEventListeners();
  }

  public static getInstance(): PresentationOrchestrator {
    if (!PresentationOrchestrator.instance) {
      PresentationOrchestrator.instance = new PresentationOrchestrator();
    }
    return PresentationOrchestrator.instance;
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:result', (payload) => {
      // StepSequencePresenter now owns win presentation — only store for reference
      this.currentWins = payload.wins;
    });

    // REMOVED: game:reels:stopped listener that was triggering a competing
    // win sequence in parallel with StepSequencePresenter. The step presenter
    // is the single owner of win presentation after reels stop.

    this.eventBus.on('game:spin:complete', () => {
      this.clearWinPresentation();
    });
  }

  private showWinSequence(): void {
    if (this.currentWins.length === 0) return;

    this.isShowingWins = true;
    this.winDisplayIndex = 0;
    this.showNextWin();
  }

  private showNextWin(): void {
    if (this.winDisplayIndex >= this.currentWins.length) {
      this.winDisplayIndex = 0;
    }

    const win = this.currentWins[this.winDisplayIndex];
    const screen = this.screenManager.getCurrentScreen() as BaseScreen;

    if (screen && screen.showWinHighlights) {
      screen.showWinHighlights(win.positions, this.getWinColor(win.amount));
    }

    this.winDisplayIndex++;
  }

  private getWinColor(amount: number): number {
    if (amount >= 100) return 0xf1c40f;
    if (amount >= 50) return 0xe67e22;
    return 0x3498db;
  }

  private clearWinPresentation(): void {
    this.isShowingWins = false;
    this.currentWins = [];
    this.winDisplayIndex = 0;

    const screen = this.screenManager.getCurrentScreen() as BaseScreen;
    if (screen && screen.clearWinHighlights) {
      screen.clearWinHighlights();
    }
  }

  public isShowingWinPresentation(): boolean {
    return this.isShowingWins;
  }

  public destroy(): void {
    PresentationOrchestrator.instance = null;
  }
}
