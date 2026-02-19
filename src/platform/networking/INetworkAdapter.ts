/**
 * INetworkAdapter - Interface for network communication adapters
 * Allows switching between REST and STOMP implementations
 */

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

export interface NetworkResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
  latency: number;
}

export interface INetworkAdapter {
  /**
   * Initialize the adapter
   */
  initialize(): Promise<void>;

  /**
   * Connect to the server
   */
  connect(serverUrl?: string): Promise<void>;

  /**
   * Disconnect from the server
   */
  disconnect(): void;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Game launch request
   */
  gameLaunch(request: GameLaunchRequest): Promise<NetworkResponse<GameLaunchResponse['data']>>;

  /**
   * Spin request
   */
  spin(request: SpinRequest): Promise<NetworkResponse<SpinResponse['data']>>;

  /**
   * Feature action request (Free Spins, HNS, etc.)
   */
  featureAction(request: FeatureActionRequest): Promise<NetworkResponse<FeatureActionResponse['data']>>;

  /**
   * Buy bonus request
   */
  buyBonus(request: BuyBonusRequest): Promise<NetworkResponse<BuyBonusResponse['data']>>;

  /**
   * Get balance request
   */
  getBalance(userId: string, gameId: string): Promise<NetworkResponse<BalanceResponse['data']>>;

  /**
   * Reconnect to unfinished session
   */
  reconnect(gameId: string, resumeToken: string): Promise<NetworkResponse<any>>;

  /**
   * Subscribe to server push events (for STOMP)
   */
  subscribe?(destination: string, callback: (message: any) => void): string;

  /**
   * Unsubscribe from server push events (for STOMP)
   */
  unsubscribe?(subscriptionId: string): void;

  /**
   * Get adapter type
   */
  getType(): 'rest' | 'stomp' | 'mock';

  /**
   * Destroy the adapter
   */
  destroy(): void;
}

export type NetworkAdapterType = 'rest' | 'stomp' | 'mock';
