/**
 * NetworkManager - Manages network adapters and provides unified API
 * Allows runtime switching between REST, STOMP, and Mock implementations
 * Uses environment config as primary source, with runtime overrides support
 */

import { EventBus } from '@/platform/events/EventBus';
import { getMergedEnvConfig, getNetworkConfig, NetworkEnvironmentConfig } from '@/config/env.config';
import { fetchGameNetworkConfig } from '@/config/gameNetwork.config';
import { SessionTokenManager } from './SessionTokenManager';
import { GameSession } from '@/gameplay/state/GameSession';
import { INetworkAdapter, NetworkAdapterType, NetworkResponse } from './INetworkAdapter';
import { RestAdapter, RestConfig } from './RestAdapter';
import { StompAdapter, StompAdapterConfig } from './StompAdapter';
import { MockAdapter } from './MockAdapter';
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
  BetData,
  createRequestMeta,
} from './APIProtocol';

export interface NetworkManagerConfig {
  defaultAdapter?: NetworkAdapterType;
  rest?: Partial<RestConfig>;
  stomp?: Partial<StompAdapterConfig>;
  useEnvConfig?: boolean; // Use environment config as primary source
}

export class NetworkManager {
  private static instance: NetworkManager | null = null;

  private managerConfig: NetworkManagerConfig;
  private envConfig: NetworkEnvironmentConfig;
  private eventBus: EventBus;
  private tokenManager: SessionTokenManager;
  private currentAdapter: INetworkAdapter | null = null;
  private adapters: Map<NetworkAdapterType, INetworkAdapter> = new Map();

  private constructor() {
    this.managerConfig = {};
    this.envConfig = getNetworkConfig();
    this.eventBus = EventBus.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * Initialize the network manager with configuration.
   * Priority: passed config > per-game config (if provided) > environment config > defaults
   */
  public async initialize(config?: Partial<NetworkManagerConfig>): Promise<void> {
    await this.initializeForGame(undefined, config);
  }

  /**
   * Initialize network for a specific game.
   * Loads /game-configs/games/<gameId>/network.json when available.
   */
  public async initializeForGame(gameId?: string, config?: Partial<NetworkManagerConfig>): Promise<void> {
    this.managerConfig = { useEnvConfig: true, ...config };

    // Refresh env config in case of runtime overrides
    const mergedEnv = getMergedEnvConfig();
    this.envConfig = mergedEnv.network;

    // Load per-game network config (optional)
    const gameNet = gameId ? await fetchGameNetworkConfig(gameId) : null;

    // Determine adapter type: passed config > game config > env config
    const adapterType =
      config?.defaultAdapter ??
      gameNet?.adapterType ??
      this.envConfig.adapterType;

    // If config changes between games, we must rebuild adapters with the new settings.
    this.resetAdapters();

    // REST config: passed config > game config > env config
    if (!config?.rest) {
      this.managerConfig.rest = {
        baseUrl: gameNet?.rest?.baseUrl ?? this.envConfig.rest.baseUrl,
        timeout: gameNet?.rest?.timeout ?? this.envConfig.rest.timeout,
      };
    }

    // STOMP config: passed config > game config > env config
    if (!config?.stomp) {
      this.managerConfig.stomp = {
        serverUrl: gameNet?.stomp?.url ?? this.envConfig.stomp.url,
        reconnectDelay: gameNet?.stomp?.reconnectDelay ?? this.envConfig.stomp.reconnectDelay,
        heartbeatInterval: gameNet?.stomp?.heartbeatIncoming ?? this.envConfig.stomp.heartbeatIncoming,
        timeout: 30000,
      };
    }

    // Create adapters lazily
    await this.setAdapter(adapterType);

    console.log(`[NetworkManager] Initialized with ${adapterType} adapter`);
    console.log(`[NetworkManager] REST URL: ${this.managerConfig.rest?.baseUrl}`);
    console.log(`[NetworkManager] Game: ${gameId ?? 'n/a'} | Environment: ${mergedEnv.name}`);
  }

  private resetAdapters(): void {
    for (const adapter of this.adapters.values()) {
      try {
        adapter.destroy();
      } catch {
        // ignore
      }
    }
    this.adapters.clear();
    this.currentAdapter = null;
  }

  /**
   * Set the active network adapter
   */
  public async setAdapter(type: NetworkAdapterType): Promise<void> {
    // Disconnect current adapter if different
    if (this.currentAdapter && this.currentAdapter.getType() !== type) {
      this.currentAdapter.disconnect();
    }

    // Get or create adapter
    let adapter = this.adapters.get(type);
    
    if (!adapter) {
      adapter = this.createAdapter(type);
      await adapter.initialize();
      this.adapters.set(type, adapter);
    }

    this.currentAdapter = adapter;
    console.log(`[NetworkManager] Switched to ${type} adapter`);
  }

  /**
   * Create a new adapter instance
   */
  private createAdapter(type: NetworkAdapterType): INetworkAdapter {
    // Use manager config which was built from env config
    const restConfig = this.managerConfig.rest || { baseUrl: '/api', timeout: 30000 };
    const stompConfig = this.managerConfig.stomp || { serverUrl: 'ws://localhost:8080/ws' };
    
    switch (type) {
      case 'rest':
        return new RestAdapter(restConfig);
      case 'stomp':
        return new StompAdapter(stompConfig);
      case 'mock':
      default:
        return new MockAdapter();
    }
  }

  /**
   * Get current adapter type
   */
  public getAdapterType(): NetworkAdapterType {
    return this.currentAdapter?.getType() ?? 'mock';
  }

  /**
   * Connect to the server
   */
  public async connect(serverUrl?: string): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error('No network adapter initialized');
    }
    await this.currentAdapter.connect(serverUrl);
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    this.currentAdapter?.disconnect();
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.currentAdapter?.isConnected() ?? false;
  }

  // High-level game operations

  /**
   * Launch a game
   */
  public async gameLaunch(
    userId: string,
    gameId: string,
    device: 'desktop' | 'mobile' | 'tablet' = 'desktop',
    locale: string = 'en-GB'
  ): Promise<NetworkResponse<GameLaunchResponse['data']>> {
    if (!this.currentAdapter) {
      throw new Error('No network adapter initialized');
    }

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

    const response = await this.currentAdapter.gameLaunch(request);

    // Initialize session with response
    if (response.success && response.data) {
      const session = GameSession.getInstance();
      session.initFromLaunchResponse(response.data);
    }

    return response;
  }

  /**
   * Execute a spin
   */
  public async spin(
    userId: string,
    gameId: string,
    bet: BetData,
    mode: 'BASE' | 'FS' | 'HNS' = 'BASE',
    options?: { turbo?: boolean; auto?: boolean }
  ): Promise<NetworkResponse<SpinResponse['data']>> {
    if (!this.currentAdapter) {
      throw new Error('No network adapter initialized');
    }

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

    const response = await this.currentAdapter.spin(request);

    // Update session with spin response
    if (response.success && response.data) {
      const session = GameSession.getInstance();
      session.handleSpinResponse(response.data);
    }

    return response;
  }

  /**
   * Feature action (Free Spins, HNS, etc.)
   */
  public async featureAction(
    gameId: string,
    seriesId: string,
    resumeToken: string,
    action: 'PLAY' | 'STOP' | 'DECLINE' | 'COLLECT' | 'SUMMARY'
  ): Promise<NetworkResponse<FeatureActionResponse['data']>> {
    if (!this.currentAdapter) {
      throw new Error('No network adapter initialized');
    }

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

    const response = await this.currentAdapter.featureAction(request);

    // Update session with feature action response
    if (response.success && response.data) {
      const session = GameSession.getInstance();
      session.handleFeatureActionResponse(response.data);
    }

    return response;
  }

  /**
   * Buy bonus
   */
  public async buyBonus(
    userId: string,
    gameId: string,
    featureCode: string,
    price: number,
    currency: string = 'GBP'
  ): Promise<NetworkResponse<BuyBonusResponse['data']>> {
    if (!this.currentAdapter) {
      throw new Error('No network adapter initialized');
    }

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

    const response = await this.currentAdapter.buyBonus(request);

    // Update session with buy bonus response
    if (response.success && response.data) {
      const session = GameSession.getInstance();
      session.handleBuyBonusResponse(response.data);
    }

    return response;
  }

  /**
   * Get balance
   */
  public async getBalance(userId: string, gameId: string): Promise<NetworkResponse<BalanceResponse['data']>> {
    if (!this.currentAdapter) {
      throw new Error('No network adapter initialized');
    }

    return this.currentAdapter.getBalance(userId, gameId);
  }

  /**
   * Reconnect to unfinished session
   */
  public async reconnect(gameId: string, resumeToken: string): Promise<NetworkResponse<any>> {
    if (!this.currentAdapter) {
      throw new Error('No network adapter initialized');
    }

    const response = await this.currentAdapter.reconnect(gameId, resumeToken);

    // Handle session reconnection
    if (response.success) {
      const session = GameSession.getInstance();
      session.reconnect();
    }

    return response;
  }

  /**
   * Subscribe to server push events (STOMP only)
   */
  public subscribe(destination: string, callback: (message: any) => void): string | null {
    if (this.currentAdapter?.subscribe) {
      return this.currentAdapter.subscribe(destination, callback);
    }
    console.warn('[NetworkManager] Current adapter does not support subscriptions');
    return null;
  }

  /**
   * Unsubscribe from server push events (STOMP only)
   */
  public unsubscribe(subscriptionId: string): void {
    if (this.currentAdapter?.unsubscribe) {
      this.currentAdapter.unsubscribe(subscriptionId);
    }
  }

  /**
   * Destroy the network manager
   */
  public destroy(): void {
    for (const adapter of this.adapters.values()) {
      adapter.destroy();
    }
    this.adapters.clear();
    this.currentAdapter = null;
    NetworkManager.instance = null;
  }
}

export default NetworkManager;
