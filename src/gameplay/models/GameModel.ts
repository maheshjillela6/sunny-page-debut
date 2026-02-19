/**
 * GameModel - Game configuration and state model
 */

import { MoneyValue } from './WalletModel';

export type GameType = 'SLOT' | 'TABLE' | 'INSTANT';
export type PaylinesType = 'LINES' | 'WAYS' | 'CLUSTER' | 'MEGAWAYS';
export type FeatureType = 
  | 'FREE_SPINS' | 'HOLD_RESPIN' | 'GAMBLE' | 'MYSTERY' | 'EXPAND'
  | 'TUMBLE' | 'MULTIPLIERS' | 'BONUS_WHEEL' | 'JACKPOT' | 'MEGAWAYS'
  | 'MULTI_GAME' | 'MULTI_LINE' | 'MULTI_COIN' | 'RETRIGGER';

export interface ReelsConfig {
  rows: number;
  cols: number;
  paylinesType: PaylinesType;
  waysCount: number;
  cellWidth?: number;
  cellHeight?: number;
  spacing?: number;
}

export interface GameConfig {
  rtp: number;
  volatility: 'low' | 'medium' | 'high';
  maxWinXBet: number;
  featuresAvailable: FeatureType[];
}

export interface PreviousRound {
  roundId: string;
  matrixString: string;
  win: MoneyValue;
}

export interface GameState {
  screen: 'lobby' | 'game' | 'reconnect' | 'loading';
  availableActions: string[];
}

export interface GameData {
  gameId: string;
  gameName: string;
  gameType: GameType;
  currency: string;
  reels: ReelsConfig;
  config: GameConfig;
  previousRound: PreviousRound | null;
  state: GameState;
}

export class GameModel {
  private data: GameData;
  private isLoaded: boolean = false;
  private loadTime: number = 0;

  constructor() {
    this.data = this.createDefaultData();
  }

  private createDefaultData(): GameData {
    return {
      gameId: '',
      gameName: '',
      gameType: 'SLOT',
      currency: 'GBP',
      reels: {
        rows: 4,
        cols: 5,
        paylinesType: 'WAYS',
        waysCount: 1024,
        cellWidth: 120,
        cellHeight: 120,
        spacing: 8,
      },
      config: {
        rtp: 96.5,
        volatility: 'high',
        maxWinXBet: 10000,
        featuresAvailable: [],
      },
      previousRound: null,
      state: {
        screen: 'lobby',
        availableActions: [],
      },
    };
  }

  // Initialization from server response
  public initFromLaunchResponse(response: {
    gameId: string;
    gamename: string;
    gameType: string;
    currency: string;
    reels: {
      rows: number;
      cols: number;
      paylinesType: string;
      waysCount: number;
    };
    config: {
      rtp: number;
      volatility: string;
      maxWinXBet: number;
      featuresAvailable: string[];
    };
    previousRound?: {
      roundId: string;
      matrixString: string;
      win: MoneyValue;
    };
    state: {
      screen: string;
      availableActions: string[];
    };
  }): void {
    this.data = {
      gameId: response.gameId,
      gameName: response.gamename,
      gameType: response.gameType as GameType,
      currency: response.currency,
      reels: {
        rows: response.reels.rows,
        cols: response.reels.cols,
        paylinesType: response.reels.paylinesType as PaylinesType,
        waysCount: response.reels.waysCount,
        cellWidth: 120,
        cellHeight: 120,
        spacing: 8,
      },
      config: {
        rtp: response.config.rtp,
        volatility: response.config.volatility as 'low' | 'medium' | 'high',
        maxWinXBet: response.config.maxWinXBet,
        featuresAvailable: response.config.featuresAvailable as FeatureType[],
      },
      previousRound: response.previousRound || null,
      state: {
        screen: response.state.screen as GameState['screen'],
        availableActions: response.state.availableActions,
      },
    };

    this.isLoaded = true;
    this.loadTime = Date.now();
  }

  // Getters
  public getGameId(): string { return this.data.gameId; }
  public getGameName(): string { return this.data.gameName; }
  public getGameType(): GameType { return this.data.gameType; }
  public getCurrency(): string { return this.data.currency; }
  public getReelsConfig(): ReelsConfig { return { ...this.data.reels }; }
  public getConfig(): GameConfig { return { ...this.data.config }; }
  public getPreviousRound(): PreviousRound | null { 
    return this.data.previousRound ? { ...this.data.previousRound } : null; 
  }
  public getState(): GameState { return { ...this.data.state }; }
  public isGameLoaded(): boolean { return this.isLoaded; }

  // Grid configuration helpers
  public getGridSize(): { rows: number; cols: number } {
    return { rows: this.data.reels.rows, cols: this.data.reels.cols };
  }

  public getWaysCount(): number {
    return this.data.reels.waysCount;
  }

  public getPaylinesType(): PaylinesType {
    return this.data.reels.paylinesType;
  }

  // Feature helpers
  public hasFeature(feature: FeatureType): boolean {
    return this.data.config.featuresAvailable.includes(feature);
  }

  public getAvailableFeatures(): FeatureType[] {
    return [...this.data.config.featuresAvailable];
  }

  // State management
  public setState(state: Partial<GameState>): void {
    this.data.state = { ...this.data.state, ...state };
  }

  public setScreen(screen: GameState['screen']): void {
    this.data.state.screen = screen;
  }

  public setAvailableActions(actions: string[]): void {
    this.data.state.availableActions = actions;
  }

  public canPerformAction(action: string): boolean {
    return this.data.state.availableActions.includes(action);
  }

  // Serialization
  public getData(): GameData {
    return { ...this.data };
  }

  public toJSON(): GameData {
    return this.getData();
  }

  public static fromJSON(json: GameData): GameModel {
    const model = new GameModel();
    model.data = json;
    model.isLoaded = true;
    return model;
  }
}

export default GameModel;
