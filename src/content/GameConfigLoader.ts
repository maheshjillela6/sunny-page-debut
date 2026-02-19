/**
 * GameConfigLoader - Loads and caches game configuration files using ConfigManager
 */

import { GameManifest, LayoutManifest, SymbolMapManifest, SymbolDefinition, FeatureConfig, ThemeManifest, PaylinesManifest } from './GameManifest';
import { ConfigManager, MergedGameConfig, SymbolDefinition as ConfigSymbolDef } from './ConfigManager';
import { EventBus } from '../platform/events/EventBus';

export interface LoadedGameConfig {
  manifest: GameManifest;
  layout: LayoutManifest;
  symbolMap: SymbolMapManifest;
  merged: MergedGameConfig;
}

export class GameConfigLoader {
  private static instance: GameConfigLoader | null = null;
  
  private cache: Map<string, LoadedGameConfig> = new Map();
  private configManager: ConfigManager;
  private eventBus: EventBus;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): GameConfigLoader {
    if (!GameConfigLoader.instance) {
      GameConfigLoader.instance = new GameConfigLoader();
    }
    return GameConfigLoader.instance;
  }

  /**
   * Initialize the loader and shared defaults
   */
  public async initialize(): Promise<void> {
    await this.configManager.initialize();
  }

  /**
   * Load all configuration for a game
   */
  public async loadGame(gameId: string): Promise<LoadedGameConfig> {
    // Check cache
    if (this.cache.has(gameId)) {
      console.log(`[GameConfigLoader] Using cached config for: ${gameId}`);
      return this.cache.get(gameId)!;
    }

    console.log(`[GameConfigLoader] Loading config for: ${gameId}`);

    // Load merged config from ConfigManager
    const merged = await this.configManager.loadGameConfig(gameId);

    // Convert to legacy format for backward compatibility
    const config: LoadedGameConfig = {
      manifest: this.convertToLegacyManifest(merged),
      layout: merged.layout as LayoutManifest,
      symbolMap: this.convertSymbolMap(merged.symbolMap),
      merged,
    };

    // Cache the loaded config
    this.cache.set(gameId, config);
    
    console.log(`[GameConfigLoader] Loaded config for: ${gameId}`, {
      spinStrategy: merged.animation.spin.baseGame?.strategy,
      grid: `${merged.manifest.grid.cols}x${merged.manifest.grid.rows}`,
      symbols: Object.keys(merged.symbolMap.symbols).length,
    });

    return config;
  }

  /**
   * Convert symbol map to legacy format
   */
  private convertSymbolMap(symbolMap: MergedGameConfig['symbolMap']): SymbolMapManifest {
    const convertedSymbols: Record<string, SymbolDefinition> = {};
    
    for (const [key, symbol] of Object.entries(symbolMap.symbols)) {
      convertedSymbols[key] = {
        id: symbol.id,
        name: symbol.name,
        type: symbol.type,
        color: symbol.color,
        payouts: symbol.payouts,
        substitutes: symbol.substitutes,
        triggersFeature: symbol.triggersFeature,
        expandsOnFreeSpins: symbol.expandsOnFreeSpins,
        animations: {
          idle: symbol.animations.idle ?? `${symbol.id.toLowerCase()}_idle`,
          win: symbol.animations.win ?? `${symbol.id.toLowerCase()}_win`,
          land: symbol.animations.land,
          expand: symbol.animations.expand,
          trigger: symbol.animations.trigger,
        },
      };
    }

    return {
      symbols: convertedSymbols,
      reelStrips: symbolMap.reelStrips,
    };
  }

  /**
   * Get cached config
   */
  public getConfig(gameId: string): LoadedGameConfig | null {
    return this.cache.get(gameId) ?? null;
  }

  /**
   * Get spin strategy for a feature
   */
  public getSpinStrategy(gameId: string, feature: string = 'baseGame'): { strategyId: string; config: any } | null {
    const spinConfig = this.configManager.getSpinConfig(feature);
    if (!spinConfig) return null;

    return {
      strategyId: spinConfig.strategy,
      config: {
        maxSpeed: spinConfig.maxSpeed,
        acceleration: spinConfig.acceleration.rate,
        deceleration: spinConfig.deceleration.rate,
        bounceStrength: spinConfig.settle.bounceStrength,
        staggerDelay: spinConfig.stagger.delay,
        anticipationDuration: spinConfig.anticipation.duration,
        settleDuration: spinConfig.settle.duration,
      },
    };
  }

  /**
   * Get spin config for current game and mode
   */
  public getSpinConfig(feature: string = 'baseGame'): any {
    return this.configManager.getSpinConfig(feature);
  }

  /**
   * Get engine timing config
   */
  public getEngineConfig(): { fixedTimestep: number; maxDeltaTime: number; targetFPS: number } {
    return this.configManager.getEngineConfig();
  }

  /**
   * Get grid config for current game
   */
  public getGridConfig(): any {
    return this.configManager.getGridConfig();
  }

  /**
   * Get animation config value
   */
  public getAnimationValue<T>(path: string, defaultValue?: T): T {
    return this.configManager.getValue(`animation.${path}`, defaultValue);
  }

  /**
   * Get symbol definition
   */
  public getSymbol(symbolId: string): any {
    return this.configManager.getSymbolDefinition(symbolId);
  }

  /**
   * Convert merged config to legacy manifest format
   */
  private convertToLegacyManifest(merged: MergedGameConfig): GameManifest {
    const spinConfig = merged.animation.spin.baseGame;
    
    const baseGameConfig: FeatureConfig = {
      spinStrategy: spinConfig?.strategy ?? 'top_to_bottom',
      spinConfig: {
        maxSpeed: spinConfig?.maxSpeed ?? 28,
        acceleration: spinConfig?.acceleration?.rate ?? 120,
        deceleration: spinConfig?.deceleration?.rate ?? 80,
        bounceStrength: spinConfig?.settle?.bounceStrength ?? 0.3,
        staggerDelay: spinConfig?.stagger?.delay ?? 80,
      },
    };

    const features: { baseGame: FeatureConfig; freeSpins?: FeatureConfig; holdRespin?: FeatureConfig; [key: string]: FeatureConfig | undefined } = {
      baseGame: baseGameConfig,
    };

    if (merged.manifest.features.freeSpins) {
      features.freeSpins = {
        spinStrategy: merged.animation.spin.freeSpins?.strategy ?? 'zoom_in',
        spinConfig: {
          maxSpeed: merged.animation.spin.freeSpins?.maxSpeed ?? 32,
        },
        triggerSymbol: merged.manifest.features.freeSpins.triggerSymbol,
        triggerCount: merged.manifest.features.freeSpins.triggerCount,
        initialSpins: merged.manifest.features.freeSpins.initialSpins,
      };
    }

    if (merged.manifest.features.holdRespin) {
      features.holdRespin = {
        spinStrategy: merged.animation.spin.holdRespin?.strategy ?? 'fade_shuffle',
        spinConfig: {},
        triggerSymbol: merged.manifest.features.holdRespin?.triggerSymbol,
        triggerCount: merged.manifest.features.holdRespin?.triggerCount,
      };
    }

    // Convert paylines type
    const paylinesType = merged.manifest.paylines.type as 'lines' | 'ways' | 'cluster' | 'megaways';
    const paylines: PaylinesManifest = {
      type: paylinesType,
      count: merged.manifest.paylines.count,
    };

    // Ensure theme has required properties
    const theme: ThemeManifest = {
      primaryColor: merged.manifest.theme.primaryColor ?? '#8b5cf6',
      accentColor: merged.manifest.theme.accentColor ?? '#06b6d4',
      backgroundColor: merged.manifest.theme.backgroundColor ?? '#0f0f23',
    };

    return {
      id: merged.manifest.id,
      name: merged.manifest.name,
      version: merged.manifest.version,
      description: merged.manifest.description,
      grid: merged.manifest.grid,
      symbols: merged.manifest.symbols,
      features,
      paylines,
      rtp: merged.manifest.rtp,
      assets: {
        basePath: merged.assets.basePath,
        preload: this.flattenAssetBundles(merged.assets.bundles),
      },
      theme,
    };
  }

  private flattenAssetBundles(bundles: Record<string, any>): any[] {
    const assets: any[] = [];
    for (const bundle of Object.values(bundles)) {
      if (bundle.assets) {
        assets.push(...bundle.assets);
      }
    }
    return assets;
  }

  /**
   * Clear cache for a specific game
   */
  public clearCache(gameId: string): void {
    this.cache.delete(gameId);
    this.configManager.clearCache(gameId);
  }

  /**
   * Clear all cached configs
   */
  public clearAll(): void {
    this.cache.clear();
    this.configManager.clearAll();
  }

  public static reset(): void {
    if (GameConfigLoader.instance) {
      GameConfigLoader.instance.clearAll();
      GameConfigLoader.instance = null;
    }
  }
}
