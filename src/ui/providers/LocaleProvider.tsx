/**
 * LocaleProvider - React context for the localization system
 * Provides useLocale() hook with t(), setLocale(), setGameContext(), etc.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { LocaleResolver } from '@/platform/localization/LocaleResolver';
import { LOCALE_METADATA, type SupportedLocale, type StringDictionary } from '@/platform/localization/types/LocaleTypes';

const STORAGE_KEY = 'slotengine_locale';
const SUPPORTED_CODES = LOCALE_METADATA.map(l => l.code);

interface LocaleContextValue {
  locale: string;
  direction: 'ltr' | 'rtl';
  availableLocales: SupportedLocale[];
  setLocale: (code: string) => void;
  setGameContext: (gameId: string | null) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatNumber: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
  isLoaded: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Detect initial locale from storage or browser */
function detectInitialLocale(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_CODES.includes(stored)) return stored;
  } catch {}

  const browserLang = navigator.language?.split('-')[0];
  if (browserLang && SUPPORTED_CODES.includes(browserLang)) return browserLang;

  return 'en';
}

/** Dynamically import a global string file */
async function loadGlobalStringFile(locale: string): Promise<StringDictionary> {
  const modules: Record<string, () => Promise<{ default: StringDictionary }>> = {
    en:    () => import('@/platform/localization/strings.en.json'),
    de:    () => import('@/platform/localization/strings.de.json'),
    ru:    () => import('@/platform/localization/strings.ru.json'),
    es:    () => import('@/platform/localization/strings.es.json'),
    hi:    () => import('@/platform/localization/strings.hi.json'),
    zh:    () => import('@/platform/localization/strings.zh.json'),
    'zh-TW': () => import('@/platform/localization/strings.zh-TW.json'),
    ar:    () => import('@/platform/localization/strings.ar.json'),
  };

  try {
    const mod = await modules[locale]?.();
    return mod?.default ?? {};
  } catch (e) {
    console.warn(`[LocaleProvider] Failed to load global strings for ${locale}`, e);
    return {};
  }
}

/** Load game-specific override strings via fetch */
async function loadGameStringFile(gameId: string, locale: string): Promise<StringDictionary> {
  try {
    const url = `/game-configs/games/${gameId}/i18n/strings.${locale}.json`;
    const res = await fetch(url);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState(detectInitialLocale);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [, forceUpdate] = useState(0); // trigger re-render after game strings load

  const resolver = useMemo(() => LocaleResolver.getInstance(), []);

  // Load all global strings on mount
  useEffect(() => {
    const loadAll = async () => {
      await Promise.all(
        SUPPORTED_CODES.map(async (code) => {
          const data = await loadGlobalStringFile(code);
          resolver.loadGlobalStrings(code, data);
        })
      );
      setIsLoaded(true);
    };
    loadAll();
  }, [resolver]);

  // Load game-specific strings when game context changes
  useEffect(() => {
    if (!gameId) return;
    if (resolver.hasGameStrings(gameId)) {
      forceUpdate(n => n + 1);
      return;
    }

    const loadGameStrings = async () => {
      await Promise.all(
        SUPPORTED_CODES.map(async (code) => {
          const data = await loadGameStringFile(gameId, code);
          if (Object.keys(data).length > 0) {
            resolver.loadGameStrings(gameId, code, data);
          }
        })
      );
      forceUpdate(n => n + 1);
    };
    loadGameStrings();
  }, [gameId, resolver]);

  // Set RTL direction
  useEffect(() => {
    const meta = LOCALE_METADATA.find(l => l.code === locale);
    const dir = meta?.direction ?? 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((code: string) => {
    if (!SUPPORTED_CODES.includes(code)) {
      console.warn(`[LocaleProvider] Unsupported locale: ${code}`);
      return;
    }
    setLocaleState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  }, []);

  const setGameContext = useCallback((id: string | null) => {
    setGameId(id);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = resolver.resolve(key, locale, gameId ?? undefined);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      }
    }
    return text;
  }, [locale, gameId, resolver]);

  const formatNumber = useCallback((value: number, opts?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(locale, opts).format(value);
  }, [locale]);

  const formatCurrency = useCallback((value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }, [locale]);

  const direction = LOCALE_METADATA.find(l => l.code === locale)?.direction ?? 'ltr';

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    direction,
    availableLocales: LOCALE_METADATA,
    setLocale,
    setGameContext,
    t,
    formatNumber,
    formatCurrency,
    isLoaded,
  }), [locale, direction, setLocale, setGameContext, t, formatNumber, formatCurrency, isLoaded]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
};

/** Hook to access localization */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return ctx;
}

export default LocaleProvider;
