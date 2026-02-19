/**
 * SymbolRendererFactory - Creates symbol composition renderers from config.
 *
 * Resolution order (highest priority wins):
 *   1. Per-game  symbol-rendering.json  (game-specific overrides)
 *   2. Shared    symbol-rendering.defaults.json  (shared defaults)
 *   3. Programmatic config via setRenderingConfig()
 *
 * Games only need to define what they override; everything else falls through
 * to the shared defaults automatically.
 */

import type {
  GameSymbolRenderingConfig,
  SymbolCompositionConfig,
  SymbolLayerConfig,
} from '../config/SymbolCompositionTypes';
import { SymbolCompositionRenderer } from './SymbolCompositionRenderer';
import { ConfigManager } from '../../../../content/ConfigManager';

export class SymbolRendererFactory {
  private static instance: SymbolRendererFactory | null = null;

  /** Merged config (shared defaults + game overrides) */
  private renderingConfig: GameSymbolRenderingConfig | null = null;

  /** Raw shared defaults (kept separate for re-merge on game switch) */
  private sharedDefaults: GameSymbolRenderingConfig | null = null;

  private configManager: ConfigManager;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): SymbolRendererFactory {
    if (!SymbolRendererFactory.instance) {
      SymbolRendererFactory.instance = new SymbolRendererFactory();
    }
    return SymbolRendererFactory.instance;
  }

  public static reset(): void {
    SymbolRendererFactory.instance = null;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Programmatically register a full rendering config (bypasses file loading).
   */
  public setRenderingConfig(config: GameSymbolRenderingConfig): void {
    this.renderingConfig = config;
  }

  /**
   * Load symbol rendering config for a game.
   *
   * 1. Loads shared/symbol-rendering.defaults.json (cached after first load).
   * 2. Loads games/<gameId>/symbol-rendering.json (game overrides).
   * 3. Deep-merges game over shared so games only declare deltas.
   * 4. Falls back to checking in-memory gameConfig.symbolRendering.
   */
  public async loadForGame(gameId: string): Promise<void> {
    // 1. Load shared defaults once
    if (!this.sharedDefaults) {
      try {
        this.sharedDefaults = await this.fetchJson<GameSymbolRenderingConfig>(
          '/game-configs/shared/symbol-rendering.defaults.json',
        );
        console.log('[SymbolRendererFactory] Loaded shared symbol-rendering defaults');
      } catch {
        console.warn('[SymbolRendererFactory] No shared symbol-rendering defaults found, using empty');
        this.sharedDefaults = { symbols: {} };
      }
    }

    // 2. Try per-game config
    let gameOverrides: Partial<GameSymbolRenderingConfig> | null = null;
    try {
      gameOverrides = await this.fetchJson<GameSymbolRenderingConfig>(
        `/game-configs/games/${gameId}/symbol-rendering.json`,
      );
      console.log(`[SymbolRendererFactory] Loaded symbol-rendering for game: ${gameId}`);
    } catch {
      console.log(`[SymbolRendererFactory] No symbol-rendering.json for ${gameId}, using defaults`);
    }

    // 3. Fallback: check in-memory game config
    if (!gameOverrides) {
      const gameConfig = this.configManager.getGameConfig(gameId) as any;
      if (gameConfig?.symbolRendering) {
        gameOverrides = gameConfig.symbolRendering;
      }
    }

    // 4. Merge: shared defaults ← game overrides
    this.renderingConfig = this.mergeConfigs(this.sharedDefaults!, gameOverrides);
  }

  /**
   * Synchronous legacy loader (reads from already-loaded ConfigManager data).
   * Prefer loadForGame() for full file-based resolution.
   */
  public loadFromGameConfig(gameId: string): void {
    const gameConfig = this.configManager.getGameConfig(gameId) as any;
    if (gameConfig?.symbolRendering) {
      if (this.sharedDefaults) {
        this.renderingConfig = this.mergeConfigs(this.sharedDefaults, gameConfig.symbolRendering);
      } else {
        this.renderingConfig = gameConfig.symbolRendering;
      }
    }
  }

  /**
   * Create a composition renderer for a specific symbol.
   */
  public createRenderer(symbolId: string, symbolSize: number): SymbolCompositionRenderer | null {
    const composition = this.resolveComposition(symbolId, symbolSize);
    if (!composition) return null;
    return new SymbolCompositionRenderer(composition, symbolSize);
  }

  /**
   * Resolve the composition config for a symbol.
   * Priority: explicit symbol config → defaultComposition template → null.
   */
  public resolveComposition(symbolId: string, symbolSize: number): SymbolCompositionConfig | null {
    if (!this.renderingConfig) return null;

    // Check explicit symbol config
    const explicit = this.renderingConfig.symbols[symbolId];
    if (explicit) return explicit;

    // Fall back to default composition template
    const defaults = this.renderingConfig.defaultComposition;
    if (!defaults) return null;

    return this.buildFromDefault(symbolId, defaults, symbolSize);
  }

  public hasConfig(): boolean {
    return this.renderingConfig !== null;
  }

  public hasSymbolConfig(symbolId: string): boolean {
    return !!this.renderingConfig?.symbols[symbolId];
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Deep-merge game overrides on top of shared defaults.
   *
   * - defaultComposition: game wins if present, else shared.
   * - symbols: game entries override shared entries by symbolId.
   *            Shared symbols not overridden are preserved.
   */
  private mergeConfigs(
    shared: GameSymbolRenderingConfig,
    overrides: Partial<GameSymbolRenderingConfig> | null,
  ): GameSymbolRenderingConfig {
    if (!overrides) return { ...shared };

    const mergedSymbols: Record<string, SymbolCompositionConfig> = {
      ...(shared.symbols ?? {}),
      ...(overrides.symbols ?? {}),
    };

    return {
      defaultComposition: overrides.defaultComposition ?? shared.defaultComposition,
      symbols: mergedSymbols,
    };
  }

  /**
   * Build a symbol composition from the default template.
   * Replaces {symbolId} tokens in asset/frame keys.
   */
  private buildFromDefault(
    symbolId: string,
    template: Partial<SymbolCompositionConfig>,
    symbolSize: number,
  ): SymbolCompositionConfig {
    const layers: SymbolLayerConfig[] = (template.layers ?? []).map((layer) => ({
      ...layer,
      assetKey: layer.assetKey?.replace('{symbolId}', symbolId),
      frameName: layer.frameName?.replace('{symbolId}', symbolId),
      states: { ...layer.states },
    }));

    return {
      symbolId,
      width: template.width ?? symbolSize,
      height: template.height ?? symbolSize,
      layers,
      highlight: template.highlight,
    };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: 'no-cache', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
    return res.json() as Promise<T>;
  }
}
