/**
 * GameSession - Main game session state management with persistence
 */

import { EventBus } from '@/platform/events/EventBus';
import { SessionTokenManager, StoredSession } from '@/platform/networking/SessionTokenManager';
import { UserModel } from '../models/UserModel';
import { WalletModel } from '../models/WalletModel';
import { GameModel } from '../models/GameModel';
import { RoundModel } from '../models/RoundModel';
import { FeatureModel, SeriesData, FeatureQueue } from '../models/FeatureModel';
import { 
  GameLaunchResponse, 
  SpinResponse, 
  FeatureActionResponse, 
  BuyBonusResponse,
  UnfinishedSession as APIUnfinishedSession 
} from '@/platform/networking/APIProtocol';

export type SessionState = 'uninitialized' | 'initializing' | 'ready' | 'playing' | 'paused' | 'disconnected' | 'error';

export interface UnfinishedSession {
  exists: boolean;
  reason?: string;
  resumeEndpoint?: string;
  serverStateHash?: string;
  series?: Array<{
    seriesId: string;
    mode: string;
    remainingSpins?: number;
    remainingRespins?: number;
    resumeToken: string;
  }>;
}

export class GameSession {
  private static instance: GameSession | null = null;

  private sessionId: string = '';
  private state: SessionState = 'uninitialized';
  private startTime: number = 0;
  private lastActivity: number = 0;
  private currentGameId: string = '';

  private user: UserModel;
  private wallet: WalletModel;
  private game: GameModel;
  private round: RoundModel;
  private feature: FeatureModel;
  private eventBus: EventBus;
  private tokenManager: SessionTokenManager;

  private unfinished: UnfinishedSession = { exists: false };

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();
    this.user = new UserModel();
    this.wallet = new WalletModel();
    this.game = new GameModel();
    this.round = new RoundModel();
    this.feature = new FeatureModel();

    this.setupEventListeners();
    this.restoreFromStorage();
  }

  public static getInstance(): GameSession {
    if (!GameSession.instance) {
      GameSession.instance = new GameSession();
    }
    return GameSession.instance;
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:request', () => {
      this.updateActivity();
    });

    this.eventBus.on('game:spin:complete', () => {
      this.updateActivity();
      this.persistSession();
    });

    this.eventBus.on('wallet:balance:update', (payload) => {
      this.tokenManager.updateSessionBalance(payload.newBalance);
    });
  }

  private restoreFromStorage(): void {
    if (this.tokenManager.hasStoredSession() && this.tokenManager.isSessionValid()) {
      const stored = this.tokenManager.getStoredSession();
      if (stored) {
        this.sessionId = stored.sessionId;
        this.user.setSessionToken(stored.token);
        this.user.updateData({ userId: stored.userId });
        this.wallet.setBalance(stored.balance);
        this.currentGameId = stored.gameId;
        
        if (stored.unfinished?.exists) {
          this.unfinished = {
            exists: true,
            series: stored.unfinished.seriesId ? [{
              seriesId: stored.unfinished.seriesId,
              mode: stored.unfinished.mode || 'FS',
              resumeToken: stored.unfinished.resumeToken || '',
            }] : [],
          };
        }

        this.state = 'ready';
        console.log('[GameSession] Restored from storage:', this.sessionId);
      }
    }
  }

  private persistSession(): void {
    const session: StoredSession = {
      sessionId: this.sessionId,
      token: this.user.getSessionToken(),
      userId: this.user.getUserId(),
      gameId: this.currentGameId,
      timestamp: Date.now(),
      balance: this.wallet.getBalance(),
      currency: this.wallet.getCurrency(),
      unfinished: this.unfinished.exists ? {
        exists: true,
        seriesId: this.unfinished.series?.[0]?.seriesId,
        mode: this.unfinished.series?.[0]?.mode,
        resumeToken: this.unfinished.series?.[0]?.resumeToken,
      } : { exists: false },
    };

    this.tokenManager.storeSession(session);
  }

  // Initialize from API game launch response
  public initFromLaunchResponse(response: GameLaunchResponse['data']): void {
    console.log('[GameSession] Initializing from launch response:', {
      gameId: response.gameId,
      userId: response.userId,
      balance: response.balance?.amount,
    });

    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.lastActivity = Date.now();
    this.currentGameId = response.gameId;

    // Initialize user model
    this.user.updateData({
      userId: response.userId,
      currency: response.currency,
    });
    this.user.setSessionToken(this.tokenManager.getToken());

    // Initialize wallet model with balance from server
    this.wallet.startSession(response.balance.amount);
    this.wallet.setLines(response.reels?.waysCount || 1024);

    // Initialize game model
    this.game.initFromLaunchResponse(response);

    // Handle unfinished session from server
    if (response.unfinished?.exists) {
      this.unfinished = {
        exists: true,
        reason: response.unfinished.reason,
        resumeEndpoint: response.unfinished.resumeEndpoint,
        serverStateHash: response.unfinished.serverStateHash,
        series: response.unfinished.series?.map(s => ({
          seriesId: s.seriesId,
          mode: s.mode,
          remainingSpins: s.remainingSpins,
          remainingRespins: s.remainingRespins,
          resumeToken: s.resumeToken,
        })),
      };
      this.state = 'disconnected';
    } else {
      this.unfinished = { exists: false };
      this.state = 'ready';
    }

    this.persistSession();
    this.updateActivity();

    console.log('[GameSession] Session initialized:', {
      sessionId: this.sessionId,
      gameId: response.gameId,
      balance: this.wallet.getBalance(),
      hasUnfinished: this.unfinished.exists,
    });

    this.eventBus.emit('session:initialized', {
      sessionId: this.sessionId,
      gameId: response.gameId,
      hasUnfinished: this.unfinished.exists,
    });
  }

  // Handle spin response - store all data in models
  public handleSpinResponse(response: SpinResponse['data']): void {
    console.log('[GameSession] Processing spin response:', {
      roundId: response.round?.roundId,
      win: response.win?.amount,
      balance: response.balance?.amount,
    });

    this.updateActivity();

    // Update wallet model with new balance from server
    this.wallet.setBalance(response.balance.amount);

    // Update round model with spin result
    this.round.startRound(
      response.round.roundId,
      response.round.mode as any,
      response.stake
    );

    // Extract wins and tumbles from steps array
    const steps = response.steps || [];
    const resultStep = steps.find((s) => s.type === 'RESULT') as any;
    const cascadeSteps = steps.filter((s) => s.type === 'CASCADE');

    const initialWins = resultStep?.wins || [];
    const matrixString = resultStep?.grid?.matrixString || response.round.matrixString;

    this.round.setResult(
      matrixString,
      response.win,
      initialWins as any[],
      response.round.waysCount || 1024
    );

    // Store steps in round model
    this.round.setRawSteps(steps);

    if (cascadeSteps.length > 0) {
      // Convert cascade steps to tumbles for backward compat
      const tumbles = cascadeSteps.map((cs: any) => ({
        index: cs.index,
        matrixStringBefore: cs.gridBefore?.matrixString,
        matrixStringAfter: cs.gridAfter?.matrixString,
        win: cs.stepWin || { amount: 0, currency: response.currency },
        multiplierApplied: cs.multiplier || 1,
        winPositions: cs.removedPositions,
        wins: cs.wins,
        removedPositions: cs.removedPositions,
        movements: cs.movements,
        refills: cs.refills,
        cumulativeWin: cs.cumulativeWin?.amount || 0,
      }));
      this.round.setTumbles(tumbles);
    }

    if (response.multipliers) {
      this.round.setMultipliers(response.multipliers);
    }

    // Handle feature triggers - store in feature model
    if (response.series) {
      this.feature.startSeries(response.series as SeriesData);
    }

    if (response.featureQueue) {
      this.feature.setQueue(response.featureQueue as FeatureQueue[]);
    }

    // Emit round result event
    this.eventBus.emit('round:result', {
      roundId: response.round.roundId,
      matrix: this.round.getMatrix(),
      win: response.win,
      wins: initialWins as any[],
      steps,
    });

    // Persist updated session state
    this.persistSession();
  }

  // Handle feature action response
  public handleFeatureActionResponse(response: FeatureActionResponse['data']): void {
    this.updateActivity();

    // Update wallet
    this.wallet.setBalance(response.balance.amount);

    // Update series
    if (response.series) {
      this.feature.updateSeries(response.series as Partial<SeriesData>);
    }

    // Handle step data (free spin result)
    if (response.step) {
      this.round.startRound(
        response.step.roundId,
        this.feature.getMode() as any,
        { amount: 0, currency: response.currency }
      );

      this.round.setResult(
        response.step.matrixString,
        response.step.win,
        [],
        1024
      );

      if (response.step.multipliers) {
        this.round.setMultipliers(response.step.multipliers);
      }

      if (response.step.retrigger && response.step.retrigger.spins > 0) {
        this.feature.retriggerFreeSpins(response.step.retrigger.spins);
      }
    }

    // Handle HNS data
    if (response.hns) {
      // Update locked items
      for (const item of response.hns.lockedItems) {
        if (!this.feature.getHoldNSpinState().lockedItems.some(
          l => l.row === item.row && l.col === item.col
        )) {
          this.feature.addLockedItem(item);
        }
      }
    }

    // Check if feature ended
    const series = this.feature.getSeries();
    if (series) {
      const isComplete = 
        (series.remainingSpins !== undefined && series.remainingSpins <= 0) ||
        (series.remainingRespins !== undefined && series.remainingRespins <= 0);

      if (isComplete && !response.nextAction.allowed.includes('PLAY')) {
        this.feature.endSeries();
        this.eventBus.emit('feature:end', {
          featureType: series.mode,
          totalWin: this.wallet.getBalance(),
        });
      }
    }

    this.persistSession();
  }

  // Handle buy bonus response
  public handleBuyBonusResponse(response: BuyBonusResponse['data']): void {
    this.updateActivity();

    // Update wallet
    this.wallet.setBalance(response.balance.amount);

    // Start series
    if (response.series) {
      this.feature.startSeries(response.series as SeriesData);
    }

    // Initialize HNS if present
    if (response.hns) {
      const corPositions = response.hns.corPositions?.split(',').map(Number) || [];
      const corValues = response.hns.corValues?.split(',').map(Number) || [];
      
      this.feature.initHoldNSpin(
        response.hns.startLives,
        response.hns.lockedItems,
        corPositions,
        corValues
      );
    }

    if (response.featureQueue) {
      this.feature.setQueue(response.featureQueue as FeatureQueue[]);
    }

    this.persistSession();
  }

  // Session lifecycle
  public async initialize(sessionToken: string, userId: string): Promise<void> {
    this.state = 'initializing';
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.lastActivity = Date.now();

    this.user.setSessionToken(sessionToken);
    this.user.updateData({ userId });

    this.state = 'ready';
    this.eventBus.emit('session:ready', { sessionId: this.sessionId });
  }

  public startPlaying(): void {
    if (this.state === 'ready') {
      this.state = 'playing';
      this.eventBus.emit('session:playing', { sessionId: this.sessionId });
    }
  }

  public pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.eventBus.emit('session:paused', { sessionId: this.sessionId });
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.updateActivity();
      this.eventBus.emit('session:resumed', { sessionId: this.sessionId });
    }
  }

  public disconnect(): void {
    this.state = 'disconnected';
    this.persistSession();
    this.eventBus.emit('session:disconnected', { sessionId: this.sessionId });
  }

  public reconnect(): void {
    if (this.state === 'disconnected') {
      this.state = 'ready';
      this.updateActivity();
      this.eventBus.emit('session:reconnected', { sessionId: this.sessionId });
    }
  }

  public setError(error: Error): void {
    this.state = 'error';
    this.eventBus.emit('session:error', {
      sessionId: this.sessionId,
      error: error.message,
    });
  }

  // Activity tracking
  private updateActivity(): void {
    this.lastActivity = Date.now();
  }

  public getIdleTime(): number {
    return Date.now() - this.lastActivity;
  }

  public getSessionDuration(): number {
    return Date.now() - this.startTime;
  }

  // Getters
  public getSessionId(): string { return this.sessionId; }
  public getState(): SessionState { return this.state; }
  public getUser(): UserModel { return this.user; }
  public getWallet(): WalletModel { return this.wallet; }
  public getGame(): GameModel { return this.game; }
  public getRound(): RoundModel { return this.round; }
  public getFeature(): FeatureModel { return this.feature; }
  public getCurrentGameId(): string { return this.currentGameId; }
  public getUnfinished(): UnfinishedSession { return { ...this.unfinished }; }

  public hasUnfinishedSession(): boolean {
    return this.unfinished.exists;
  }

  public clearUnfinished(): void {
    this.unfinished = { exists: false };
    this.tokenManager.clearUnfinished();
    this.persistSession();
  }

  // Utility
  private generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if can restore existing session
  public canRestoreSession(gameId: string): boolean {
    const stored = this.tokenManager.getStoredSession();
    return (
      stored !== null &&
      stored.gameId === gameId &&
      this.tokenManager.isSessionValid()
    );
  }

  // Snapshot for persistence
  public createSnapshot(): object {
    return {
      sessionId: this.sessionId,
      state: this.state,
      startTime: this.startTime,
      lastActivity: this.lastActivity,
      currentGameId: this.currentGameId,
      user: this.user.toJSON(),
      wallet: this.wallet.toJSON(),
      game: this.game.toJSON(),
      round: this.round.toJSON(),
      feature: this.feature.toJSON(),
      unfinished: this.unfinished,
    };
  }

  public restoreFromSnapshot(snapshot: any): void {
    this.sessionId = snapshot.sessionId;
    this.state = snapshot.state;
    this.startTime = snapshot.startTime;
    this.lastActivity = snapshot.lastActivity;
    this.currentGameId = snapshot.currentGameId;
    this.user = UserModel.fromJSON(snapshot.user);
    this.wallet = WalletModel.fromJSON(snapshot.wallet);
    this.game = GameModel.fromJSON(snapshot.game);
    this.round = RoundModel.fromJSON(snapshot.round);
    this.feature = FeatureModel.fromJSON(snapshot.feature);
    this.unfinished = snapshot.unfinished;
  }

  public destroy(): void {
    this.state = 'uninitialized';
    this.sessionId = '';
    this.currentGameId = '';
    GameSession.instance = null;
  }
}

export default GameSession;
