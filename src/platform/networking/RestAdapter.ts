/**
 * RestAdapter - REST HTTP implementation of INetworkAdapter
 */

import { EventBus } from '@/platform/events/EventBus';
import { SessionTokenManager } from './SessionTokenManager';
import { RetryPolicy } from './RetryPolicy';
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

export interface RestConfig {
  baseUrl: string;
  timeout: number;
  headers?: Record<string, string>;
}

const DEFAULT_CONFIG: RestConfig = {
  baseUrl: '/api',
  timeout: 30000,
};

// REST endpoints
const ENDPOINTS = {
  GAME_LAUNCH: '/game/launch',
  SPIN: '/game/spin',
  FEATURE_ACTION: '/feature/action',
  BUY_BONUS: '/game/buyBonus',
  BALANCE: '/game/balance',
  RECONNECT: '/game/reconnect',
} as const;

export class RestAdapter implements INetworkAdapter {
  private config: RestConfig;
  private eventBus: EventBus;
  private tokenManager: SessionTokenManager;
  private retryPolicy: RetryPolicy;
  private connected: boolean = false;
  private requestCounter: number = 0;

  constructor(config: Partial<RestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = EventBus.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();
    this.retryPolicy = new RetryPolicy();
  }

  public async initialize(): Promise<void> {
    console.log('[RestAdapter] Initialized with baseUrl:', this.config.baseUrl);
  }

  public async connect(_serverUrl?: string): Promise<void> {
    // REST doesn't maintain persistent connections
    this.connected = true;
    this.eventBus.emit('network:connected', { type: 'rest' });
    console.log('[RestAdapter] Ready for REST requests');
  }

  public disconnect(): void {
    this.connected = false;
    this.eventBus.emit('network:disconnected', { type: 'rest' });
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getType(): 'rest' | 'stomp' | 'mock' {
    return 'rest';
  }

  public async gameLaunch(request: GameLaunchRequest): Promise<NetworkResponse<GameLaunchResponse['data']>> {
    return this.makeRequest<GameLaunchRequest, GameLaunchResponse['data']>(
      ENDPOINTS.GAME_LAUNCH,
      request
    );
  }

  public async spin(request: SpinRequest): Promise<NetworkResponse<SpinResponse['data']>> {
    return this.makeRequest<SpinRequest, SpinResponse['data']>(
      ENDPOINTS.SPIN,
      request
    );
  }

  public async featureAction(request: FeatureActionRequest): Promise<NetworkResponse<FeatureActionResponse['data']>> {
    return this.makeRequest<FeatureActionRequest, FeatureActionResponse['data']>(
      ENDPOINTS.FEATURE_ACTION,
      request
    );
  }

  public async buyBonus(request: BuyBonusRequest): Promise<NetworkResponse<BuyBonusResponse['data']>> {
    return this.makeRequest<BuyBonusRequest, BuyBonusResponse['data']>(
      ENDPOINTS.BUY_BONUS,
      request
    );
  }

  public async getBalance(userId: string, gameId: string): Promise<NetworkResponse<BalanceResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}${ENDPOINTS.BALANCE}?userId=${userId}&gameId=${gameId}`;
      
      const response = await this.retryPolicy.execute(async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json();
      });

      return this.buildSuccessResponse(response.data, requestId, startTime);
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async reconnect(gameId: string, resumeToken: string): Promise<NetworkResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      const response = await this.retryPolicy.execute(async () => {
        const res = await fetch(`${this.config.baseUrl}${ENDPOINTS.RECONNECT}`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ gameId, resumeToken }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json();
      });

      return this.buildSuccessResponse(response.data, requestId, startTime);
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  private async makeRequest<TReq, TRes>(
    endpoint: string,
    request: TReq
  ): Promise<NetworkResponse<TRes>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const url = `${this.config.baseUrl}${endpoint}`;

    this.eventBus.emit('network:request', { requestId, endpoint, type: 'rest' });

    try {
      const response = await this.retryPolicy.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(request),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorBody || res.statusText}`);
          }

          return res.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      });

      const result = this.buildSuccessResponse<TRes>(response.data, requestId, startTime);
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });
      
      return result;
    } catch (error) {
      const result = this.buildErrorResponse<TRes>(error, requestId, startTime);
      this.eventBus.emit('network:error', { 
        requestId, 
        error: error instanceof Error ? error : new Error(String(error)),
        retryCount: 0 
      });
      
      return result;
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.tokenManager.getToken()}`,
      ...this.config.headers,
    };
  }

  private generateRequestId(): string {
    return `rest-${++this.requestCounter}-${Date.now()}`;
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
    console.error(`[RestAdapter] Request ${requestId} failed:`, errorMsg);
    
    return {
      success: false,
      error: errorMsg,
      requestId,
      latency: Date.now() - startTime,
    };
  }

  public destroy(): void {
    this.disconnect();
    console.log('[RestAdapter] Destroyed');
  }
}

export default RestAdapter;
