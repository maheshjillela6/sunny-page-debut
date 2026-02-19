/**
 * CascadeConfigResolver - Merges base config with mode/speed overrides.
 *
 * Given a CascadeConfig, resolves the effective CascadeModeConfig for
 * the current game mode and speed setting.
 */

import type {
  CascadeConfig,
  CascadeModeConfig,
  CascadeSpeedVariant,
  WinPresentationPhaseConfig,
  RemovalPhaseConfig,
  CollapsePhaseConfig,
  RefillPhaseConfig,
  CascadePhaseTimingConfig,
  CascadeAnimationConfig,
  SymbolCascadeOverride,
  RemovalStyle,
  CollapseStyle,
  RefillStyle,
  WinPresentationStyle,
} from './CascadeConfigTypes';

export type CascadeGameMode = 'baseGame' | 'freeSpins' | 'holdRespin' | 'bonus';
export type CascadeSpeed = 'normal' | 'turbo' | 'instant';

export interface ResolvedCascadeConfig {
  winPresentation: WinPresentationPhaseConfig;
  removal: RemovalPhaseConfig;
  collapse: CollapsePhaseConfig;
  refill: RefillPhaseConfig;
  timing: CascadePhaseTimingConfig;
  symbolOverrides: SymbolCascadeOverride[];
}

/**
 * Deep-merge a partial mode config over the base mode config.
 */
function mergeModeConfig(
  base: CascadeModeConfig,
  override?: Partial<CascadeModeConfig>
): CascadeModeConfig {
  if (!override) return base;

  return {
    winPresentation: mergePhase(base.winPresentation, override.winPresentation),
    removal: mergePhase(base.removal, override.removal),
    collapse: mergePhase(base.collapse, override.collapse),
    refill: mergePhase(base.refill, override.refill),
    timing: { ...base.timing, ...override.timing },
    symbolOverrides: override.symbolOverrides ?? base.symbolOverrides,
    layerOverrides: override.layerOverrides ?? base.layerOverrides,
  };
}

function mergePhase<T extends object>(base: T, override?: Partial<T>): T {
  if (!override) return base;
  // Shallow merge for phase, deep merge animation sub-object
  const merged = { ...base, ...override } as any;
  if ((base as any).animation && (override as any).animation) {
    merged.animation = { ...(base as any).animation, ...(override as any).animation };
  }
  return merged;
}

/**
 * Apply speed variant to all phase durations.
 */
function applySpeedVariant(
  config: CascadeModeConfig,
  variant?: CascadeSpeedVariant
): CascadeModeConfig {
  if (!variant) return config;

  const mul = variant.durationMultiplier;
  const minMs = variant.minPhaseDurationMs ?? 0;

  const scaleAnim = (anim: CascadeAnimationConfig): CascadeAnimationConfig => ({
    ...anim,
    durationMs: Math.max(Math.round(anim.durationMs * mul), minMs),
    delayMs: anim.delayMs ? Math.round(anim.delayMs * mul) : undefined,
  });

  const result: CascadeModeConfig = {
    ...config,
    winPresentation: {
      ...config.winPresentation,
      animation: scaleAnim(config.winPresentation.animation),
      staggerMs: variant.skipStagger ? 0 : config.winPresentation.staggerMs
        ? Math.round(config.winPresentation.staggerMs * mul) : undefined,
    },
    removal: {
      ...config.removal,
      animation: scaleAnim(config.removal.animation),
      staggerMs: variant.skipStagger ? 0 : config.removal.staggerMs
        ? Math.round(config.removal.staggerMs * mul) : undefined,
      particles: variant.skipParticles
        ? { ...config.removal.particles, enabled: false } as any
        : config.removal.particles,
    },
    collapse: {
      ...config.collapse,
      animation: scaleAnim(config.collapse.animation),
      columnStaggerMs: variant.skipStagger ? 0 : config.collapse.columnStaggerMs
        ? Math.round(config.collapse.columnStaggerMs * mul) : undefined,
    },
    refill: {
      ...config.refill,
      animation: scaleAnim(config.refill.animation),
      staggerMs: variant.skipStagger ? 0 : config.refill.staggerMs
        ? Math.round(config.refill.staggerMs * mul) : undefined,
    },
    timing: {
      ...config.timing,
      phaseOrdering: variant.forceParallelPhases ? 'parallel' : config.timing.phaseOrdering,
      overlapOffsetMs: config.timing.overlapOffsetMs
        ? Math.round(config.timing.overlapOffsetMs * mul) : undefined,
      interStepDelayMs: config.timing.interStepDelayMs
        ? Math.round(config.timing.interStepDelayMs * mul) : undefined,
    },
  };

  if (variant.skipWinPresentation) {
    result.winPresentation = {
      ...result.winPresentation,
      style: 'none' as WinPresentationStyle,
      animation: { ...result.winPresentation.animation, durationMs: 0, driver: 'none' },
    };
  }

  return result;
}

/**
 * Resolve the effective cascade config for a given mode + speed.
 */
export function resolveCascadeConfig(
  config: CascadeConfig,
  mode: CascadeGameMode,
  speed: CascadeSpeed
): ResolvedCascadeConfig {
  // 1. Start with base game config
  let effective = config.baseGame;

  // 2. Merge mode override
  const modeOverride = mode === 'freeSpins' ? config.freeSpins
    : mode === 'holdRespin' ? config.holdRespin
    : mode === 'bonus' ? config.bonus
    : undefined;
  effective = mergeModeConfig(effective, modeOverride);

  // 3. Apply speed variant
  const speedVariant = speed === 'turbo' ? config.turbo
    : speed === 'instant' ? config.instant
    : config.normal;
  effective = applySpeedVariant(effective, speedVariant);

  return {
    winPresentation: effective.winPresentation,
    removal: effective.removal,
    collapse: effective.collapse,
    refill: effective.refill,
    timing: effective.timing,
    symbolOverrides: effective.symbolOverrides ?? [],
  };
}

/**
 * Find symbol-specific override for a given phase.
 */
export function getSymbolOverride(
  overrides: SymbolCascadeOverride[],
  symbolId: string
): SymbolCascadeOverride | undefined {
  return overrides.find(o => o.symbolId === symbolId);
}
