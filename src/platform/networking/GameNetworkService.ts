/**
 * GameNetworkService - High-level game communication service using STOMP
 * Handles game launch, spin, features, and reconnection flows with full API protocol
 */

import { EventBus } from '@/platform/events/EventBus';
import { StompClient, StompMessage } from './StompClient';
import { SessionTokenManager } from './SessionTokenManager';
import { MockGameServer } from './MockGameServer';
import { GameSession } from '@/gameplay/state/GameSession';
import {
  GameLaunchRequest,
  GameLaunchResponse,
  SpinRequest,
  SpinResponse,
  FeatureActionRequest,
  FeatureActionResponse,
  BuyBonusRequest,
  BuyBonusResponse,
  BalanceResponse,
  createRequestMeta,
  BetData,
} from './APIProtocol';

export type NetworkMode = 'stomp' | 'rest' | 'mock';

export interface GameResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
  latency: number;
}

// STOMP destinations
const DESTINATIONS = {
  // Client to server
  GAME_LAUNCH: '/app/game/launch',
  SPIN: '/app/game/spin',
  FEATURE_ACTION: '/app/game/feature',
  BUY_BONUS: '/app/game/buyBonus',
  BALANCE: '/app/game/balance',
  RECONNECT: '/app/game/reconnect',

  // Server to client (subscriptions)
  USER_QUEUE: '/user/queue/game',
  GAME_UPDATES: '/topic/game/',
  JACKPOT_UPDATES: '/topic/jackpots',
} as const;

/**
 * GameNetworkService provides game-specific network operations
 */
export class GameNetworkService {
  private static instance: GameNetworkService | null = null;

  private eventBus: EventBus;
  private stompClient: StompClient;
  private tokenManager: SessionTokenManager;
  private mockServer: MockGameServer;

  private mode: NetworkMode = 'mock';
  private subscriptionIds: string[] = [];
  private currentGameId: string | null = null;
  private requestCounter: number = 0;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.stompClient = StompClient.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();
    this.mockServer = MockGameServer.getInstance();

    this.setupEventListeners();
  }

  public static getInstance(): GameNetworkService {
    if (!GameNetworkService.instance) {
      GameNetworkService.instance = new GameNetworkService();
    }
    return GameNetworkService.instance;
  }

  /**
   * Set network mode
   */
  public setMode(mode: NetworkMode): void {
    this.mode = mode;
    console.log(`[GameNetworkService] Mode set to: ${mode}`);
  }

  /**
   * Get current network mode
   */
  public getMode(): NetworkMode {
    return this.mode;
  }

  /**
   * Connect to game server
   */
  public async connect(serverUrl?: string): Promise<void> {
    if (this.mode === 'mock') {
      console.log('[GameNetworkService] Using mock mode, skipping connection');
      this.eventBus.emit('stomp:connected', { version: 'mock', heartbeat: '0,0' });
      return;
    }

    if (serverUrl) {
      this.stompClient.configure({ serverUrl });
    }

    await this.stompClient.connect();
    this.setupSubscriptions();
  }

  /**
   * Disconnect from game server
   */
  public disconnect(): void {
    this.unsubscribeAll();
    if (this.mode !== 'mock') {
      this.stompClient.disconnect();
    }
    this.currentGameId = null;
  }

  /**
   * Game Launch - Initialize game session
   */
  public async gameLaunch(
    userId: string,
    gameId: string,
    device: 'desktop' | 'mobile' | 'tablet' = 'desktop',
    locale: string = 'en-GB'
  ): Promise<GameResponse<GameLaunchResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: GameLaunchRequest = {
      type: 'gameLaunch',
      meta: createRequestMeta(),
      auth: { sessionToken: this.tokenManager.getToken() },
      data: {
        userId,
        gameId,
        clientInfo: { device, locale },
      },
    };

    this.eventBus.emit('network:request', { requestId, endpoint: DESTINATIONS.GAME_LAUNCH });

    try {
      let response: GameLaunchResponse;

      if (this.mode === 'mock') {
        response = await this.mockServer.gameLaunch(request as any);
      } else {
        response = await this.stompClient.request(DESTINATIONS.GAME_LAUNCH, request, 30000);
      }

      this.currentGameId = gameId;

      // Initialize game session with response
      const session = GameSession.getInstance();
      session.initFromLaunchResponse(response.data);

      const result = this.buildResponse<GameLaunchResponse['data']>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });

      return result;
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  /**
   * Spin - Execute a spin
   */
  public async spin(
    userId: string,
    gameId: string,
    bet: BetData,
    mode: 'BASE' | 'FS' | 'HNS' = 'BASE',
    options?: { turbo?: boolean; auto?: boolean }
  ): Promise<GameResponse<SpinResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: SpinRequest = {
      type: 'spin',
      meta: createRequestMeta(),
      auth: { sessionToken: this.tokenManager.getToken() },
      data: {
        userId,
        gameId,
        mode,
        bet,
        variant: { jurisdictionCode: 'UKGC', operatorCode: 'OP-001' },
        options,
      },
    };

    this.eventBus.emit('network:request', { requestId, endpoint: DESTINATIONS.SPIN });

    try {
      let response: SpinResponse;

      if (this.mode === 'mock') {
        response = await this.mockServer.spin(request as any);
      } else {
        response = await this.stompClient.request(DESTINATIONS.SPIN, request, 30000);
      }

      // Update session with spin response
      const session = GameSession.getInstance();
      session.handleSpinResponse(response.data);

      const result = this.buildResponse<SpinResponse['data']>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });

      return result;
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  /**
   * Feature Action (Free Spins, HNS, etc.)
   */
  public async featureAction(
    gameId: string,
    seriesId: string,
    resumeToken: string,
    action: 'PLAY' | 'STOP' | 'DECLINE' | 'COLLECT' | 'SUMMARY'
  ): Promise<GameResponse<FeatureActionResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: FeatureActionRequest = {
      type: 'featureAction',
      meta: createRequestMeta(),
      auth: { sessionToken: this.tokenManager.getToken() },
      data: {
        gameId,
        seriesId,
        resumeToken,
        action: { type: action },
      },
    };

    this.eventBus.emit('network:request', { requestId, endpoint: DESTINATIONS.FEATURE_ACTION });

    try {
      let response: FeatureActionResponse;

      if (this.mode === 'mock') {
        response = await this.mockServer.featureAction(request as any);
      } else {
        response = await this.stompClient.request(DESTINATIONS.FEATURE_ACTION, request, 30000);
      }

      // Update session with feature action response
      const session = GameSession.getInstance();
      session.handleFeatureActionResponse(response.data);

      const result = this.buildResponse<FeatureActionResponse['data']>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });

      return result;
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  /**
   * Buy Bonus
   */
  public async buyBonus(
    userId: string,
    gameId: string,
    featureCode: string,
    price: number,
    currency: string = 'GBP'
  ): Promise<GameResponse<BuyBonusResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: BuyBonusRequest = {
      type: 'buyBonus',
      meta: createRequestMeta(),
      auth: { sessionToken: this.tokenManager.getToken() },
      data: {
        userId,
        gameId,
        bonus: {
          featureCode,
          price: { amount: price, currency },
        },
        coin: { amount: 1.00, currency },
      },
    };

    this.eventBus.emit('network:request', { requestId, endpoint: DESTINATIONS.BUY_BONUS });

    try {
      let response: BuyBonusResponse;

      if (this.mode === 'mock') {
        response = await this.mockServer.buyBonus(request as any);
      } else {
        response = await this.stompClient.request(DESTINATIONS.BUY_BONUS, request, 30000);
      }

      // Update session with buy bonus response
      const session = GameSession.getInstance();
      session.handleBuyBonusResponse(response.data);

      const result = this.buildResponse<BuyBonusResponse['data']>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });

      return result;
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  /**
   * Get balance and check for unfinished sessions
   */
  public async getBalance(userId: string, gameId: string): Promise<GameResponse<BalanceResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      let response: BalanceResponse;

      if (this.mode === 'mock') {
        response = await this.mockServer.getBalance(userId, gameId) as BalanceResponse;
      } else {
        response = await this.stompClient.request(DESTINATIONS.BALANCE, { userId, gameId }, 10000);
      }

      return this.buildResponse<BalanceResponse['data']>(response.data, requestId, startTime);
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  /**
   * Reconnect to unfinished session
   */
  public async reconnect(gameId: string, resumeToken: string): Promise<GameResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      let response: any;

      if (this.mode === 'mock') {
        // Mock reconnect - simulate resuming a session
        const session = GameSession.getInstance();
        if (session.hasUnfinishedSession()) {
          response = { data: { success: true, resumed: true } };
          session.reconnect();
        } else {
          response = { data: { success: false, message: 'No unfinished session' } };
        }
      } else {
        response = await this.stompClient.request(DESTINATIONS.RECONNECT, { gameId, resumeToken }, 30000);
      }

      return this.buildResponse(response.data, requestId, startTime);
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  /**
   * Check connection status
   */
  public isConnected(): boolean {
    if (this.mode === 'mock') return true;
    return this.stompClient.isConnected();
  }

  // Private methods

  private setupEventListeners(): void {
    this.eventBus.on('stomp:connected', () => {
      console.log('[GameNetworkService] STOMP connected');
    });

    this.eventBus.on('stomp:disconnected', () => {
      console.log('[GameNetworkService] STOMP disconnected');
      const session = GameSession.getInstance();
      session.disconnect();
    });

    this.eventBus.on('stomp:error', (payload) => {
      console.error('[GameNetworkService] STOMP error:', payload);
    });

    this.eventBus.on('stomp:reconnecting', () => {
      console.log('[GameNetworkService] STOMP reconnecting...');
    });
  }

  private setupSubscriptions(): void {
    // Subscribe to user-specific game updates
    const userQueueId = this.stompClient.subscribe(DESTINATIONS.USER_QUEUE, (message) => {
      this.handleServerMessage(message);
    });
    this.subscriptionIds.push(userQueueId);

    // Subscribe to jackpot updates
    const jackpotId = this.stompClient.subscribe(DESTINATIONS.JACKPOT_UPDATES, (message) => {
      this.handleJackpotUpdate(message);
    });
    this.subscriptionIds.push(jackpotId);

    // Subscribe to game-specific updates if we have a current game
    if (this.currentGameId) {
      const gameUpdateId = this.stompClient.subscribe(
        `${DESTINATIONS.GAME_UPDATES}${this.currentGameId}`,
        (message) => {
          this.handleGameUpdate(message);
        }
      );
      this.subscriptionIds.push(gameUpdateId);
    }
  }

  private unsubscribeAll(): void {
    for (const id of this.subscriptionIds) {
      this.stompClient.unsubscribe(id);
    }
    this.subscriptionIds = [];
  }

  private handleServerMessage(message: StompMessage): void {
    const payload = message.payload as any;

    switch (payload?.type) {
      case 'BALANCE_UPDATE':
        const session = GameSession.getInstance();
        session.getWallet().setBalance(payload.data.balance.amount);
        this.eventBus.emit('wallet:balance:update', {
          previousBalance: 0,
          newBalance: payload.data.balance.amount,
          change: 0,
        });
        break;
      case 'FEATURE_TRIGGER':
        this.eventBus.emit('feature:triggered', payload.data);
        break;
      case 'JACKPOT_WIN':
        this.eventBus.emit('game:win', {
          amount: payload.data.amount,
          multiplier: 1,
          winType: 'epic',
        });
        break;
      case 'SESSION_TIMEOUT':
        GameSession.getInstance().disconnect();
        this.eventBus.emit('session:disconnected', { sessionId: '' });
        break;
      default:
        console.log('[GameNetworkService] Unhandled server message:', payload);
    }
  }

  private handleJackpotUpdate(message: StompMessage): void {
    this.eventBus.emit('feature:update', {
      featureType: 'JACKPOT',
      featureData: message.payload,
    });
  }

  private handleGameUpdate(message: StompMessage): void {
    console.log('[GameNetworkService] Game update:', message.payload);
  }

  private buildResponse<T>(data: T, requestId: string, startTime: number): GameResponse<T> {
    return {
      success: true,
      data,
      requestId,
      latency: Date.now() - startTime,
    };
  }

  private handleError<T>(error: unknown, requestId: string, startTime: number): GameResponse<T> {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GameNetworkService] Request ${requestId} failed:`, errorMsg);

    this.eventBus.emit('network:error', {
      requestId,
      error: error instanceof Error ? error : new Error(errorMsg),
      retryCount: 0,
    });

    return {
      success: false,
      error: errorMsg,
      requestId,
      latency: Date.now() - startTime,
    };
  }

  private generateRequestId(): string {
    return `req-${++this.requestCounter}-${Date.now()}`;
  }

  public destroy(): void {
    this.disconnect();
    GameNetworkService.instance = null;
  }
}

export default GameNetworkService;
