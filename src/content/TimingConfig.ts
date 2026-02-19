/**
 * TimingConfig - presentation timing registry (shared defaults + per-game overrides)
 *
 * High-level contract:
 * - Values are presentation policy only (ms)
 * - Timeline/mode (turbo/skip/cancel) compensates centrally
 * - Game configs may override within bounded limits
 */

export type TimingKey =
  | 'spin.reelStart'
  | 'spin.reelStop.stagger'
  | 'spin.reelStop.settle'
  | 'win.countUp'
  | 'win.paylineLoop.step'
  | 'win.paylineLoop.max'
  | 'feature.enter'
  | 'feature.exit'
  | 'cascade.winPresentation'
  | 'cascade.removal'
  | 'cascade.collapse'
  | 'cascade.refill'
  | 'cascade.interStepDelay'
  | 'turbo.speedMultiplier';

export type TimingMap = Partial<Record<TimingKey, number>>;

export interface TimingSpec {
  key: TimingKey;
  defaultMs: number;
  minMs: number;
  maxMs: number;
}

export const TIMING_SPECS: readonly TimingSpec[] = [
  { key: 'spin.reelStart', defaultMs: 0, minMs: 0, maxMs: 5_000 },
  { key: 'spin.reelStop.stagger', defaultMs: 80, minMs: 0, maxMs: 2_000 },
  { key: 'spin.reelStop.settle', defaultMs: 200, minMs: 0, maxMs: 5_000 },
  { key: 'win.countUp', defaultMs: 1_000, minMs: 0, maxMs: 30_000 },
  { key: 'win.paylineLoop.step', defaultMs: 1_200, minMs: 200, maxMs: 10_000 },
  { key: 'win.paylineLoop.max', defaultMs: 5_000, minMs: 500, maxMs: 30_000 },
  { key: 'feature.enter', defaultMs: 500, minMs: 0, maxMs: 30_000 },
  { key: 'feature.exit', defaultMs: 400, minMs: 0, maxMs: 30_000 },
  { key: 'cascade.winPresentation', defaultMs: 500, minMs: 0, maxMs: 5_000 },
  { key: 'cascade.removal', defaultMs: 350, minMs: 0, maxMs: 5_000 },
  { key: 'cascade.collapse', defaultMs: 400, minMs: 0, maxMs: 5_000 },
  { key: 'cascade.refill', defaultMs: 350, minMs: 0, maxMs: 5_000 },
  { key: 'cascade.interStepDelay', defaultMs: 200, minMs: 0, maxMs: 5_000 },
  // turbo.speedMultiplier is stored as-is (not a ms value; used as a divisor)
  { key: 'turbo.speedMultiplier', defaultMs: 2, minMs: 1, maxMs: 10 },
] as const;

const SPEC_BY_KEY: Readonly<Record<TimingKey, TimingSpec>> = TIMING_SPECS.reduce(
  (acc, spec) => {
    acc[spec.key] = spec;
    return acc;
  },
  {} as Record<TimingKey, TimingSpec>
);

export interface TimingValidationOptions {
  /**
   * If true, unknown keys throw; otherwise they are ignored.
   * Keep strict in dev, permissive in prod to fail-closed without breaking load.
   */
  strictUnknownKeys?: boolean;
}

export function getTimingDefaultMap(): Required<Record<TimingKey, number>> {
  const out = {} as Required<Record<TimingKey, number>>;
  for (const spec of TIMING_SPECS) out[spec.key] = spec.defaultMs;
  return out;
}

export function validateAndNormalizeTimings(
  input: unknown,
  opts: TimingValidationOptions = {}
): TimingMap {
  if (!input || typeof input !== 'object') return {};

  const strict = opts.strictUnknownKeys ?? false;
  const out: TimingMap = {};

  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = rawKey as TimingKey;
    const spec = SPEC_BY_KEY[key];

    if (!spec) {
      if (strict) {
        throw new Error(`[TimingConfig] Unknown timing key: ${rawKey}`);
      }
      continue;
    }

    if (typeof rawValue !== 'number' || Number.isNaN(rawValue) || !Number.isFinite(rawValue)) {
      // Ignore invalid values (fail-closed to default)
      continue;
    }

    const clamped = Math.min(Math.max(rawValue, spec.minMs), spec.maxMs);
    out[key] = clamped;
  }

  return out;
}

export function mergeTimings(base: TimingMap, override: TimingMap): TimingMap {
  return { ...base, ...override };
}
