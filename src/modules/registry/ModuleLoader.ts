/**
 * ModuleLoader - Dynamic module loading
 */

import { ModuleRegistry, ModuleManifest } from './ModuleRegistry';
import { EventBus } from '../../platform/events/EventBus';

export interface GameModuleConfig {
  gameId: string;
  manifest: ModuleManifest;
}

export class ModuleLoader {
  private static instance: ModuleLoader | null = null;
  
  private moduleRegistry: ModuleRegistry;
  private eventBus: EventBus;
  private loadedGames: Map<string, GameModuleConfig> = new Map();

  private constructor() {
    this.moduleRegistry = ModuleRegistry.getInstance();
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): ModuleLoader {
    if (!ModuleLoader.instance) {
      ModuleLoader.instance = new ModuleLoader();
    }
    return ModuleLoader.instance;
  }

  /**
   * Load modules for a specific game
   */
  public async loadGame(config: GameModuleConfig): Promise<void> {
    console.log(`[ModuleLoader] Loading game: ${config.gameId}`);

    // Unload previous game if any
    if (this.loadedGames.size > 0) {
      await this.unloadCurrentGame();
    }

    // Initialize module registry
    this.moduleRegistry.initialize();

    // Load from manifest
    await this.moduleRegistry.loadFromManifest(config.manifest);

    this.loadedGames.set(config.gameId, config);

    this.eventBus.emit('engine:ready', { timestamp: Date.now() });
    console.log(`[ModuleLoader] Game loaded: ${config.gameId}`);
  }

  /**
   * Unload current game modules
   */
  public async unloadCurrentGame(): Promise<void> {
    await this.moduleRegistry.unloadAll();
    this.loadedGames.clear();
    console.log('[ModuleLoader] Current game unloaded');
  }

  /**
   * Get currently loaded game ID
   */
  public getCurrentGameId(): string | null {
    const games = Array.from(this.loadedGames.keys());
    return games[0] ?? null;
  }

  /**
   * Check if a game is loaded
   */
  public isGameLoaded(gameId: string): boolean {
    return this.loadedGames.has(gameId);
  }

  /**
   * Create manifest from game config
   */
  public createManifestFromConfig(gameConfig: {
    features?: { [key: string]: unknown };
    paylines?: { type: string };
  }): ModuleManifest {
    const manifest: ModuleManifest = {
      mechanics: ['standard'],
      features: [],
      winSystems: ['paylines'],
      spinStrategies: ['top_to_bottom'],
    };

    // Extract features
    if (gameConfig.features) {
      if (gameConfig.features.freeSpins) manifest.features.push('freespins');
      if (gameConfig.features.holdRespin) manifest.features.push('holdrespin');
    }

    // Determine win system
    if (gameConfig.paylines?.type === 'ways') {
      manifest.winSystems = ['ways'];
    } else if (gameConfig.paylines?.type === 'cluster') {
      manifest.winSystems = ['cluster'];
    }

    return manifest;
  }

  public static reset(): void {
    ModuleLoader.instance = null;
  }
}
