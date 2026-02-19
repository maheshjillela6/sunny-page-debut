/**
 * GameLoader - Orchestrates game initialization sequence
 * Handles: Session check → Game launch → Config load → Asset preload → Stage creation → Ready
 * Supports configurable asset fallback behavior per game
 */

import { EventBus } from '@/platform/events/EventBus';
import { NetworkManager } from '@/platform/networking/NetworkManager';
import { GameSession } from '@/gameplay/state/GameSession';
import { SessionTokenManager } from '@/platform/networking/SessionTokenManager';
import { GameConfigLoader, LoadedGameConfig } from '@/content/GameConfigLoader';
import { AssetPreloader, PreloadConfig } from '@/runtime/pixi/assets/AssetPreloader';
import { checkForUpdate } from '@/config/version.config';
import { SymbolRendererFactory } from '@/presentation/grid/symbols/renderers/SymbolRendererFactory';

export enum LoadingPhase {
  IDLE = 'idle',
  CHECKING_SESSION = 'checking_session',
  LAUNCHING_GAME = 'launching_game',
  LOADING_CONFIG = 'loading_config',
  LOADING_ASSETS = 'loading_assets',
  CREATING_STAGE = 'creating_stage',
  READY = 'ready',
  ERROR = 'error',
}

export interface LoadingProgress {
  phase: LoadingPhase;
  phaseProgress: number;
  totalProgress: number;
  message: string;
}

export interface GameLoadResult {
  success: boolean;
  config: LoadedGameConfig | null;
  hasUnfinishedSession: boolean;
  error?: string;
  usedDefaultAssets?: boolean;
}

export interface LoadingConfig {
  requiredBundles?: string[];
  deferredBundles?: string[];
  assetLoadBehavior?: 'useDefaults' | 'showError' | 'retry';
  showErrorOnFailure?: boolean;
  maxRetries?: number;
}

export class GameLoader {
  private static instance: GameLoader | null = null;

  private eventBus: EventBus;
  private networkManager: NetworkManager;
  private configLoader: GameConfigLoader;
  private assetPreloader: AssetPreloader;
  private session: GameSession;
  private tokenManager: SessionTokenManager;

  private phase: LoadingPhase = LoadingPhase.IDLE;
  private currentGameId: string | null = null;
  private usedDefaultAssets: boolean = false;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.networkManager = NetworkManager.getInstance();
    this.configLoader = GameConfigLoader.getInstance();
    this.assetPreloader = AssetPreloader.getInstance();
    this.session = GameSession.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();
  }

  public static getInstance(): GameLoader {
    if (!GameLoader.instance) {
      GameLoader.instance = new GameLoader();
    }
    return GameLoader.instance;
  }

  /**
   * Load a game with full initialization sequence
   */
  public async loadGame(
    gameId: string,
    userId: string = 'player1',
    options: { device?: 'desktop' | 'mobile' | 'tablet'; locale?: string } = {}
  ): Promise<GameLoadResult> {
    const { device = 'desktop', locale = 'en-GB' } = options;

    this.currentGameId = gameId;
    this.usedDefaultAssets = false;
    let hasUnfinishedSession = false;

    try {
      // Phase 0: Check for version update (cache-busting)
      await checkForUpdate();

      // Phase 1: Check for existing session
      this.setPhase(LoadingPhase.CHECKING_SESSION, 'Checking session...');

      const canRestore = this.session.canRestoreSession(gameId);
      if (canRestore) {
        hasUnfinishedSession = this.session.hasUnfinishedSession();
        console.log('[GameLoader] Found existing session, hasUnfinished:', hasUnfinishedSession);
        
        // Update session with current game
        this.tokenManager.setSessionId(`sess-${Date.now()}`);
        this.tokenManager.setUserId(userId);
        
        this.emitProgress(LoadingPhase.CHECKING_SESSION, 100, 'Session found');
        
        // Initialize session from storage but still need to verify with server
        console.log('[GameLoader] Restoring session from storage');
      }

      // Phase 2: Launch game via network (always required for server validation)
      this.setPhase(LoadingPhase.LAUNCHING_GAME, 'Connecting to server...');

      // Ensure network manager is initialized and connected
      if (!this.networkManager.isConnected()) {
        try {
          await this.networkManager.connect();
        } catch (connectError) {
          console.warn('[GameLoader] Network connect warning:', connectError);
          // Continue - some adapters don't require explicit connect
        }
      }

      this.emitProgress(LoadingPhase.LAUNCHING_GAME, 30, 'Launching game...');

      console.log('[GameLoader] Sending gameLaunch request to server...');
      const launchResponse = await this.networkManager.gameLaunch(
        userId,
        gameId,
        device,
        locale
      );

      console.log('[GameLoader] gameLaunch response:', {
        success: launchResponse.success,
        error: launchResponse.error,
        hasData: !!launchResponse.data,
      });

      if (!launchResponse.success || !launchResponse.data) {
        const errorMsg = launchResponse.error || 'Game launch failed - no server response';
        console.error('[GameLoader] Game launch failed:', errorMsg);
        throw new Error(errorMsg);
      }

      hasUnfinishedSession = launchResponse.data.unfinished?.exists ?? false;
      
      // Store session data from launch response
      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      this.tokenManager.setSessionId(sessionId);
      this.tokenManager.setUserId(userId);

      // Initialize session with full launch data
      this.session.initFromLaunchResponse({ ...launchResponse.data, gameId });
      
      // Persist session for page refresh
      this.tokenManager.storeSession({
        sessionId,
        token: this.tokenManager.getToken(),
        userId,
        gameId,
        timestamp: Date.now(),
        balance: launchResponse.data.balance.amount,
        currency: launchResponse.data.currency,
        unfinished: hasUnfinishedSession ? {
          exists: true,
          seriesId: launchResponse.data.unfinished?.series?.[0]?.seriesId,
          mode: launchResponse.data.unfinished?.series?.[0]?.mode,
          resumeToken: launchResponse.data.unfinished?.series?.[0]?.resumeToken,
        } : { exists: false },
      });
      
      this.emitProgress(LoadingPhase.LAUNCHING_GAME, 100, 'Game launched');
      console.log('[GameLoader] Game launched successfully:', launchResponse.data.gamename || gameId);

      // Phase 3: Load game configuration
      this.setPhase(LoadingPhase.LOADING_CONFIG, 'Loading game configuration...');

      await this.configLoader.initialize();
      this.emitProgress(LoadingPhase.LOADING_CONFIG, 50, 'Loading config files...');

      const config = await this.configLoader.loadGame(gameId);
      this.emitProgress(LoadingPhase.LOADING_CONFIG, 80, 'Loading symbol rendering config...');

      // Load per-game symbol rendering config (with shared defaults fallback)
      await SymbolRendererFactory.getInstance().loadForGame(gameId);

      this.emitProgress(LoadingPhase.LOADING_CONFIG, 100, 'Configuration loaded');
      console.log('[GameLoader] Config loaded:', config.manifest.name);

      // Get loading configuration from merged config
      const loadingConfig = this.getLoadingConfig(config);

      // Phase 4: Load required base game assets with fallback handling
      this.setPhase(LoadingPhase.LOADING_ASSETS, 'Loading game assets...');

      const baseAssets = this.getRequiredBaseAssets(config, loadingConfig);
      
      if (baseAssets.total > 0) {
        await this.loadAssetsWithFallback(baseAssets.config, loadingConfig);
      } else {
        console.log('[GameLoader] No base assets configured, using defaults');
        this.usedDefaultAssets = true;
      }

      this.emitProgress(LoadingPhase.LOADING_ASSETS, 100, 'Assets ready');

      // Phase 5: Creating stage (handled by EngineKernel, just emit)
      this.setPhase(LoadingPhase.CREATING_STAGE, 'Creating game stage...');
      this.emitProgress(LoadingPhase.CREATING_STAGE, 100, 'Stage ready');

      // Phase 6: Ready
      this.setPhase(LoadingPhase.READY, 'Game ready!');

      this.eventBus.emit('game:loaded', {
        gameId,
        config: config.manifest,
        hasUnfinishedSession,
      });

      return {
        success: true,
        config,
        hasUnfinishedSession,
        usedDefaultAssets: this.usedDefaultAssets,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[GameLoader] Load failed:', errorMsg);

      this.setPhase(LoadingPhase.ERROR, errorMsg);
      this.eventBus.emit('game:load:error', { gameId, error: errorMsg });

      return {
        success: false,
        config: null,
        hasUnfinishedSession: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Get loading configuration from merged config
   */
  private getLoadingConfig(config: LoadedGameConfig): LoadingConfig {
    // Check merged config for loading settings
    const manifest = config.merged.manifest as any;
    const loading = manifest?.loading || {};
    
    return {
      requiredBundles: loading.requiredBundles || ['core', 'symbols', 'spine', 'background'],
      deferredBundles: loading.deferredBundles || ['audio'],
      assetLoadBehavior: loading.assetLoadBehavior || 'useDefaults',
      showErrorOnFailure: loading.showErrorOnFailure ?? false,
      maxRetries: loading.maxRetries || 2,
    };
  }

  /**
   * Get required base game assets from config
   */
  private getRequiredBaseAssets(config: LoadedGameConfig, loadingConfig: LoadingConfig): { config: PreloadConfig; total: number } {
    const assets = config.merged.assets;
    const preloadConfig: PreloadConfig = {
      textures: [],
      images: [],
      atlases: [],
      spritesheets: [],
      spine: [],
      audio: [],
      fonts: [],
      json: [],
    };

    let total = 0;

    // Get required bundles from loading config
    const requiredBundles = loadingConfig.requiredBundles || ['core', 'symbols', 'spine', 'background'];
    
    // Get all bundles and sort by priority
    const allBundles = Object.entries(assets.bundles || {})
      .map(([name, bundle]: [string, any]) => ({ name, ...bundle }))
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    
    console.log(`[GameLoader] Processing ${allBundles.length} asset bundles by priority`);

    for (const bundle of allBundles) {
      const bundleName = bundle.name;
      if (!bundle?.assets) continue;

      // Load all bundles for now (preload important ones, defer others based on priority)
      // Always load bundles that are required=true or in requiredBundles list
      const isRequired = bundle.required !== false || requiredBundles.includes(bundleName);
      if (!isRequired && !loadingConfig.deferredBundles?.includes(bundleName)) continue;
      
      console.log(`[GameLoader] Loading bundle: ${bundleName} (priority: ${bundle.priority}, required: ${isRequired}, assets: ${bundle.assets?.length || 0})`);

      for (const asset of bundle.assets) {
        const fullPath = `${assets.basePath}/${asset.path ?? asset.url ?? ''}`;

        switch (asset.type) {
          case 'image':
          case 'texture':
            preloadConfig.images!.push({ key: asset.key, url: fullPath });
            total++;
            break;
          case 'atlas':
            preloadConfig.atlases!.push({ key: asset.key, url: fullPath });
            total++;
            break;
          case 'spritesheet':
            preloadConfig.spritesheets!.push({
              key: asset.key,
              imageUrl: `${assets.basePath}/${asset.imagePath}`,
              dataUrl: `${assets.basePath}/${asset.path}`,
            });
            total++;
            break;
          case 'spine':
            const spinePath = asset.path.replace('.json', '');
            preloadConfig.spine!.push({
              key: asset.key,
              jsonUrl: `${assets.basePath}/${asset.path}`,
              atlasUrl: asset.atlasPath ? `${assets.basePath}/${asset.atlasPath}` : `${assets.basePath}/${spinePath}.atlas`,
            });
            total++;
            break;
          case 'audio':
            preloadConfig.audio!.push({ key: asset.key, url: fullPath });
            total++;
            break;
          case 'font':
            preloadConfig.fonts!.push({ family: asset.key, url: fullPath });
            total++;
            break;
          case 'json':
            preloadConfig.json!.push({ key: asset.key, url: fullPath });
            total++;
            break;
        }
      }
    }

    console.log(`[GameLoader] Total assets to preload: ${total}`);
    return { config: preloadConfig, total };
  }

  /**
   * Load assets with configurable fallback behavior
   * showErrorOnFailure=true: throw error if required assets fail (egyptian-adventure)
   * showErrorOnFailure=false: use default graphics on failure (neon-nights)
   */
  private async loadAssetsWithFallback(config: PreloadConfig, loadingConfig: LoadingConfig): Promise<void> {
    let progressSubscriptionId: string | null = null;

    const onProgress = (progress: any) => {
      this.emitProgress(
        LoadingPhase.LOADING_ASSETS,
        progress.percent,
        `Loading: ${progress.currentAsset}`
      );
    };

    progressSubscriptionId = this.eventBus.on('assets:load:progress', onProgress);

    const shouldContinueOnError = !loadingConfig.showErrorOnFailure;

    try {
      console.log(`[GameLoader] Loading assets with behavior: ${loadingConfig.assetLoadBehavior}, showErrorOnFailure: ${loadingConfig.showErrorOnFailure}`);
      
      await this.assetPreloader.preloadWithFallback(config, {
        continueOnError: shouldContinueOnError,
        maxRetries: loadingConfig.maxRetries || 2,
      });
      
      // Check if any assets failed
      const failedAssets = this.assetPreloader.getFailedAssets();
      if (failedAssets.length > 0) {
        console.log('[GameLoader] Failed assets:', failedAssets);
        
        // If showErrorOnFailure is true, throw error for required asset failures
        if (loadingConfig.showErrorOnFailure) {
          const errorMsg = `Required assets failed to load: ${failedAssets.join(', ')}`;
          console.error('[GameLoader]', errorMsg);
          throw new Error(errorMsg);
        }
        
        this.usedDefaultAssets = true;
        console.log('[GameLoader] Using default graphics for failed assets');
      }
    } catch (error) {
      console.warn('[GameLoader] Asset loading error:', error);
      
      // Always throw if showErrorOnFailure is true
      if (loadingConfig.showErrorOnFailure) {
        throw error;
      }
      
      // Mark that we're using default assets
      this.usedDefaultAssets = true;
      console.log('[GameLoader] Using default assets due to load failure');
    } finally {
      if (progressSubscriptionId) {
        this.eventBus.off(progressSubscriptionId);
      }
    }
  }

  /**
   * Set current loading phase and emit event
   */
  private setPhase(phase: LoadingPhase, message: string): void {
    this.phase = phase;
    this.emitProgress(phase, 0, message);
  }

  /**
   * Emit loading progress event
   */
  private emitProgress(phase: LoadingPhase, phaseProgress: number, message: string): void {
    const phaseWeights: Record<LoadingPhase, { start: number; weight: number }> = {
      [LoadingPhase.IDLE]: { start: 0, weight: 0 },
      [LoadingPhase.CHECKING_SESSION]: { start: 0, weight: 5 },
      [LoadingPhase.LAUNCHING_GAME]: { start: 5, weight: 15 },
      [LoadingPhase.LOADING_CONFIG]: { start: 20, weight: 10 },
      [LoadingPhase.LOADING_ASSETS]: { start: 30, weight: 55 },
      [LoadingPhase.CREATING_STAGE]: { start: 85, weight: 10 },
      [LoadingPhase.READY]: { start: 95, weight: 5 },
      [LoadingPhase.ERROR]: { start: 0, weight: 0 },
    };

    const phaseInfo = phaseWeights[phase];
    const totalProgress = phaseInfo.start + (phaseProgress / 100) * phaseInfo.weight;

    const progress: LoadingProgress = {
      phase,
      phaseProgress,
      totalProgress: Math.min(100, totalProgress),
      message,
    };

    this.eventBus.emit('game:loading:progress', progress);
  }

  /**
   * Check if default assets were used
   */
  public usedDefaults(): boolean {
    return this.usedDefaultAssets;
  }

  /**
   * Get current loading phase
   */
  public getPhase(): LoadingPhase {
    return this.phase;
  }

  /**
   * Get current game ID
   */
  public getCurrentGameId(): string | null {
    return this.currentGameId;
  }

  /**
   * Reset loader state
   */
  public reset(): void {
    this.phase = LoadingPhase.IDLE;
    this.currentGameId = null;
    this.usedDefaultAssets = false;
  }

  public destroy(): void {
    this.reset();
    GameLoader.instance = null;
  }
}

export default GameLoader;
