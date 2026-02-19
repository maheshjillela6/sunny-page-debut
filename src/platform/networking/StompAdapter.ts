/**
 * StompAdapter - STOMP WebSocket implementation of INetworkAdapter
 */

import { EventBus } from '@/platform/events/EventBus';
import { SessionTokenManager } from './SessionTokenManager';
import { StompClient, StompMessage } from './StompClient';
import { INetworkAdapter, NetworkResponse } from './INetworkAdapter';
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
} from './APIProtocol';

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

export interface StompAdapterConfig {
  serverUrl: string;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  timeout?: number;
}

const DEFAULT_CONFIG: StompAdapterConfig = {
  serverUrl: 'wss://game-server.example.com/ws',
  reconnectDelay: 3000,
  heartbeatInterval: 10000,
  timeout: 30000,
};

export class StompAdapter implements INetworkAdapter {
  private config: StompAdapterConfig;
  private eventBus: EventBus;
  private tokenManager: SessionTokenManager;
  private stompClient: StompClient;
  private subscriptionIds: string[] = [];
  private requestCounter: number = 0;
  private currentGameId: string | null = null;

  constructor(config: Partial<StompAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = EventBus.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();
    this.stompClient = StompClient.getInstance();
  }

  public async initialize(): Promise<void> {
    this.stompClient.configure({
      serverUrl: this.config.serverUrl,
      reconnectDelay: this.config.reconnectDelay!,
      heartbeatIncoming: this.config.heartbeatInterval!,
      heartbeatOutgoing: this.config.heartbeatInterval!,
    });
    
    this.setupEventListeners();
    console.log('[StompAdapter] Initialized');
  }

  public async connect(serverUrl?: string): Promise<void> {
    if (serverUrl) {
      this.stompClient.configure({ serverUrl });
    }

    await this.stompClient.connect();
    this.setupSubscriptions();
    
    this.eventBus.emit('network:connected', { type: 'stomp' });
    console.log('[StompAdapter] Connected via STOMP');
  }

  public disconnect(): void {
    this.unsubscribeAll();
    this.stompClient.disconnect();
    this.currentGameId = null;
    
    this.eventBus.emit('network:disconnected', { type: 'stomp' });
  }

  public isConnected(): boolean {
    return this.stompClient.isConnected();
  }

  public getType(): 'rest' | 'stomp' | 'mock' {
    return 'stomp';
  }

  public async gameLaunch(request: GameLaunchRequest): Promise<NetworkResponse<GameLaunchResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.eventBus.emit('network:request', { requestId, endpoint: DESTINATIONS.GAME_LAUNCH, type: 'stomp' });

    try {
      const response = await this.stompClient.request<GameLaunchRequest, GameLaunchResponse>(
        DESTINATIONS.GAME_LAUNCH,
        request,
        this.config.timeout
      );

      this.currentGameId = request.data.gameId;
      
      const result = this.buildSuccessResponse<GameLaunchResponse['data']>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });
      
      return result;
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async spin(request: SpinRequest): Promise<NetworkResponse<SpinResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.eventBus.emit('network:request', { requestId, endpoint: DESTINATIONS.SPIN, type: 'stomp' });

    try {
      const response = await this.stompClient.request<SpinRequest, SpinResponse>(
        DESTINATIONS.SPIN,
        request,
        this.config.timeout
      );

      const result = this.buildSuccessResponse<SpinResponse['data']>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });
      
      return result;
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async featureAction(request: FeatureActionRequest): Promise<NetworkResponse<FeatureActionResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.eventBus.emit('network:request', { requestId, endpoint: DESTINATIONS.FEATURE_ACTION, type: 'stomp' });

    try {
      const response = await this.stompClient.request<FeatureActionRequest, FeatureActionResponse>(
        DESTINATIONS.FEATURE_ACTION,
        request,
        this.config.timeout
      );

      const result = this.buildSuccessResponse<FeatureActionResponse['data']>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });
      
      return result;
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async buyBonus(request: BuyBonusRequest): Promise<NetworkResponse<BuyBonusResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.eventBus.emit('network:request', { requestId, endpoint: DESTINATIONS.BUY_BONUS, type: 'stomp' });

    try {
      const response = await this.stompClient.request<BuyBonusRequest, BuyBonusResponse>(
        DESTINATIONS.BUY_BONUS,
        request,
        this.config.timeout
      );

      const result = this.buildSuccessResponse<BuyBonusResponse['data']>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });
      
      return result;
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async getBalance(userId: string, gameId: string): Promise<NetworkResponse<BalanceResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      const response = await this.stompClient.request<{ userId: string; gameId: string }, BalanceResponse>(
        DESTINATIONS.BALANCE,
        { userId, gameId },
        10000
      );

      return this.buildSuccessResponse<BalanceResponse['data']>(response.data, requestId, startTime);
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async reconnect(gameId: string, resumeToken: string): Promise<NetworkResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      const response = await this.stompClient.request<{ gameId: string; resumeToken: string }, any>(
        DESTINATIONS.RECONNECT,
        { gameId, resumeToken },
        30000
      );

      return this.buildSuccessResponse(response.data, requestId, startTime);
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public subscribe(destination: string, callback: (message: any) => void): string {
    return this.stompClient.subscribe(destination, (msg: StompMessage) => {
      callback(msg.payload);
    });
  }

  public unsubscribe(subscriptionId: string): void {
    this.stompClient.unsubscribe(subscriptionId);
    this.subscriptionIds = this.subscriptionIds.filter(id => id !== subscriptionId);
  }

  private setupEventListeners(): void {
    this.eventBus.on('stomp:connected', () => {
      console.log('[StompAdapter] STOMP connected');
    });

    this.eventBus.on('stomp:disconnected', () => {
      console.log('[StompAdapter] STOMP disconnected');
    });

    this.eventBus.on('stomp:error', (payload) => {
      console.error('[StompAdapter] STOMP error:', payload);
    });

    this.eventBus.on('stomp:reconnecting', () => {
      console.log('[StompAdapter] STOMP reconnecting...');
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
      this.eventBus.emit('feature:update', {
        featureType: 'JACKPOT',
        featureData: message.payload,
      });
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
        this.eventBus.emit('session:disconnected', { sessionId: '' });
        break;
      default:
        console.log('[StompAdapter] Unhandled server message:', payload);
    }
  }

  private handleGameUpdate(message: StompMessage): void {
    console.log('[StompAdapter] Game update:', message.payload);
    this.eventBus.emit('game:update', message.payload);
  }

  private generateRequestId(): string {
    return `stomp-${++this.requestCounter}-${Date.now()}`;
  }

  private buildSuccessResponse<T>(data: T, requestId: string, startTime: number): NetworkResponse<T> {
    return {
      success: true,
      data,
      requestId,
      latency: Date.now() - startTime,
    };
  }

  private buildErrorResponse<T>(error: unknown, requestId: string, startTime: number): NetworkResponse<T> {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[StompAdapter] Request ${requestId} failed:`, errorMsg);
    
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

  public destroy(): void {
    this.disconnect();
    console.log('[StompAdapter] Destroyed');
  }
}

export default StompAdapter;
