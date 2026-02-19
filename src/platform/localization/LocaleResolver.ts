/**
 * LocaleResolver - 3-tier string resolution engine
 * 
 * Resolution hierarchy (highest priority wins):
 *   1. Game-specific strings  (per-game override/extension)
 *   2. Shared global strings  (platform-wide defaults)
 *   3. Fallback locale (en)   (safety net)
 */

import type { StringDictionary } from './types/LocaleTypes';

type CacheKey = string; // "global:{locale}" or "{gameId}:{locale}"

export class LocaleResolver {
  private static instance: LocaleResolver | null = null;

  private globalStrings: Map<string, StringDictionary> = new Map();
  private gameStrings: Map<string, Map<string, StringDictionary>> = new Map(); // gameId -> locale -> dict
  private mergedCache: Map<CacheKey, StringDictionary> = new Map();
  private fallbackLocale: string = 'en';

  private constructor() {}

  public static getInstance(): LocaleResolver {
    if (!LocaleResolver.instance) {
      LocaleResolver.instance = new LocaleResolver();
    }
    return LocaleResolver.instance;
  }

  public setFallbackLocale(locale: string): void {
    this.fallbackLocale = locale;
  }

  /** Load global strings for a locale */
  public loadGlobalStrings(locale: string, data: StringDictionary): void {
    this.globalStrings.set(locale, data);
    this.invalidateCache(locale);
  }

  /** Load game-specific strings for a locale */
  public loadGameStrings(gameId: string, locale: string, data: StringDictionary): void {
    if (!this.gameStrings.has(gameId)) {
      this.gameStrings.set(gameId, new Map());
    }
    this.gameStrings.get(gameId)!.set(locale, data);
    this.invalidateCache(locale, gameId);
  }

  /** Check if game strings are loaded */
  public hasGameStrings(gameId: string): boolean {
    return this.gameStrings.has(gameId);
  }

  /** Clear game-specific strings (when leaving a game) */
  public clearGameStrings(gameId?: string): void {
    if (gameId) {
      this.gameStrings.delete(gameId);
    }
    // Invalidate all game-related cache entries
    for (const key of this.mergedCache.keys()) {
      if (!key.startsWith('global:')) {
        this.mergedCache.delete(key);
      }
    }
  }

  /**
   * Resolve a single key through the 3-tier hierarchy
   */
  public resolve(key: string, locale: string, gameId?: string): string {
    // Tier 3: Game-specific override
    if (gameId) {
      const gameData = this.gameStrings.get(gameId)?.get(locale);
      if (gameData && key in gameData) return gameData[key];
    }

    // Tier 2: Global strings for requested locale
    const globalData = this.globalStrings.get(locale);
    if (globalData && key in globalData) return globalData[key];

    // Tier 1: Fallback locale
    if (locale !== this.fallbackLocale) {
      // Check game fallback
      if (gameId) {
        const gameFallback = this.gameStrings.get(gameId)?.get(this.fallbackLocale);
        if (gameFallback && key in gameFallback) return gameFallback[key];
      }

      const fallbackData = this.globalStrings.get(this.fallbackLocale);
      if (fallbackData && key in fallbackData) return fallbackData[key];
    }

    // Key not found anywhere
    console.warn(`[LocaleResolver] Missing translation: ${key} (locale: ${locale}, game: ${gameId ?? 'none'})`);
    return key;
  }

  /**
   * Get fully merged dictionary for a locale+game combo (cached)
   */
  public resolveAll(locale: string, gameId?: string): StringDictionary {
    const cacheKey = gameId ? `${gameId}:${locale}` : `global:${locale}`;

    if (this.mergedCache.has(cacheKey)) {
      return this.mergedCache.get(cacheKey)!;
    }

    // Build merged dict: fallback global -> current global -> fallback game -> current game
    const merged: StringDictionary = {};

    // Layer 1: Fallback global
    if (locale !== this.fallbackLocale) {
      const fallbackGlobal = this.globalStrings.get(this.fallbackLocale);
      if (fallbackGlobal) Object.assign(merged, fallbackGlobal);
    }

    // Layer 2: Current locale global
    const currentGlobal = this.globalStrings.get(locale);
    if (currentGlobal) Object.assign(merged, currentGlobal);

    if (gameId) {
      // Layer 3: Fallback game strings
      if (locale !== this.fallbackLocale) {
        const fallbackGame = this.gameStrings.get(gameId)?.get(this.fallbackLocale);
        if (fallbackGame) Object.assign(merged, fallbackGame);
      }

      // Layer 4: Current locale game strings
      const currentGame = this.gameStrings.get(gameId)?.get(locale);
      if (currentGame) Object.assign(merged, currentGame);
    }

    this.mergedCache.set(cacheKey, merged);
    return merged;
  }

  private invalidateCache(locale: string, gameId?: string): void {
    if (gameId) {
      this.mergedCache.delete(`${gameId}:${locale}`);
    } else {
      // Global strings changed — invalidate all cache entries for this locale
      for (const key of this.mergedCache.keys()) {
        if (key.endsWith(`:${locale}`)) {
          this.mergedCache.delete(key);
        }
      }
    }
  }

  public reset(): void {
    this.globalStrings.clear();
    this.gameStrings.clear();
    this.mergedCache.clear();
  }
}

export default LocaleResolver;
