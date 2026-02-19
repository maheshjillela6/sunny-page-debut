/**
 * ConfigManager - Centralized configuration management with game-specific overrides
 * All values come from config files - no hardcoded values in the application
 */

import { EventBus } from '../platform/events/EventBus';
import { getTimingDefaultMap, mergeTimings, validateAndNormalizeTimings, type TimingKey, type TimingMap } from './TimingConfig';
import { appendVersionToUrl } from '../config/version.config';

// Type definitions for configuration structures
export interface EngineConfig {
  fixedTimestep: number;
  maxDeltaTime: number;
  targetFPS: number;
}

export interface GridConfig {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  spacing: number;
}

export interface LayoutConfig {
  virtualWidth: number;
  virtualHeight: number;
  grid: {
    x: number;
    y: number;
    cols?: number;
    rows?: number;
    cellWidth?: number;
    cellHeight?: number;
    spacing?: number;
  };
  hud: {
    topBar: { height: number; elements?: any[] };
    bottomBar: { height: number; elements?: any[] };
  };
  layers: Record<string, { zIndex: number }>;
  decorations?: any[];
}

export interface SpinPhaseConfig {
  duration?: number;
  scale?: number;
  easing?: string;
  rate?: number;
  curve?: string;
  bounceStrength?: number;
  bounceCount?: number;
}

export interface SpinModeConfig {
  strategy: string;
  anticipation: SpinPhaseConfig;
  acceleration: SpinPhaseConfig;
  maxSpeed: number;
  deceleration: SpinPhaseConfig & { duration: number };
  stagger: { delay: number; pattern: string };
  settle: SpinPhaseConfig;
  blur?: { enabled: boolean; strength: number };
  zoom?: { startScale: number; endScale: number };
  spiral?: { tightness: number; rotations: number };
}

export interface AnimationConfig {
  spin: Record<string, SpinModeConfig>;
  symbols: {
    landing: any;
    win: any;
    idle: any;
    expand: any;
  };
  reel: {
    blur: any;
    mask: any;
  };
  wins: {
    line: any;
    counter: any;
    bigWin: any;
  };
  transitions: Record<string, any>;
  ambient: any;
}

export interface AudioConfig {
  basePath: string;
  music: Record<string, any>;
  sfx: Record<string, any>;
  volumes: {
    master: number;
    music: number;
    sfx: number;
    ambient: number;
  };
  mute: {
    onBlur: boolean;
    onPause: boolean;
  };
}

export interface SymbolDefinition {
  id: string;
  name: string;
  type: 'high' | 'low' | 'special';
  color: string;
  payouts: number[];
  substitutes?: boolean;
  substituteExclude?: string[];
  triggersFeature?: string;
  triggerCount?: number;
  scatterPay?: boolean;
  expandsOnFreeSpins?: boolean;
  stickyInFreeSpins?: boolean;
  wildMultiplier?: number;
  coinValue?: boolean;
  animations: Record<string, string>;
  spine?: any;
  sprite?: any;
  audio?: Record<string, string>;
}

export interface SymbolMapConfig {
  symbols: Record<string, SymbolDefinition>;
  reelStrips: Record<string, string[][]>;
  weights: Record<string, Record<string, number>>;
  paylines?: number[][];
}

export interface ResponsiveConfig {
  breakpoints: Record<string, any>;
  layouts: Record<string, any>;
  safeArea: { top: number; bottom: number; left: number; right: number };
  letterbox: { enabled: boolean; color: string };
  aspectRatio: { min: number; max: number; preferred: number };
}

export interface AssetsConfig {
  basePath: string;
  bundles: Record<string, { priority: number; assets: any[] }>;
  audio: string;
  fallbacks: { missingSymbol: string; missingBackground: string };
}

export interface GameManifestConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  type: string;
  mechanic: string;
  volatility: string;
  grid: GridConfig;
  paylines: { type: string; count: number; minMatch: number; definitions?: number[][] };
  rtp: { base: number; withFeatures: number };
  maxWinXBet: number;
  features: any;
  symbols: { high: string[]; low: string[]; special: string[] };
  theme: Record<string, string>;
  configFiles: Record<string, string>;
}

export interface MergedGameConfig {
  manifest: GameManifestConfig;
  layout: LayoutConfig;
  responsive: ResponsiveConfig;
  animation: AnimationConfig;
  audio: AudioConfig;
  symbolMap: SymbolMapConfig;
  assets: AssetsConfig;
}

export class ConfigManager {
  private static instance: ConfigManager | null = null;

  private defaults: any = null;
  private globalConfig: any = null;
  private sharedTimings: Record<string, number> = {};
  private gameConfigs: Map<string, MergedGameConfig> = new Map();
  private currentGameId: string | null = null;
  private eventBus: EventBus;

  // Runtime-public config loading (required)
  private readonly publicConfigBaseUrl = '/game-configs';
  private publicConfigCache: Map<string, unknown> = new Map();

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initialize by loading shared defaults and global config.
   * This project is configured to load configs ONLY from /public/game-configs.
   */
  public async initialize(): Promise<void> {
    // Shared defaults (lowest priority)
    this.defaults = await this.fetchPublicJson('./shared/defaults.json');
    console.log('[ConfigManager] Loaded shared defaults');

    // Global config (middle priority)
    this.globalConfig = await this.fetchPublicJson('./shared/config.global.json');
    console.log('[ConfigManager] Loaded global config');

    // Shared timings (presentation policy)
    this.sharedTimings = await this.fetchPublicJson('./shared/timings.json');
    console.log('[ConfigManager] Loaded shared timings');
  }

  /**
   * Load JSON from public folder (runtime), with in-memory caching.
   *
   * IMPORTANT: Fail-hard. No bundled fallback.
   */
  private async fetchPublicJson<T>(modulePath: string): Promise<T> {
    const normalized = modulePath.replace(/^\./, ''); // './shared/x.json' -> '/shared/x.json'
    const url = `${this.publicConfigBaseUrl}${normalized}`;

    if (this.publicConfigCache.has(url)) {
      return this.publicConfigCache.get(url) as T;
    }

    const res = await fetch(appendVersionToUrl(url), {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`[ConfigManager] Public config fetch failed (${res.status}): ${url}`);
    }

    const json = (await res.json()) as T;
    this.publicConfigCache.set(url, json as unknown);
    return json;
  }

  /**
   * Load a module from public configs (required).
   */
  private async loadModule<T>(path: string): Promise<T> {
    return this.fetchPublicJson<T>(path);
  }

  /**
   * Load all configuration for a specific game
   * Supports both legacy and new segregated config formats
   */
  public async loadGameConfig(gameId: string): Promise<MergedGameConfig> {
    // Return cached if available
    if (this.gameConfigs.has(gameId)) {
      const cached = this.gameConfigs.get(gameId)!;
      this.currentGameId = gameId;
      return cached;
    }

    const basePath = `./games/${gameId}`;

    try {
      // Load manifest first to determine config structure
      const manifest = await this.loadModule<GameManifestConfig>(`${basePath}/manifest.json`);
      
      // Try new segregated config files first, fall back to legacy
      const [
        layout,
        gridConfig,
        spinConfig,
        symbolsConfig,
        assetsConfig,
        audioConfig,
        responsiveConfig,
        animationConfig,
        featuresConfig,
        gameTimings,
      ] = await Promise.all([
        this.loadModule<LayoutConfig>(`${basePath}/layout.json`).catch(() => null),
        this.loadModule<any>(`${basePath}/grid.config.json`).catch(() => null),
        this.loadModule<any>(`${basePath}/spin.config.json`).catch(() => null),
        this.loadModule<any>(`${basePath}/symbols.config.json`).catch(() => null),
        this.loadModule<any>(`${basePath}/assets.config.json`).catch(() => null),
        this.loadModule<any>(`${basePath}/audio.config.json`).catch(() => null),
        this.loadModule<ResponsiveConfig>(`${basePath}/responsive.config.json`)
          .catch(() => this.loadModule<ResponsiveConfig>(`${basePath}/responsive.json`))
          .catch(() => null),
        this.loadModule<AnimationConfig>(`${basePath}/animation.config.json`)
          .catch(() => this.loadModule<AnimationConfig>(`${basePath}/animation.json`))
          .catch(() => null),
        this.loadModule<any>(`${basePath}/features.config.json`).catch(() => null),
        this.loadModule<Record<string, number>>(`${basePath}/timings.json`).catch(() => null),
      ]);

      // Load legacy symbol-map if new format not found
      let symbolMap = null;
      if (symbolsConfig?.SYMBOLS) {
        symbolMap = this.convertNewSymbolFormat(symbolsConfig);
      } else {
        symbolMap = await this.loadModule<SymbolMapConfig>(`${basePath}/symbol-map.json`).catch(() => null);
      }

      // Load legacy assets if new format not found
      let assets = null;
      if (assetsConfig?.BUNDLES) {
        assets = this.convertNewAssetFormat(assetsConfig);
      } else {
        assets = await this.loadModule<AssetsConfig>(`${basePath}/assets.json`).catch(() => null);
      }

      // Build animation config from spin config if available
      let animation = animationConfig;
      if (spinConfig?.MODES) {
        animation = this.buildAnimationFromSpinConfig(spinConfig, animationConfig);
      }

      // Resolve timings (presentation policy): shared defaults + shared timings.json + per-game timings.json
      const timingBase: TimingMap = mergeTimings(getTimingDefaultMap(), validateAndNormalizeTimings(this.sharedTimings));
      const timingOverrides: TimingMap = validateAndNormalizeTimings(gameTimings);
      const resolvedTimings: TimingMap = mergeTimings(timingBase, timingOverrides);

      // Merge with defaults
      const mergedConfig: MergedGameConfig = {
        manifest: this.mergeDeep(this.getDefaultManifest(gameId), manifest),
        layout: this.mergeDeep(this.defaults?.layout ?? {}, layout ?? {}),
        responsive: this.mergeDeep(this.getDefaultResponsive(), responsiveConfig ?? {}),
        animation: this.mergeDeep(this.getDefaultAnimation(), animation ?? {}),
        audio: this.mergeDeep(this.getDefaultAudio(gameId), audioConfig ?? {}),
        symbolMap: symbolMap ?? { symbols: {}, reelStrips: { base: [] }, weights: {} },
        assets: this.mergeDeep(this.getDefaultAssets(gameId), assets ?? {}),
      };

      // Store extended config data (non-breaking, additive)
      (mergedConfig as any).grid = gridConfig ?? null;
      (mergedConfig as any).spin = spinConfig ?? null;
      (mergedConfig as any).features = featuresConfig ?? null;
      (mergedConfig as any).timings = resolvedTimings;

      // Cache and set current
      this.gameConfigs.set(gameId, mergedConfig);
      this.currentGameId = gameId;

      console.log(`[ConfigManager] Loaded config for: ${gameId}`);
      this.eventBus.emit('config:loaded', { gameId });

      return mergedConfig;
    } catch (error) {
      console.error(`[ConfigManager] Failed to load config for ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Convert new symbol config format to legacy format
   */
  private convertNewSymbolFormat(config: any): SymbolMapConfig {
    const symbols: Record<string, SymbolDefinition> = {};
    
    for (const [id, data] of Object.entries(config.SYMBOLS as Record<string, any>)) {
      symbols[id] = {
        id: data.ID ?? id,
        name: data.NAME ?? id,
        type: (data.TYPE ?? 'low') as 'high' | 'low' | 'special',
        color: data.COLOR ?? '#ffffff',
        payouts: data.PAYOUTS ?? [],
        substitutes: data.SUBSTITUTES,
        substituteExclude: data.SUBSTITUTE_EXCLUDE,
        triggersFeature: data.TRIGGERS_FEATURE,
        triggerCount: data.TRIGGER_COUNT,
        scatterPay: data.SCATTER_PAY,
        expandsOnFreeSpins: data.EXPANDS_ON_FREE_SPINS,
        stickyInFreeSpins: data.STICKY_IN_FREE_SPINS,
        wildMultiplier: data.WILD_MULTIPLIER,
        coinValue: data.COIN_VALUE,
        animations: data.ANIMATIONS ?? {},
        spine: data.ASSETS?.SPINE ? { key: data.ASSETS.SPINE } : undefined,
        sprite: data.ASSETS?.STATIC ? { key: data.ASSETS.STATIC } : undefined,
        audio: data.AUDIO,
      };
    }

    return {
      symbols,
      reelStrips: config.REEL_STRIPS ?? { base: [] },
      weights: config.WEIGHTS ?? {},
      paylines: config.PAYLINES,
    };
  }

  /**
   * Convert new asset config format to legacy format
   */
  private convertNewAssetFormat(config: any): AssetsConfig {
    const bundles: Record<string, { priority: number; assets: any[] }> = {};
    
    for (const [key, data] of Object.entries(config.BUNDLES as Record<string, any>)) {
      bundles[key.toLowerCase()] = {
        priority: data.PRIORITY ?? 0,
        assets: (data.ASSETS ?? []).map((a: any) => ({
          type: a.TYPE?.toLowerCase() ?? 'image',
          key: a.KEY,
          path: a.PATH,
          imagePath: a.IMAGE_PATH,
          atlasPath: a.ATLAS_PATH,
        })),
      };
    }

    return {
      basePath: config.BASE_PATH ?? '',
      bundles,
      audio: config.AUDIO_CONFIG ?? 'audio.json',
      fallbacks: {
        missingSymbol: config.FALLBACKS?.MISSING_SYMBOL ?? '',
        missingBackground: config.FALLBACKS?.MISSING_BACKGROUND ?? '#000000',
      },
    };
  }

  /**
   * Build animation config from spin config
   */
  private buildAnimationFromSpinConfig(spinConfig: any, existingAnimation: any): AnimationConfig {
    const spin: Record<string, SpinModeConfig> = {};
    
    for (const [mode, data] of Object.entries(spinConfig.MODES as Record<string, any>)) {
      const modeKey = mode === 'BASE_GAME' ? 'baseGame' : 
                      mode === 'FREE_SPINS' ? 'freeSpins' :
                      mode === 'HOLD_RESPIN' ? 'holdRespin' : mode.toLowerCase();
      
      spin[modeKey] = {
        strategy: data.STRATEGY ?? 'TopToBottom',
        anticipation: {
          duration: data.ANTICIPATION?.DURATION ?? 50,
          scale: data.ANTICIPATION?.SCALE ?? 0.98,
          easing: data.ANTICIPATION?.EASING ?? 'easeOutQuad',
        },
        acceleration: {
          rate: data.ACCELERATION?.RATE ?? 120,
          curve: data.ACCELERATION?.CURVE ?? 'exponential',
        },
        maxSpeed: data.MAX_SPEED ?? 28,
        deceleration: {
          rate: data.DECELERATION?.RATE ?? 80,
          duration: data.DECELERATION?.DURATION ?? 350,
          curve: data.DECELERATION?.CURVE ?? 'easeOutCubic',
        },
        stagger: {
          delay: data.STAGGER?.DELAY ?? 80,
          pattern: data.STAGGER?.PATTERN ?? 'sequential',
        },
        settle: {
          duration: data.SETTLE?.DURATION ?? 200,
          bounceStrength: data.SETTLE?.BOUNCE_STRENGTH ?? 0.3,
          bounceCount: data.SETTLE?.BOUNCE_COUNT ?? 2,
          easing: data.SETTLE?.EASING ?? 'easeOutBack',
        },
        blur: data.BLUR,
        zoom: data.ZOOM,
        spiral: data.SPIRAL,
      };
    }

    return {
      spin,
      symbols: existingAnimation?.symbols ?? this.getDefaultAnimation().symbols,
      reel: existingAnimation?.reel ?? this.getDefaultAnimation().reel,
      wins: existingAnimation?.wins ?? this.getDefaultAnimation().wins,
      transitions: existingAnimation?.transitions ?? this.getDefaultAnimation().transitions,
      ambient: existingAnimation?.ambient ?? this.getDefaultAnimation().ambient,
    };
  }

  /**
   * Get current game config
   */
  public getConfig(): MergedGameConfig | null {
    if (!this.currentGameId) return null;
    return this.gameConfigs.get(this.currentGameId) ?? null;
  }

  /**
   * Get config for specific game
   */
  public getGameConfig(gameId: string): MergedGameConfig | null {
    return this.gameConfigs.get(gameId) ?? null;
  }

  /**
   * Get spin config for a specific feature mode with hierarchy
   * Priority: game spin.config > game manifest features > global > defaults
   */
  public getSpinConfig(mode: string = 'baseGame'): SpinModeConfig | null {
    const config = this.getConfig();
    if (!config) return null;
    
    // Get from animation config (already merged)
    const animationSpin = config.animation.spin[mode] ?? config.animation.spin.baseGame;
    
    // Get from extended spin config if available
    const extendedSpin = (config as any).spin;
    if (extendedSpin?.MODES) {
      const modeKey = mode === 'baseGame' ? 'BASE_GAME' : 
                      mode === 'freeSpins' ? 'FREE_SPINS' :
                      mode === 'holdRespin' ? 'HOLD_RESPIN' : mode.toUpperCase();
      
      const modeConfig = extendedSpin.MODES[modeKey];
      if (modeConfig) {
        // Merge extended with animation
        return {
          ...animationSpin,
          strategy: modeConfig.STRATEGY ?? animationSpin?.strategy,
          maxSpeed: modeConfig.MAX_SPEED ?? animationSpin?.maxSpeed,
          anticipation: {
            duration: modeConfig.ANTICIPATION?.DURATION ?? animationSpin?.anticipation?.duration,
            scale: modeConfig.ANTICIPATION?.SCALE ?? animationSpin?.anticipation?.scale,
            easing: modeConfig.ANTICIPATION?.EASING ?? animationSpin?.anticipation?.easing,
          },
          acceleration: {
            rate: modeConfig.ACCELERATION?.RATE ?? animationSpin?.acceleration?.rate,
            curve: modeConfig.ACCELERATION?.CURVE ?? animationSpin?.acceleration?.curve,
          },
          deceleration: {
            rate: modeConfig.DECELERATION?.RATE ?? animationSpin?.deceleration?.rate,
            duration: modeConfig.DECELERATION?.DURATION ?? animationSpin?.deceleration?.duration,
            curve: modeConfig.DECELERATION?.CURVE ?? animationSpin?.deceleration?.curve,
          },
          stagger: {
            delay: modeConfig.STAGGER?.DELAY ?? animationSpin?.stagger?.delay,
            pattern: modeConfig.STAGGER?.PATTERN ?? animationSpin?.stagger?.pattern,
          },
          settle: {
            duration: modeConfig.SETTLE?.DURATION ?? animationSpin?.settle?.duration,
            bounceStrength: modeConfig.SETTLE?.BOUNCE_STRENGTH ?? animationSpin?.settle?.bounceStrength,
            bounceCount: modeConfig.SETTLE?.BOUNCE_COUNT ?? animationSpin?.settle?.bounceCount,
            easing: modeConfig.SETTLE?.EASING ?? animationSpin?.settle?.easing,
          },
        } as SpinModeConfig;
      }
    }
    
    return animationSpin ?? null;
  }

  /**
   * Get extended grid config (full grid.config.json data)
   */
  public getExtendedGridConfig(): any {
    const config = this.getConfig();
    return (config as any)?.grid ?? null;
  }

  /**
   * Get extended spin config (full spin.config.json data)
   */
  public getExtendedSpinConfig(): any {
    const config = this.getConfig();
    return (config as any)?.spin ?? null;
  }

  /**
   * Get features config from game
   */
  public getFeaturesConfig(): any {
    const config = this.getConfig();
    return (config as any)?.features ?? config?.manifest?.features ?? null;
  }

  /**
   * Get engine configuration with hierarchy: game > global > defaults > built-in
   */
  public getEngineConfig(): EngineConfig {
    const config = this.getConfig();
    const gameEngine = (config as any)?.engine;
    const globalEngine = this.globalConfig?.ENGINE;
    const defaultEngine = this.defaults?.engine;
    
    const builtIn = {
      fixedTimestep: 0.016667,
      maxDeltaTime: 0.033333,
      targetFPS: 60,
    };

    return {
      ...builtIn,
      ...this.convertGlobalToLower(defaultEngine),
      ...this.convertGlobalToLower(globalEngine),
      ...gameEngine,
    };
  }

  /**
   * Get grid configuration for current game with hierarchy.
   * Priority: game grid.config.json > global > defaults > built-in
   *
   * NOTE: We intentionally DO NOT use manifest.grid here to avoid duplicate/conflicting
   * grid sources. The dedicated grid config should be the single source of truth.
   */
  public getGridConfig(): GridConfig | null {
    const config = this.getConfig();
    if (!config) return null;

    // Extended grid config (from grid.config.json)
    const extendedGrid = (config as any).grid;

    // Global + defaults fallbacks
    const globalGrid = this.globalConfig?.GRID;
    const defaultGrid = this.defaults?.grid;

    // Built-in fallback
    const builtIn: GridConfig = {
      cols: 5,
      rows: 3,
      cellWidth: 120,
      cellHeight: 120,
      spacing: 8,
    };

    const merged = {
      ...builtIn,
      ...this.convertGlobalToLower(defaultGrid),
      ...this.convertGlobalToLower(globalGrid),
      ...this.convertGridConfigFormat(extendedGrid),
    };

    return merged;
  }

  /**
   * Get secondary grid config for dual-grid games.
   * Reads from grid.config.json SECONDARY_GRID or layout.json grids.secondary.
   */
  public getSecondaryGridConfig(): GridConfig | null {
    const config = this.getConfig();
    if (!config) return null;

    // Check extended grid config (grid.config.json → SECONDARY_GRID)
    const extendedGrid = (config as any).grid;
    if (extendedGrid?.SECONDARY_GRID) {
      const sg = extendedGrid.SECONDARY_GRID;
      return {
        cols: sg.COLS,
        rows: sg.ROWS,
        cellWidth: sg.CELL_WIDTH,
        cellHeight: sg.CELL_HEIGHT,
        spacing: sg.SPACING,
      };
    }

    // Check layout config (layout.json → grids.secondary)
    const layout = config.layout as any;
    if (layout?.grids?.secondary) {
      const sg = layout.grids.secondary;
      return {
        cols: sg.cols,
        rows: sg.rows,
        cellWidth: sg.cellWidth,
        cellHeight: sg.cellHeight,
        spacing: sg.spacing,
      };
    }

    // Check manifest grids.secondary
    const manifest = (config as any).manifest;
    if (manifest?.grids?.secondary) {
      const sg = manifest.grids.secondary;
      return {
        cols: sg.cols,
        rows: sg.rows,
        cellWidth: sg.cellWidth,
        cellHeight: sg.cellHeight,
        spacing: sg.spacing,
      };
    }

    return null;
  }

  /**
   * Get the secondary grid position from layout config.
   */
  public getSecondaryGridPosition(): { x: number; y: number } | null {
    const config = this.getConfig();
    if (!config) return null;

    const layout = config.layout as any;
    if (layout?.grids?.secondary?.x !== undefined && layout?.grids?.secondary?.y !== undefined) {
      return { x: layout.grids.secondary.x, y: layout.grids.secondary.y };
    }

    return null;
  }

  /**
   * Convert global config (UPPER_CASE) to lower case format
   */
  private convertGlobalToLower(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result: any = {};
    for (const key in obj) {
      const lowerKey = key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const value = obj[key];
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[lowerKey] = this.convertGlobalToLower(value);
      } else {
        result[lowerKey] = value;
      }
    }
    return result;
  }

  /**
   * Convert grid config from new format to GridConfig
   */
  private convertGridConfigFormat(gridConfig: any): Partial<GridConfig> | null {
    if (!gridConfig?.GRID) return null;
    
    const grid = gridConfig.GRID;
    return {
      cols: grid.COLS,
      rows: grid.ROWS,
      cellWidth: grid.CELL_WIDTH,
      cellHeight: grid.CELL_HEIGHT,
      spacing: grid.SPACING,
    };
  }

  /**
   * Get layout configuration for current game
   */
  public getLayoutConfig(): LayoutConfig | null {
    const config = this.getConfig();
    if (!config) return null;
    return config.layout;
  }

  /**
   * Get symbol definition
   */
  public getSymbolDefinition(symbolId: string): SymbolDefinition | null {
    const config = this.getConfig();
    if (!config) return null;
    return config.symbolMap.symbols[symbolId] ?? null;
  }

  /**
   * Get all symbols
   */
  public getSymbols(): Record<string, SymbolDefinition> {
    const config = this.getConfig();
    if (!config) return {};
    return config.symbolMap.symbols;
  }

  /**
   * Get reel strips for a mode
   */
  public getReelStrips(mode: string = 'base'): string[][] {
    const config = this.getConfig();
    if (!config) return [];
    return config.symbolMap.reelStrips[mode] ?? config.symbolMap.reelStrips.base ?? [];
  }

  /**
   * Get audio configuration
   */
  public getAudioConfig(): AudioConfig | null {
    return this.getConfig()?.audio ?? null;
  }

  /**
   * Get assets configuration
   */
  public getAssetsConfig(): AssetsConfig | null {
    return this.getConfig()?.assets ?? null;
  }

  /**
   * Get responsive layout for current breakpoint
   */
  public getResponsiveLayout(breakpoint: string): any {
    const config = this.getConfig();
    if (!config) return null;
    return config.responsive?.layouts?.[breakpoint] ?? config.responsive?.layouts?.desktop ?? null;
  }

  /**
   * Get win animation config
   */
  public getWinAnimationConfig(): any {
    const config = this.getConfig();
    if (!config) return null;
    return config.animation.wins;
  }

  /**
   * Get transition config
   */
  public getTransitionConfig(transitionType: string): any {
    const config = this.getConfig();
    if (!config) return null;
    return config.animation.transitions[transitionType] ?? null;
  }

  /**
   * Get resolved presentation timings (shared defaults + per-game overrides)
   *
   * Timings are policy, not facts; safe to vary per game within validated bounds.
   */
  public getTimings(): TimingMap {
    const config = this.getConfig();
    return ((config as any)?.timings ?? {}) as TimingMap;
  }

  public getTimingMs(key: TimingKey, fallback?: number): number {
    const t = this.getTimings()[key];
    return typeof t === 'number' ? t : (fallback ?? getTimingDefaultMap()[key]);
  }

  /**
   * Get value from config with path (dot notation)
   */
  public getValue<T>(path: string, defaultValue?: T): T {
    const config = this.getConfig();
    if (!config) return defaultValue as T;

    const parts = path.split('.');
    let current: any = config;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return defaultValue as T;
      }
      current = current[part];
    }

    return (current ?? defaultValue) as T;
  }

  /**
   * Get shared default value
   */
  public getDefault<T>(path: string, fallback?: T): T {
    if (!this.defaults) return fallback as T;

    const parts = path.split('.');
    let current: any = this.defaults;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return fallback as T;
      }
      current = current[part];
    }

    return (current ?? fallback) as T;
  }

  /**
   * Clear cached config for a game
   */
  public clearCache(gameId: string): void {
    this.gameConfigs.delete(gameId);
    if (this.currentGameId === gameId) {
      this.currentGameId = null;
    }
  }

  /**
   * Clear all cached configs
   */
  public clearAll(): void {
    this.gameConfigs.clear();
    this.currentGameId = null;
  }

  // Private helper methods

  private async loadJSON<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load: ${url}`);
    }
    return response.json();
  }

  private mergeDeep(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;

    const output = { ...target };
    
    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        if (target[key] instanceof Object && !Array.isArray(target[key])) {
          output[key] = this.mergeDeep(target[key], source[key]);
        } else {
          output[key] = source[key];
        }
      } else {
        output[key] = source[key];
      }
    }

    return output;
  }

  private getBuiltInDefaults(): any {
    return {
      engine: {
        fixedTimestep: 0.016667,
        maxDeltaTime: 0.033333,
        targetFPS: 60,
      },
      grid: {
        cols: 5,
        rows: 3,
        cellWidth: 120,
        cellHeight: 120,
        spacing: 8,
      },
      spin: {
        anticipation: { duration: 50, scale: 0.98, easing: 'easeOutQuad' },
        acceleration: { rate: 120, curve: 'exponential' },
        maxSpeed: 28,
        deceleration: { rate: 80, duration: 350, curve: 'easeOutCubic' },
        stagger: { delay: 80, pattern: 'sequential' },
        settle: { duration: 200, bounceStrength: 0.3, bounceCount: 2, easing: 'easeOutBack' },
        minSpinTime: 500,
      },
    };
  }

  private getDefaultManifest(gameId: string): Partial<GameManifestConfig> {
    return {
      id: gameId,
      name: gameId,
      version: '1.0.0',
      type: 'SLOT',
      mechanic: 'standard',
      volatility: 'medium',
      grid: this.defaults?.grid ?? { cols: 5, rows: 3, cellWidth: 120, cellHeight: 120, spacing: 8 },
      paylines: this.defaults?.paylines ?? { type: 'ways', count: 243, minMatch: 3 },
      rtp: this.defaults?.rtp ?? { base: 96.0, withFeatures: 96.5 },
      maxWinXBet: 5000,
    };
  }

  private getDefaultResponsive(): ResponsiveConfig {
    return {
      breakpoints: {
        mobile: { maxWidth: 768, orientation: 'portrait' },
        tablet: { minWidth: 769, maxWidth: 1024 },
        desktop: { minWidth: 1025 },
      },
      layouts: {
        desktop: { virtualWidth: 1280, virtualHeight: 720 },
        tablet: { virtualWidth: 1024, virtualHeight: 768 },
        mobile: { virtualWidth: 720, virtualHeight: 1280 },
      },
      safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
      letterbox: { enabled: true, color: '#000000' },
      aspectRatio: { min: 0.5, max: 2.0, preferred: 1.778 },
    };
  }

  private getDefaultAnimation(): AnimationConfig {
    const spinDefaults = this.defaults?.spin ?? {};
    return {
      spin: {
        baseGame: {
          strategy: 'top_to_bottom',
          anticipation: spinDefaults.anticipation ?? { duration: 50, scale: 0.98, easing: 'easeOutQuad' },
          acceleration: spinDefaults.acceleration ?? { rate: 120, curve: 'exponential' },
          maxSpeed: spinDefaults.maxSpeed ?? 28,
          deceleration: spinDefaults.deceleration ?? { rate: 80, duration: 350, curve: 'easeOutCubic' },
          stagger: spinDefaults.stagger ?? { delay: 80, pattern: 'sequential' },
          settle: spinDefaults.settle ?? { duration: 200, bounceStrength: 0.3, bounceCount: 2, easing: 'easeOutBack' },
          blur: { enabled: true, strength: 0.5 },
        },
      },
      symbols: {
        landing: this.defaults?.symbols?.landingBounce ?? { enabled: true, strength: 0.1, duration: 150 },
        win: this.defaults?.symbols?.winPulse ?? { enabled: true, scale: 1.15, duration: 400, repeatCount: 3 },
        idle: this.defaults?.symbols?.idleAnimation ?? { enabled: false, interval: 5000 },
        expand: { duration: 500, easing: 'easeOutBack', scale: 3.0 },
      },
      reel: {
        blur: { enabled: true, strengthMultiplier: 1.0, fadeInDuration: 100, fadeOutDuration: 150 },
        mask: { enabled: true, fadeEdges: true, fadeSize: 20 },
      },
      wins: this.defaults?.wins ?? {
        line: { draw: { duration: 300, easing: 'easeOutQuad' } },
        counter: { duration: 1000, easing: 'easeOutQuad' },
        bigWin: { entrance: { type: 'zoom_bounce', duration: 500 } },
      },
      transitions: this.defaults?.transitions ?? {
        fade: { duration: 500, easing: 'easeInOutSine' },
        slide: { duration: 400, direction: 'left', easing: 'easeOutCubic' },
      },
      ambient: { background: { parallax: { enabled: false } }, particles: { enabled: false } },
    };
  }

  private getDefaultAudio(gameId: string): AudioConfig {
    return {
      basePath: `/assets/games/slots/${gameId}/audios`,
      music: {},
      sfx: {},
      volumes: this.defaults?.audio ?? { master: 1.0, music: 0.7, sfx: 1.0, ambient: 0.3 },
      mute: { onBlur: true, onPause: true },
    };
  }

  private getDefaultAssets(gameId: string): AssetsConfig {
    return {
      basePath: `/assets/games/slots/${gameId}`,
      bundles: {},
      audio: 'audio.json',
      fallbacks: { missingSymbol: 'images/placeholder_symbol.png', missingBackground: '#000000' },
    };
  }

  public static reset(): void {
    if (ConfigManager.instance) {
      ConfigManager.instance.clearAll();
      ConfigManager.instance = null;
    }
  }
}
