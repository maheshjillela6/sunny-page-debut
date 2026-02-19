/**
 * Version Config - Handles version tracking and cache-busting for deployments.
 *
 * On each deployment a new public/version.json is stamped.
 * At runtime we compare the remote version against what localStorage has seen.
 * If they differ we bump the stored copy so that every subsequent fetch
 * includes a fresh cache-buster query string.
 *
 * Usage:
 *   import { checkForUpdate, versionCacheBuster } from '@/config/version.config';
 *
 *   // During bootstrap
 *   await checkForUpdate();
 *
 *   // When fetching any runtime resource
 *   fetch(`/some/path.json${versionCacheBuster()}`);
 */

const LS_KEY = 'app_version';
const VERSION_URL = '/version.json';

export interface VersionInfo {
  version: string;
  buildNumber: number;
  buildTime?: string;
}

let currentVersion: VersionInfo = { version: '0.0.0', buildNumber: 0 };

/**
 * Fetch the remote version.json and compare with localStorage.
 * Returns true if a new version was detected (i.e. cache should be busted).
 */
export async function checkForUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`${VERSION_URL}?_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const remote: VersionInfo = await res.json();

    const stored = localStorage.getItem(LS_KEY);
    const stamp = `${remote.version}-${remote.buildNumber}`;

    currentVersion = remote;

    if (stored !== stamp) {
      localStorage.setItem(LS_KEY, stamp);
      console.log(`[VersionConfig] New version detected: ${stamp} (was ${stored ?? 'none'})`);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[VersionConfig] Could not check for update:', e);
    return false;
  }
}

/**
 * Returns a query-string fragment like `?v=1.0.0-1` (or `&v=...` if the URL
 * already contains a `?`). Append this to any runtime fetch URL.
 */
export function versionCacheBuster(): string {
  const stamp = localStorage.getItem(LS_KEY) ?? `${currentVersion.version}-${currentVersion.buildNumber}`;
  return `?v=${stamp}`;
}

/**
 * Helper that appends the cache-buster to an existing URL,
 * correctly handling URLs that already have query parameters.
 */
export function appendVersionToUrl(url: string): string {
  const stamp = localStorage.getItem(LS_KEY) ?? `${currentVersion.version}-${currentVersion.buildNumber}`;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${stamp}`;
}

export function getCurrentVersion(): VersionInfo {
  return { ...currentVersion };
}
