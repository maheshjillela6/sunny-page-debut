/**
 * RoundModel - Game round data model
 */

import { MoneyValue } from './WalletModel';

export type RoundMode = 'BASE' | 'FS' | 'HNS' | 'BONUS';
export type RoundState = 'pending' | 'spinning' | 'evaluating' | 'presenting' | 'complete';

export interface Position {
  row: number;
  col: number;
}

export interface WinInfo {
  lineId: number;
  symbols: string[];
  positions: Position[];
  amount: number;
  multiplier: number;
  way?: number;
}

export interface TumbleInfo {
  index: number;
  matrixStringBefore?: string;
  matrixStringAfter: string;
  win: MoneyValue;
  multiplierApplied: number;
  /** Winning positions in this tumble step */
  winPositions?: Position[];
  /** Winning details per cluster/line */
  wins?: Array<{
    symbol: string;
    positions: Position[];
    amount: number;
    matchCount: number;
  }>;
  /** Symbols that were removed */
  removedPositions?: Position[];
  /** Movement of remaining symbols */
  movements?: Array<{
    from: Position;
    to: Position;
    symbol: string;
  }>;
  /** New symbols that entered the grid */
  refills?: Array<{
    position: Position;
    symbol: string;
  }>;
  /** Cumulative win across all tumble steps */
  cumulativeWin?: number;
}

export interface MultiplierInfo {
  global: number;
  sources: Array<{
    type: string;
    value: number;
  }>;
}

export interface MysteryInfo {
  positions: Position[];
  revealedSymbol: string;
}

export interface ExpandingInfo {
  symbol: string;
  reelsExpanded: number[];
}

export interface JackpotPool {
  id: string;
  type: 'progressive' | 'fixed';
  displayAmount: number;
}

export interface JackpotInfo {
  contribution: MoneyValue;
  pools: JackpotPool[];
  draw: 'none' | 'pending' | 'won';
  wonPoolId?: string;
  wonAmount?: number;
}

export interface RoundData {
  roundId: string;
  roundSeq: number;
  mode: RoundMode;
  state: RoundState;
  matrixString: string;
  matrix: string[][];
  waysCount: number;
  stake: MoneyValue;
  win: MoneyValue;
  wins: WinInfo[];
  tumbles: TumbleInfo[];
  /** Raw steps from server (RESULT + CASCADE) */
  rawSteps: any[];
  multipliers: MultiplierInfo;
  mystery?: MysteryInfo;
  expanding?: ExpandingInfo;
  jackpot?: JackpotInfo;
}

export class RoundModel {
  private data: RoundData;
  private startTime: number = 0;
  private endTime: number = 0;

  constructor() {
    this.data = this.createEmptyRound();
  }

  private createEmptyRound(): RoundData {
    return {
      roundId: '',
      roundSeq: 0,
      mode: 'BASE',
      state: 'pending',
      matrixString: '',
      matrix: [],
      waysCount: 1024,
      stake: { amount: 0, currency: 'GBP' },
      win: { amount: 0, currency: 'GBP' },
      wins: [],
      tumbles: [],
      rawSteps: [],
      multipliers: { global: 1, sources: [] },
    };
  }

  // Matrix parsing
  public parseMatrixString(matrixString: string): string[][] {
    if (!matrixString) return [];
    
    const rows = matrixString.split(';');
    return rows.map(row => row.split(''));
  }

  public matrixToString(matrix: string[][]): string {
    return matrix.map(row => row.join('')).join(';');
  }

  // Round lifecycle
  public startRound(roundId: string, mode: RoundMode, stake: MoneyValue): void {
    this.data = this.createEmptyRound();
    this.data.roundId = roundId;
    this.data.mode = mode;
    this.data.stake = stake;
    this.data.state = 'spinning';
    this.startTime = Date.now();
  }

  public setResult(
    matrixString: string,
    win: MoneyValue,
    wins: WinInfo[],
    waysCount: number
  ): void {
    this.data.matrixString = matrixString;
    this.data.matrix = this.parseMatrixString(matrixString);
    this.data.win = win;
    this.data.wins = wins;
    this.data.waysCount = waysCount;
    this.data.state = 'evaluating';
  }

  public setTumbles(tumbles: TumbleInfo[]): void {
    this.data.tumbles = tumbles;
  }

  public setRawSteps(steps: any[]): void {
    this.data.rawSteps = steps;
  }

  public getRawSteps(): any[] {
    return this.data.rawSteps;
  }

  public setMultipliers(multipliers: MultiplierInfo): void {
    this.data.multipliers = multipliers;
  }

  public setMystery(mystery: MysteryInfo): void {
    this.data.mystery = mystery;
  }

  public setExpanding(expanding: ExpandingInfo): void {
    this.data.expanding = expanding;
  }

  public setJackpot(jackpot: JackpotInfo): void {
    this.data.jackpot = jackpot;
  }

  public startPresentation(): void {
    this.data.state = 'presenting';
  }

  public completeRound(): void {
    this.data.state = 'complete';
    this.endTime = Date.now();
  }

  // Getters
  public getRoundId(): string { return this.data.roundId; }
  public getMode(): RoundMode { return this.data.mode; }
  public getState(): RoundState { return this.data.state; }
  public getMatrix(): string[][] { return this.data.matrix.map(row => [...row]); }
  public getMatrixString(): string { return this.data.matrixString; }
  public getWin(): MoneyValue { return { ...this.data.win }; }
  public getWins(): WinInfo[] { return [...this.data.wins]; }
  public getTumbles(): TumbleInfo[] { return [...this.data.tumbles]; }
  public getMultipliers(): MultiplierInfo { return { ...this.data.multipliers }; }
  public getWaysCount(): number { return this.data.waysCount; }
  public hasWin(): boolean { return this.data.win.amount > 0; }
  public hasTumbles(): boolean { return this.data.tumbles.length > 0; }

  public getTotalWin(): number {
    let total = this.data.win.amount;
    for (const tumble of this.data.tumbles) {
      total += tumble.win.amount;
    }
    return total;
  }

  public getDuration(): number {
    if (!this.endTime) return Date.now() - this.startTime;
    return this.endTime - this.startTime;
  }

  // Symbol helpers
  public getSymbolAt(row: number, col: number): string | null {
    if (row < 0 || row >= this.data.matrix.length) return null;
    if (col < 0 || col >= this.data.matrix[row].length) return null;
    return this.data.matrix[row][col];
  }

  public getWinningPositions(): Position[] {
    const positions: Position[] = [];
    for (const win of this.data.wins) {
      positions.push(...win.positions);
    }
    return positions;
  }

  public isWinningPosition(row: number, col: number): boolean {
    return this.data.wins.some(win =>
      win.positions.some(pos => pos.row === row && pos.col === col)
    );
  }

  // Serialization
  public getData(): RoundData {
    return { ...this.data };
  }

  public toJSON(): RoundData {
    return this.getData();
  }

  public static fromJSON(json: RoundData): RoundModel {
    const model = new RoundModel();
    model.data = json;
    return model;
  }
}

export default RoundModel;
