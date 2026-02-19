/**
 * RoundState - Reactive round state wrapper with singleton pattern
 */

import { RoundModel, RoundData, RoundMode, WinInfo, TumbleInfo, MultiplierInfo, Position } from '../models/RoundModel';
import { MoneyValue } from '../models/WalletModel';
import { EventBus } from '@/platform/events/EventBus';

export class RoundState {
  private static instance: RoundState | null = null;

  private model: RoundModel;
  private eventBus: EventBus;
  private lastMatrix: string = '';
  private lastWin: number = 0;

  private constructor(model?: RoundModel) {
    this.model = model || new RoundModel();
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): RoundState {
    if (!RoundState.instance) {
      RoundState.instance = new RoundState();
    }
    return RoundState.instance;
  }

  // Round lifecycle
  public startRound(roundId: string, mode: RoundMode, stake: MoneyValue): void {
    this.model.startRound(roundId, mode, stake);
    this.eventBus.emit('round:started', { roundId, mode });
  }

  public setResult(
    matrixString: string,
    win: MoneyValue,
    wins: WinInfo[],
    waysCount: number
  ): void {
    this.model.setResult(matrixString, win, wins, waysCount);
    this.lastMatrix = matrixString;
    this.lastWin = win.amount;
    
    this.eventBus.emit('round:result', {
      roundId: this.model.getRoundId(),
      matrix: this.model.getMatrix(),
      win,
      wins,
    });
  }

  public setTumbles(tumbles: TumbleInfo[]): void {
    this.model.setTumbles(tumbles);
    if (tumbles.length > 0) {
      this.eventBus.emit('round:tumbles', { 
        roundId: this.model.getRoundId(),
        tumbles,
      });
    }
  }

  public setMultipliers(multipliers: MultiplierInfo): void {
    this.model.setMultipliers(multipliers);
    if (multipliers.global > 1) {
      this.eventBus.emit('round:multiplier', {
        roundId: this.model.getRoundId(),
        multiplier: multipliers.global,
        sources: multipliers.sources,
      });
    }
  }

  public startPresentation(): void {
    this.model.startPresentation();
    this.eventBus.emit('round:presentation:start', {
      roundId: this.model.getRoundId(),
    });
  }

  public completeRound(): void {
    const roundId = this.model.getRoundId();
    const totalWin = this.model.getTotalWin();
    const duration = this.model.getDuration();
    
    this.model.completeRound();
    
    this.eventBus.emit('round:complete', { roundId, totalWin, duration });
  }

  // Session persistence helpers
  public setLastMatrix(matrix: string): void {
    this.lastMatrix = matrix;
  }

  public getLastMatrix(): string {
    return this.lastMatrix;
  }

  public setWin(amount: number): void {
    this.lastWin = amount;
  }

  public getLastWin(): number {
    return this.lastWin;
  }

  public setCurrentRound(data: { roundId: string; roundSeq?: number; mode: string; matrixString: string }): void {
    this.lastMatrix = data.matrixString;
  }

  public setPreviousRound(data: { roundId: string; matrixString: string; win: { amount: number; currency: string } }): void {
    this.lastMatrix = data.matrixString;
    this.lastWin = data.win.amount;
  }

  // Getters
  public getRoundId(): string { return this.model.getRoundId(); }
  public getMode(): RoundMode { return this.model.getMode(); }
  public getMatrix(): string[][] { return this.model.getMatrix(); }
  public getWins(): WinInfo[] { return this.model.getWins(); }
  public getTumbles(): TumbleInfo[] { return this.model.getTumbles(); }
  public getMultipliers(): MultiplierInfo { return this.model.getMultipliers(); }
  public hasWin(): boolean { return this.model.hasWin(); }
  public hasTumbles(): boolean { return this.model.hasTumbles(); }
  public getTotalWin(): number { return this.model.getTotalWin(); }

  public getWinningPositions(): Position[] {
    return this.model.getWinningPositions();
  }

  public isWinningPosition(row: number, col: number): boolean {
    return this.model.isWinningPosition(row, col);
  }

  public getSymbolAt(row: number, col: number): string | null {
    return this.model.getSymbolAt(row, col);
  }

  // State access
  public getData(): RoundData {
    return this.model.getData();
  }

  public isSpinning(): boolean {
    return this.model.getState() === 'spinning';
  }

  public isEvaluating(): boolean {
    return this.model.getState() === 'evaluating';
  }

  public isPresenting(): boolean {
    return this.model.getState() === 'presenting';
  }

  public isComplete(): boolean {
    return this.model.getState() === 'complete';
  }

  public reset(): void {
    this.model = new RoundModel();
    this.lastMatrix = '';
    this.lastWin = 0;
  }

  public static reset(): void {
    if (RoundState.instance) {
      RoundState.instance.reset();
      RoundState.instance = null;
    }
  }
}

export default RoundState;
