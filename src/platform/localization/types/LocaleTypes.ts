/**
 * LocaleTypes - Shared type definitions for the localization system
 */

/** Valid namespace prefixes for translation keys */
export type LocaleNamespace = 'game' | 'feature' | 'win' | 'ui' | 'lobby' | 'hud' | 'error' | 'custom';

/** Flat string dictionary */
export type StringDictionary = Record<string, string>;

/** Shape of the LOCALIZATION section in global config */
export interface LocaleConfig {
  DEFAULT_LOCALE: string;
  FALLBACK_LOCALE: string;
  SUPPORTED_LOCALES: string[];
  NAMESPACES: LocaleNamespace[];
  STRING_FILES_PATTERN: string;
  GAME_I18N_DIR: string;
}

/** Supported locale metadata */
export interface SupportedLocale {
  code: string;
  name: string;        // English name
  nativeName: string;  // Native name (e.g. "Español")
  direction: 'ltr' | 'rtl';
}

/** Per-game i18n manifest section */
export interface GameLocaleManifest {
  dir: string;
  overrides: boolean;
  customNamespaces?: string[];
}

/** All supported locales with metadata */
export const LOCALE_METADATA: SupportedLocale[] = [
  { code: 'en',    name: 'English',             nativeName: 'English',    direction: 'ltr' },
  { code: 'de',    name: 'German',              nativeName: 'Deutsch',    direction: 'ltr' },
  { code: 'ru',    name: 'Russian',             nativeName: 'Русский',    direction: 'ltr' },
  { code: 'es',    name: 'Spanish',             nativeName: 'Español',    direction: 'ltr' },
  { code: 'hi',    name: 'Hindi',               nativeName: 'हिन्दी',      direction: 'ltr' },
  { code: 'zh',    name: 'Chinese Simplified',  nativeName: '中文(简体)',  direction: 'ltr' },
  { code: 'zh-TW', name: 'Chinese Traditional', nativeName: '中文(繁體)',  direction: 'ltr' },
  { code: 'ar',    name: 'Arabic',              nativeName: 'العربية',    direction: 'rtl' },
];
