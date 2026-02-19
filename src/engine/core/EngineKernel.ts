/**
 * EngineKernel - Core game engine orchestrator with config-driven spin strategies
 * Uses GameLoader for proper loading sequence
 */

import { PixiApplicationManager } from '../../runtime/pixi/core/PixiApplicationManager';
import { StageManager } from '../../runtime/pixi/stage/StageManager';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { EventBus } from '../../platform/events/EventBus';
import { PixiTicker } from '../../runtime/pixi/core/PixiTicker';
import { PixiRuntime } from '../../runtime/pixi/core/PixiRuntime';
import { ScreenManager } from '../../presentation/screens/ScreenManager';
import { ScreenLayer } from '../../presentation/layers/ScreenLayer';
import { TransitionLayer } from '../../presentation/layers/TransitionLayer';
import { BackgroundLayer } from '../../presentation/layers/BackgroundLayer';
import { TitleLayer } from '../../presentation/layers/TitleLayer';
import { ToastLayer } from '../../presentation/layers/ToastLayer';
import { OverlayLayer } from '../../presentation/layers/OverlayLayer';
import { DebugLayer } from '../../presentation/layers/DebugLayer';
import { BaseScreen } from '../../presentation/screens/base/BaseScreen';
import { GameController } from '../../gameplay/engine/GameController';
import { TickManager } from '../../gameplay/engine/TickManager';
import { PresentationOrchestrator } from '../../gameplay/engine/PresentationOrchestrator';
import { ConfigurableSymbolPool } from '../../presentation/grid/symbols/ConfigurableSymbolPool';
import { GameConfigLoader, LoadedGameConfig } from '../../content/GameConfigLoader';
import { GameLoader, LoadingPhase, LoadingProgress } from './GameLoader';
import { NetworkManager } from '../../platform/networking/NetworkManager';
import { GameSession } from '../../gameplay/state/GameSession';
import { SessionTokenManager } from '../../platform/networking/SessionTokenManager';
import { AudioManager }    from '../audio/AudioManager';
import { AudioController } from '../audio/AudioController';

export enum EngineState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  LOADING = 'loading',
  READY = 'ready',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
  DESTROYED = 'destroyed',
}

export interface EngineConfig {
  containerId: string;
  gameId: string;
  userId?: string;
  debug?: boolean;
  networkMode?: 'rest' | 'stomp' | 'mock';
}

export class EngineKernel {
  private static instance: EngineKernel | null = null;
  
  private state: EngineState = EngineState.UNINITIALIZED;
  private config: EngineConfig | null = null;
  private eventBus: EventBus;
  private pixiManager: PixiApplicationManager;
  private stageManager: StageManager;
  private screenManager: ScreenManager;
  private tickManager: TickManager;
  private gameController: GameController | null = null;
  private presentationOrchestrator: PresentationOrchestrator | null = null;
  private ticker: PixiTicker | null = null;
  private configLoader: GameConfigLoader;
  private gameLoader: GameLoader;
  private networkManager: NetworkManager;
  private audioManager:     AudioManager;
  private audioController:  AudioController;
  private gameConfig: LoadedGameConfig | null = null;
  private currentFeature: string = 'baseGame';
  private session: GameSession;
  private tokenManager: SessionTokenManager;

  // Layers
  private backgroundLayer: BackgroundLayer | null = null;
  private titleLayer: TitleLayer | null = null;
  private screenLayer: ScreenLayer | null = null;
  private transitionLayer: TransitionLayer | null = null;
  private toastLayer: ToastLayer | null = null;
  private overlayLayer: OverlayLayer | null = null;
  private debugLayer: DebugLayer | null = null;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.pixiManager = PixiApplicationManager.getInstance();
    this.stageManager = StageManager.getInstance();
    this.screenManager = ScreenManager.getInstance();
    this.tickManager = TickManager.getInstance();
    this.configLoader = GameConfigLoader.getInstance();
    this.gameLoader = GameLoader.getInstance();
    this.networkManager = NetworkManager.getInstance();
    this.audioManager    = AudioManager.getInstance();
    this.audioController = AudioController.getInstance();
    this.session = GameSession.getInstance();
    this.tokenManager = SessionTokenManager.getInstance();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for feature changes to update spin strategy from config
    this.eventBus.on('feature:start', (payload) => {
      this.setFeatureSpinStrategy(payload.featureType);
    });

    this.eventBus.on('feature:end', () => {
      this.setFeatureSpinStrategy('baseGame');
    });

    // Listen for loading progress
    this.eventBus.on('game:loading:progress', (progress: LoadingProgress) => {
      console.log(`[EngineKernel] Loading: ${progress.message} (${progress.totalProgress.toFixed(0)}%)`);
    });
  }

  /**
   * Set spin strategy based on current feature from config
   */
  private setFeatureSpinStrategy(feature: string): void {
    if (!this.gameConfig || !this.config || !this.gameController) return;

    const spinConfig = this.configLoader.getSpinStrategy(this.config.gameId, feature);
    
    if (spinConfig) {
      this.currentFeature = feature;
      this.gameController.setSpinStrategy(spinConfig.strategyId, spinConfig.config);
      console.log(`[EngineKernel] Set spin strategy for ${feature}: ${spinConfig.strategyId}`);
    }
  }

  public static getInstance(): EngineKernel {
    if (!EngineKernel.instance) {
      EngineKernel.instance = new EngineKernel();
    }
    return EngineKernel.instance;
  }

  public async initialize(config: EngineConfig): Promise<void> {
    if (this.state !== EngineState.UNINITIALIZED) {
      console.warn('[EngineKernel] Already initialized');
      return;
    }

    this.state = EngineState.INITIALIZING;
    this.config = config;

    try {
      // Initialize network manager with per-game config (if present)
      const networkMode = config.networkMode; // optional hard override
      console.log('[EngineKernel] Initializing network (per-game) with override adapter:', networkMode ?? 'none');

      await this.networkManager.initializeForGame(config.gameId, {
        defaultAdapter: networkMode,
      });
      console.log('[EngineKernel] Network manager initialized, adapter:', this.networkManager.getAdapterType());

      // Load game using GameLoader (handles session, launch, config, assets)
      this.state = EngineState.LOADING;
      
      const loadResult = await this.gameLoader.loadGame(
        config.gameId,
        config.userId ?? this.tokenManager.getUserId() ?? 'player1',
        { device: 'desktop', locale: 'en-GB' }
      );

      if (!loadResult.success || !loadResult.config) {
        throw new Error(loadResult.error ?? 'Game load failed');
      }

      this.gameConfig = loadResult.config;
      console.log('[EngineKernel] Game loaded:', this.gameConfig.manifest.name);

      // Initialize Pixi
      await this.pixiManager.initialize({
        containerId: config.containerId,
        backgroundColor: 0x0a0e14,
        enableDebug: config.debug,
      });

      // Inject responsive layouts into PixiRuntime so it can switch virtual
      // dimensions on resize / orientation change.
      const runtime = PixiRuntime.getInstance();
      const responsiveConfig = this.gameConfig.merged?.responsive;
      if (responsiveConfig?.layouts) {
        runtime.setResponsiveLayouts(responsiveConfig.layouts);
        console.log('[EngineKernel] Responsive layouts injected into PixiRuntime');
      }

      // Initialize stage
      this.stageManager.initialize({ enableDebug: config.debug });

      // Create ticker
      const app = runtime.getApp();
      this.ticker = new PixiTicker(app.ticker);

      // Initialize configurable symbol pool (uses config-driven rendering)
      ConfigurableSymbolPool.getInstance(120);

      // Compose layers
      this.composeLayers();

      // Initialize screen manager
      this.screenManager.initialize(this.screenLayer!, this.transitionLayer!);

      // Create and register base screen
      const baseScreen = new BaseScreen();
      this.screenManager.registerScreen(baseScreen);

      // Initialize tick manager
      this.tickManager.initialize(this.ticker);

      // Initialize game controller with session data
      this.gameController = GameController.getInstance();
      this.gameController.initFromSession(this.session);

      // Initialize audio system — muteOnBlur/muteOnPause are false by engine default
      await this.audioManager.initialize();

      // Mount AudioController: wires EventBus events → AudioManager for this game
      await this.audioController.mount(config.gameId);
      console.log('[EngineKernel] AudioController mounted for game:', config.gameId);

      // Apply initial spin strategy from config
      this.applyInitialSpinStrategy();

      // Initialize presentation orchestrator
      this.presentationOrchestrator = PresentationOrchestrator.getInstance();

      // Switch to base screen
      await this.screenManager.switchTo('BaseScreen', false);

      // Check for unfinished session
      if (loadResult.hasUnfinishedSession) {
        console.log('[EngineKernel] Has unfinished session, emitting event');
        this.eventBus.emit('session:initialized', {
          sessionId: this.session.getSessionId(),
          gameId: config.gameId,
          hasUnfinished: true,
        });
      }

      this.state = EngineState.READY;
      this.eventBus.emit('engine:ready', { timestamp: Date.now() });

      console.log('[EngineKernel] Initialized successfully');
    } catch (error) {
      this.state = EngineState.ERROR;
      this.eventBus.emit('engine:error', { error: error as Error, context: 'initialize' });
      throw error;
    }
  }

  /**
   * Apply initial spin strategy from game config
   */
  private applyInitialSpinStrategy(): void {
    if (!this.gameConfig || !this.gameController) return;

    const baseGameConfig = this.gameConfig.manifest.features.baseGame;
    if (baseGameConfig) {
      this.gameController.setSpinStrategy(
        baseGameConfig.spinStrategy,
        baseGameConfig.spinConfig
      );
      console.log(`[EngineKernel] Applied initial spin strategy: ${baseGameConfig.spinStrategy}`);
    }
  }

  private composeLayers(): void {
    const root = this.stageManager.getStageRoot();

    // Create layers
    this.backgroundLayer = new BackgroundLayer();
    this.titleLayer = new TitleLayer();
    this.screenLayer = new ScreenLayer();
    this.transitionLayer = new TransitionLayer();
    this.toastLayer = new ToastLayer();
    this.overlayLayer = new OverlayLayer();
    this.debugLayer = new DebugLayer();

    // Add to stage layers
    root.addToLayer(StageLayer.BACKGROUND, this.backgroundLayer);
    root.addToLayer(StageLayer.TITLE, this.titleLayer);
    root.addToLayer(StageLayer.SCREEN, this.screenLayer);
    root.addToLayer(StageLayer.TRANSITION, this.transitionLayer);
    root.addToLayer(StageLayer.TOAST, this.toastLayer);
    root.addToLayer(StageLayer.OVERLAY, this.overlayLayer);
    root.addToLayer(StageLayer.DEBUG, this.debugLayer);

    // Set title from game config
    const title = this.gameConfig?.manifest.name ?? 'Slot Demo';
    this.titleLayer.setTitle(title);

    console.log('[EngineKernel] Layers composed');
  }

  public start(): void {
    if (this.state !== EngineState.READY && this.state !== EngineState.PAUSED) return;
    this.pixiManager.start();
    this.state = EngineState.RUNNING;
  }

  public pause(): void {
    if (this.state !== EngineState.RUNNING) return;
    this.pixiManager.pause();
    this.tickManager.pause();
    this.audioManager.onEnginePause();
    this.state = EngineState.PAUSED;
    this.eventBus.emit('engine:pause', { reason: 'user' });
  }

  public resume(): void {
    if (this.state !== EngineState.PAUSED) return;
    this.pixiManager.resume();
    this.tickManager.resume();
    this.audioManager.onEngineResume();
    this.state = EngineState.RUNNING;
    this.eventBus.emit('engine:resume', { pausedDuration: 0 });
  }

  public requestSpin(): void {
    if (this.gameController) {
      this.gameController.requestSpin();
    }
  }

  public isIdle(): boolean {
    return this.gameController?.isIdle() ?? false;
  }

  public getGameConfig() {
    return this.gameController?.getConfig() ?? { bet: 10, lines: 20, balance: 1000 };
  }

  public getState(): EngineState { return this.state; }
  public getEventBus(): EventBus { return this.eventBus; }
  public getStageManager(): StageManager { return this.stageManager; }
  public getScreenManager(): ScreenManager { return this.screenManager; }
  public getNetworkManager(): NetworkManager { return this.networkManager; }
  public getSession(): GameSession { return this.session; }

  public toggleDebug(): void {
    if (this.debugLayer) {
      this.debugLayer.toggle();
    }
  }

  /**
   * Get current game configuration
   */
  public getGameManifest(): LoadedGameConfig | null {
    return this.gameConfig;
  }

  /**
   * Get spin strategy for current or specified feature
   */
  public getFeatureSpinStrategy(feature?: string): { strategyId: string; config: any } | null {
    if (!this.config) return null;
    return this.configLoader.getSpinStrategy(this.config.gameId, feature || this.currentFeature);
  }

  /**
   * Get current feature
   */
  public getCurrentFeature(): string {
    return this.currentFeature;
  }

  /**
   * Switch network adapter at runtime
   */
  public async switchNetworkAdapter(type: 'rest' | 'stomp' | 'mock'): Promise<void> {
    await this.networkManager.setAdapter(type);
    console.log(`[EngineKernel] Switched to ${type} network adapter`);
  }

  public destroy(): void {
    this.audioController.destroy();
    this.audioManager.destroy();
    this.tickManager.destroy();
    this.gameController?.destroy();
    this.presentationOrchestrator?.destroy();
    ConfigurableSymbolPool.reset();
    this.screenManager.destroy();
    this.stageManager.destroy();
    this.pixiManager.destroy();
    this.configLoader.clearAll();
    this.gameLoader.destroy();
    this.networkManager.destroy();
    this.eventBus.destroy();
    this.state = EngineState.DESTROYED;
    EngineKernel.instance = null;
  }
}
