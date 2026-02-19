/**
 * LanguagePack - Language pack loader
 */

import { LocaleData } from './LocaleManager';
import { appendVersionToUrl } from '../../config/version.config';

export interface LanguagePack {
  locale: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  data: LocaleData;
}

export class LanguagePackLoader {
  public static async load(url: string): Promise<LanguagePack> {
    const response = await fetch(appendVersionToUrl(url));
    if (!response.ok) {
      throw new Error(`Failed to load language pack: ${url}`);
    }
    return response.json();
  }

  public static async loadMultiple(urls: string[]): Promise<LanguagePack[]> {
    return Promise.all(urls.map((url) => LanguagePackLoader.load(url)));
  }
}

export const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' as const },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' as const },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' as const },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' as const },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr' as const },
];

export default LanguagePackLoader;
