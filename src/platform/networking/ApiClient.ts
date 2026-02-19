/**
 * ApiClient - HTTP client for game server communication
 */

import { EventBus } from '@/platform/events/EventBus';
import { MockGameServer, GameLaunchRequest, SpinRequest, FeatureActionRequest, BuyBonusRequest } from './MockGameServer';
import { RetryPolicy } from './RetryPolicy';
import { SessionTokenManager } from './SessionTokenManager';
import { PayloadValidator } from './PayloadValidator';

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  useMock: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
  duration: number;
}

export class ApiClient {
  private static instance: ApiClient | null = null;

  private config: ApiConfig;
  private eventBus: EventBus;
  private mockServer: MockGameServer;
  private retryPolicy: RetryPolicy;
  private tokenManager: SessionTokenManager;
  private validator: PayloadValidator;

  private constructor() {
    this.config = {
      baseUrl: '/api',
      timeout: 30000,
      useMock: true, // Use mock server by default
    };

    this.eventBus = EventBus.getInstance();
    this.mockServer = MockGameServer.getInstance();
    this.retryPolicy = new RetryPolicy();
    this.tokenManager = SessionTokenManager.getInstance();
    this.validator = new PayloadValidator();
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  public setConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Game Launch
  public async gameLaunch(userId: string, gameId: string, device: string = 'desktop', locale: string = 'en-GB'): Promise<ApiResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: GameLaunchRequest = {
      type: 'gameLaunch',
      meta: {
        apiVersion: '1.0.0',
        requestId,
        clientTime: new Date().toISOString(),
      },
      auth: { sessionToken: this.tokenManager.getToken() },
      data: {
        userId,
        gameId,
        clientInfo: { device, locale },
      },
    };

    this.eventBus.emit('network:request', { requestId, endpoint: '/gameLaunch' });

    try {
      const response = this.config.useMock
        ? await this.mockServer.gameLaunch(request)
        : await this.makeRequest('/gameLaunch', request);

      const duration = Date.now() - startTime;
      this.eventBus.emit('network:response', { requestId, data: response, duration });

      return { success: true, data: response.data, requestId, duration };
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  // Spin
  public async spin(
    userId: string,
    gameId: string,
    mode: 'BASE' | 'FS' | 'HNS',
    bet: { total: number; lines: number; coin: number; coinsPerLine: number },
    currency: string = 'GBP'
  ): Promise<ApiResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: SpinRequest = {
      type: 'spin',
      meta: {
        apiVersion: '1.0.0',
        requestId,
        clientTime: new Date().toISOString(),
      },
      auth: { sessionToken: this.tokenManager.getToken() },
      data: {
        userId,
        gameId,
        mode,
        bet: {
          total: { amount: bet.total, currency },
          lines: bet.lines,
          coin: { amount: bet.coin, currency },
          coinsPerLine: bet.coinsPerLine,
        },
        variant: { jurisdictionCode: 'UKGC', operatorCode: 'OP-001' },
        options: { turbo: false, auto: false },
      },
    };

    this.eventBus.emit('network:request', { requestId, endpoint: '/spin' });

    try {
      const response = this.config.useMock
        ? await this.mockServer.spin(request)
        : await this.makeRequest('/spin', request);

      const duration = Date.now() - startTime;
      this.eventBus.emit('network:response', { requestId, data: response, duration });

      return { success: true, data: response.data, requestId, duration };
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  // Feature Action (Free Spins / HNS)
  public async featureAction(
    gameId: string,
    seriesId: string,
    resumeToken: string,
    action: 'PLAY' | 'STOP' | 'DECLINE'
  ): Promise<ApiResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: FeatureActionRequest = {
      type: 'featureAction',
      meta: {
        apiVersion: '1.0.0',
        requestId,
        clientTime: new Date().toISOString(),
      },
      auth: { sessionToken: this.tokenManager.getToken() },
      data: {
        gameId,
        seriesId,
        resumeToken,
        action: { type: action },
      },
    };

    this.eventBus.emit('network:request', { requestId, endpoint: '/feature/action' });

    try {
      const response = this.config.useMock
        ? await this.mockServer.featureAction(request)
        : await this.makeRequest('/feature/action', request);

      const duration = Date.now() - startTime;
      this.eventBus.emit('network:response', { requestId, data: response, duration });

      return { success: true, data: response.data, requestId, duration };
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  // Buy Bonus
  public async buyBonus(
    userId: string,
    gameId: string,
    featureCode: string,
    price: number,
    currency: string = 'GBP'
  ): Promise<ApiResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request: BuyBonusRequest = {
      type: 'buyBonus',
      meta: {
        apiVersion: '1.0.0',
        requestId,
        clientTime: new Date().toISOString(),
      },
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

    this.eventBus.emit('network:request', { requestId, endpoint: '/buyBonus' });

    try {
      const response = this.config.useMock
        ? await this.mockServer.buyBonus(request)
        : await this.makeRequest('/buyBonus', request);

      const duration = Date.now() - startTime;
      this.eventBus.emit('network:response', { requestId, data: response, duration });

      return { success: true, data: response.data, requestId, duration };
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  // Generic request handler for real API calls
  private async makeRequest<T>(endpoint: string, payload: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await this.retryPolicy.execute(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokenManager.getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return res.json();
    });

    return response as T;
  }

  private handleError(error: unknown, requestId: string, startTime: number): ApiResponse<any> {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    this.eventBus.emit('network:error', {
      requestId,
      error: error instanceof Error ? error : new Error(errorMessage),
      retryCount: 0,
    });

    return {
      success: false,
      error: errorMessage,
      requestId,
      duration,
    };
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public destroy(): void {
    ApiClient.instance = null;
  }
}

export default ApiClient;
