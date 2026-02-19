/**
 * LocaleManager - Manages localization
 */

import { EventBus } from '../events/EventBus';

export type LocaleKey = string;
export type LocaleData = Record<string, string>;

/** Game override layer - stored separately from base locales */
type GameOverrideKey = string; // "gameId:locale"

export class LocaleManager {
  private static instance: LocaleManager | null = null;

  private currentLocale: string = 'en';
  private fallbackLocale: string = 'en';
  private locales: Map<string, LocaleData> = new Map();
  private gameOverrides: Map<GameOverrideKey, LocaleData> = new Map();
  private activeGameId: string | null = null;
  private eventBus: EventBus;

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): LocaleManager {
    if (!LocaleManager.instance) {
      LocaleManager.instance = new LocaleManager();
    }
    return LocaleManager.instance;
  }

  public async loadLocale(locale: string, data: LocaleData): Promise<void> {
    this.locales.set(locale, data);
  }

  public setLocale(locale: string): void {
    if (!this.locales.has(locale)) {
      console.warn(`[LocaleManager] Locale not loaded: ${locale}`);
      return;
    }
    this.currentLocale = locale;
  }

  public getLocale(): string {
    return this.currentLocale;
  }

  public getAvailableLocales(): string[] {
    return Array.from(this.locales.keys());
  }

  public t(key: string, params?: Record<string, string | number>): string {
    let text = this.getString(key);

    if (params) {
      for (const [paramKey, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
      }
    }

    return text;
  }

  /** Load merged global + game data for a locale */
  public loadMerged(locale: string, globalData: LocaleData, gameData?: LocaleData): void {
    this.locales.set(locale, globalData);
    if (gameData) {
      this.setGameOverrides(locale, gameData);
    }
  }

  /** Set game-specific overrides that layer on top of global strings */
  public setGameOverrides(locale: string, gameData: LocaleData, gameId?: string): void {
    const key = `${gameId ?? 'active'}:${locale}`;
    this.gameOverrides.set(key, gameData);
    if (gameId) this.activeGameId = gameId;
  }

  /** Clear all game overrides (when returning to lobby) */
  public clearGameOverrides(): void {
    this.gameOverrides.clear();
    this.activeGameId = null;
  }

  private getString(key: string): string {
    // Check game overrides first
    if (this.activeGameId) {
      const gameKey = `${this.activeGameId}:${this.currentLocale}`;
      const gameData = this.gameOverrides.get(gameKey);
      if (gameData && key in gameData) return gameData[key];
    }

    // Check active (non-game-specific) overrides
    const activeKey = `active:${this.currentLocale}`;
    const activeData = this.gameOverrides.get(activeKey);
    if (activeData && key in activeData) return activeData[key];

    // Check current locale
    const currentData = this.locales.get(this.currentLocale);
    if (currentData && key in currentData) {
      return currentData[key];
    }

    // Check fallback locale
    const fallbackData = this.locales.get(this.fallbackLocale);
    if (fallbackData && key in fallbackData) {
      return fallbackData[key];
    }

    console.warn(`[LocaleManager] Missing translation: ${key}`);
    return key;
  }

  public formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.currentLocale, options).format(value);
  }

  public formatCurrency(value: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(this.currentLocale, {
      style: 'currency',
      currency,
    }).format(value);
  }

  public formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.currentLocale, options).format(date);
  }
}

export default LocaleManager;
