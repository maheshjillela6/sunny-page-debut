/**
 * MockAdapter - Mock implementation of INetworkAdapter for development
 */

import { EventBus } from '@/platform/events/EventBus';
import { SessionTokenManager } from './SessionTokenManager';
import { MockGameServer } from './MockGameServer';
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

export class MockAdapter implements INetworkAdapter {
  private eventBus: EventBus;
  private tokenManager: SessionTokenManager;
  private mockServer: MockGameServer;
  private connected: boolean = false;
  private requestCounter: number = 0;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();
    this.mockServer = MockGameServer.getInstance();
  }

  public async initialize(): Promise<void> {
    console.log('[MockAdapter] Initialized');
  }

  public async connect(_serverUrl?: string): Promise<void> {
    this.connected = true;
    this.eventBus.emit('network:connected', { type: 'mock' });
    this.eventBus.emit('stomp:connected', { version: 'mock', heartbeat: '0,0' });
    console.log('[MockAdapter] Connected (mock mode)');
  }

  public disconnect(): void {
    this.connected = false;
    this.eventBus.emit('network:disconnected', { type: 'mock' });
    this.eventBus.emit('stomp:disconnected', {});
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getType(): 'rest' | 'stomp' | 'mock' {
    return 'mock';
  }

  public async gameLaunch(request: GameLaunchRequest): Promise<NetworkResponse<GameLaunchResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.eventBus.emit('network:request', { requestId, endpoint: '/game/launch', type: 'mock' });

    try {
      // Simulate network latency
      await this.simulateLatency();

      const response = await this.mockServer.gameLaunch(request as any);
      
      const result = this.buildSuccessResponse<GameLaunchResponse['data']>(
        response.data as GameLaunchResponse['data'],
        requestId,
        startTime
      );
      
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });
      return result;
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async spin(request: SpinRequest): Promise<NetworkResponse<SpinResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.eventBus.emit('network:request', { requestId, endpoint: '/game/spin', type: 'mock' });

    try {
      await this.simulateLatency();

      const response = await this.mockServer.spin(request as any);
      
      const result = this.buildSuccessResponse<SpinResponse['data']>(
        response.data as SpinResponse['data'],
        requestId,
        startTime
      );
      
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });
      return result;
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async featureAction(request: FeatureActionRequest): Promise<NetworkResponse<FeatureActionResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.eventBus.emit('network:request', { requestId, endpoint: '/feature/action', type: 'mock' });

    try {
      await this.simulateLatency();

      const response = await this.mockServer.featureAction(request as any);
      
      const result = this.buildSuccessResponse<FeatureActionResponse['data']>(
        response.data as FeatureActionResponse['data'],
        requestId,
        startTime
      );
      
      this.eventBus.emit('network:response', { requestId, data: result.data, duration: result.latency });
      return result;
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async buyBonus(request: BuyBonusRequest): Promise<NetworkResponse<BuyBonusResponse['data']>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.eventBus.emit('network:request', { requestId, endpoint: '/game/buyBonus', type: 'mock' });

    try {
      await this.simulateLatency();

      const response = await this.mockServer.buyBonus(request as any);
      
      const result = this.buildSuccessResponse<BuyBonusResponse['data']>(
        response.data as BuyBonusResponse['data'],
        requestId,
        startTime
      );
      
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
      await this.simulateLatency(50);

      const response = await this.mockServer.getBalance(userId, gameId) as BalanceResponse;
      return this.buildSuccessResponse<BalanceResponse['data']>(response.data, requestId, startTime);
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  public async reconnect(gameId: string, resumeToken: string): Promise<NetworkResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      await this.simulateLatency();

      // Mock reconnect response
      return this.buildSuccessResponse(
        { success: true, resumed: true, gameId, resumeToken },
        requestId,
        startTime
      );
    } catch (error) {
      return this.buildErrorResponse(error, requestId, startTime);
    }
  }

  private async simulateLatency(ms: number = 100): Promise<void> {
    const latency = ms + Math.random() * 100;
    await new Promise(resolve => setTimeout(resolve, latency));
  }

  private generateRequestId(): string {
    return `mock-${++this.requestCounter}-${Date.now()}`;
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
    console.error(`[MockAdapter] Request ${requestId} failed:`, errorMsg);
    
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
    console.log('[MockAdapter] Destroyed');
  }
}

export default MockAdapter;
