/**
 * TimingProvider - read-only facade for resolved presentation timings.
 *
 * When turbo mode is active, getMs() divides the timing value by the
 * configured turbo.speedMultiplier (default 2×).
 * turbo.speedMultiplier itself is always returned raw (never divided).
 */

import type { TimingKey, TimingMap } from '@/content/TimingConfig';
import { TurboState } from './TurboState';

export interface TimingProvider {
  getMs(key: TimingKey): number;
  getOptionalMs(key: TimingKey): number | undefined;
  getAll(): TimingMap;
}

/** Keys that must NOT be divided by the turbo multiplier */
const RAW_KEYS: ReadonlySet<TimingKey> = new Set<TimingKey>([
  'turbo.speedMultiplier',
]);

export class StaticTimingProvider implements TimingProvider {
  constructor(private readonly timings: TimingMap) {
    // Seed TurboState with the configured multiplier
    const mult = timings['turbo.speedMultiplier'];
    if (typeof mult === 'number') {
      TurboState.getInstance().setSpeedMultiplier(mult);
    }
  }

  public getMs(key: TimingKey): number {
    const v = this.timings[key];
    if (typeof v !== 'number') {
      throw new Error(`[TimingProvider] Missing timing key: ${key}`);
    }
    if (RAW_KEYS.has(key)) return v;
    return Math.max(0, Math.round(v / TurboState.getInstance().divisor()));
  }

  public getOptionalMs(key: TimingKey): number | undefined {
    const v = this.timings[key];
    if (typeof v !== 'number') return undefined;
    if (RAW_KEYS.has(key)) return v;
    return Math.max(0, Math.round(v / TurboState.getInstance().divisor()));
  }

  public getAll(): TimingMap {
    return { ...this.timings };
  }
}
