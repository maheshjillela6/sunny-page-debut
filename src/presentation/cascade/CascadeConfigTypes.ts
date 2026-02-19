/**
 * CascadeConfigTypes - Fully config-driven cascade/avalanche presentation system.
 *
 * Every visual phase of a cascade sequence is described through these types.
 * No hardcoded rendering logic in the presenter; all behavior is resolved
 * from the game config JSON.
 *
 * Cascade sequence: grid → win → remove → collapse → refill → (repeat or end)
 */

import type { TweenType } from '../../runtime/animation/TweenTypes';

// ── Animation driver selection ─────────────────────────────────────────────

export type CascadeAnimationDriver = 'tween' | 'spine' | 'spriteSwap' | 'none';

// ── Easing presets ─────────────────────────────────────────────────────────

export type CascadeEasing =
  | 'linear'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeOutBack' | 'easeOutBounce' | 'easeOutElastic'
  | 'easeInBack' | 'easeInBounce'
  | string; // GSAP-compatible easing string

// ── Removal styles ─────────────────────────────────────────────────────────

export type RemovalStyle =
  | 'fade'
  | 'explode'
  | 'dissolve'
  | 'shrink'
  | 'shatter'
  | 'instant'
  | 'pop'
  | 'burn'
  | 'custom';

// ── Collapse / movement styles ─────────────────────────────────────────────

export type CollapseStyle =
  | 'gravity'
  | 'slide'
  | 'morph'
  | 'teleport'
  | 'instant'
  | 'spring'
  | 'custom';

// ── Refill / entry styles ──────────────────────────────────────────────────

export type RefillStyle =
  | 'dropFromTop'
  | 'scaleIn'
  | 'transformInPlace'
  | 'flyIn'
  | 'instant'
  | 'fadeIn'
  | 'bounce'
  | 'spiral'
  | 'custom';

// ── Win presentation styles ────────────────────────────────────────────────

export type WinPresentationStyle =
  | 'highlight'
  | 'pulse'
  | 'glow'
  | 'shake'
  | 'zoom'
  | 'flash'
  | 'outline'
  | 'none';

// ── Ordering / sequencing ──────────────────────────────────────────────────

export type PhaseOrdering =
  | 'sequential'      // one phase after another
  | 'overlapped'      // phases overlap with configurable offset
  | 'parallel';       // phases run simultaneously

export type ElementOrdering =
  | 'all_at_once'     // all symbols animate together
  | 'per_column'      // column by column (left to right)
  | 'per_row'         // row by row (top to bottom)
  | 'random'          // random order
  | 'per_symbol'      // one symbol at a time
  | 'reverse_column'  // column by column (right to left)
  | 'spiral'          // spiral from center outward
  | 'custom';

// ── Animation descriptor ──────────────────────────────────────────────────

export interface CascadeAnimationConfig {
  driver: CascadeAnimationDriver;
  /** TweenFactory preset (when driver = 'tween') */
  tweenType?: TweenType;
  /** Spine skeleton + animation (when driver = 'spine') */
  spineKey?: string;
  spineAnimation?: string;
  spineLoop?: boolean;
  /** Sprite swap frames (when driver = 'spriteSwap') */
  spriteFrames?: string[];
  spriteFrameRate?: number;
  /** Duration in ms */
  durationMs: number;
  /** Delay before animation starts (ms) */
  delayMs?: number;
  /** Easing curve */
  easing?: CascadeEasing;
  /** Scale multiplier */
  scale?: number;
  /** Intensity / strength for effects */
  intensity?: number;
  /** Color override (hex) */
  color?: string;
  /** Direction for directional animations */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Distance in pixels for movement */
  distance?: number;
  /** Bounce parameters */
  bounce?: {
    strength: number;
    count: number;
  };
}

// ── Phase configs ──────────────────────────────────────────────────────────

/** How winning symbols are visually presented before removal */
export interface WinPresentationPhaseConfig {
  style: WinPresentationStyle;
  animation: CascadeAnimationConfig;
  /** Per-symbol stagger delay (ms) */
  staggerMs?: number;
  /** Ordering of symbol animations */
  ordering?: ElementOrdering;
  /** Whether to dim non-winning symbols */
  dimNonWinning?: boolean;
  dimAlpha?: number;
  /** Audio cue */
  soundId?: string;
}

/** How winning symbols are removed from the grid */
export interface RemovalPhaseConfig {
  style: RemovalStyle;
  animation: CascadeAnimationConfig;
  /** Stagger delay between symbol removals */
  staggerMs?: number;
  /** Ordering of removals */
  ordering?: ElementOrdering;
  /** Particle effect on removal */
  particles?: {
    enabled: boolean;
    type: string;
    count: number;
    color?: string;
    durationMs?: number;
  };
  /** Audio cue */
  soundId?: string;
}

/** How remaining symbols move to fill gaps */
export interface CollapsePhaseConfig {
  style: CollapseStyle;
  animation: CascadeAnimationConfig;
  /** Stagger per column (ms) */
  columnStaggerMs?: number;
  /** Stagger per row (ms) */
  rowStaggerMs?: number;
  /** Physics parameters for gravity/spring styles */
  physics?: {
    gravity?: number;
    maxVelocity?: number;
    bounceCoefficient?: number;
    friction?: number;
    springStiffness?: number;
    springDamping?: number;
  };
  /** Audio cue */
  soundId?: string;
}

/** How new symbols enter the grid */
export interface RefillPhaseConfig {
  style: RefillStyle;
  animation: CascadeAnimationConfig;
  /** Stagger delay between new symbols */
  staggerMs?: number;
  /** Ordering of refill animations */
  ordering?: ElementOrdering;
  /** Starting offset for drop/fly entries */
  entryOffset?: { x?: number; y?: number };
  /** Audio cue */
  soundId?: string;
}

// ── Phase timing / overlap ─────────────────────────────────────────────────

export interface CascadePhaseTimingConfig {
  /** How phases relate to each other */
  phaseOrdering: PhaseOrdering;
  /** Overlap offset in ms (when phaseOrdering = 'overlapped') */
  overlapOffsetMs?: number;
  /** Pause between cascade steps (ms) */
  interStepDelayMs?: number;
  /** Maximum cascade depth before forcing complete */
  maxCascadeDepth?: number;
  /** Multiplier ramp: increase multiplier per cascade step */
  multiplierPerStep?: number;
}

// ── Per-symbol / per-layer overrides ───────────────────────────────────────

export interface SymbolCascadeOverride {
  symbolId: string;
  /** Override any phase config for this symbol */
  removal?: Partial<RemovalPhaseConfig>;
  winPresentation?: Partial<WinPresentationPhaseConfig>;
  refill?: Partial<RefillPhaseConfig>;
}

export interface LayerCascadeOverride {
  layerId: string;
  /** Override visibility during cascade phases */
  visibleDuringPhases?: Array<'win' | 'removal' | 'collapse' | 'refill'>;
  /** Alpha override during cascade */
  alpha?: number;
}

// ── Mode variant (base game vs features) ───────────────────────────────────

export interface CascadeModeConfig {
  winPresentation: WinPresentationPhaseConfig;
  removal: RemovalPhaseConfig;
  collapse: CollapsePhaseConfig;
  refill: RefillPhaseConfig;
  timing: CascadePhaseTimingConfig;
  /** Per-symbol overrides */
  symbolOverrides?: SymbolCascadeOverride[];
  /** Per-layer overrides */
  layerOverrides?: LayerCascadeOverride[];
}

// ── Turbo / instant variants ───────────────────────────────────────────────

export interface CascadeSpeedVariant {
  /** Multiplier applied to all durations (0.5 = half speed) */
  durationMultiplier: number;
  /** Whether to skip win presentation */
  skipWinPresentation?: boolean;
  /** Whether to skip particles */
  skipParticles?: boolean;
  /** Whether to skip stagger (all at once) */
  skipStagger?: boolean;
  /** Override phase ordering to parallel */
  forceParallelPhases?: boolean;
  /** Minimum duration for any phase (ms) */
  minPhaseDurationMs?: number;
}

// ── Top-level cascade config (per game) ────────────────────────────────────

export interface CascadeConfig {
  /** Whether cascading/avalanche is enabled */
  enabled: boolean;
  /** Base game cascade configuration */
  baseGame: CascadeModeConfig;
  /** Feature mode overrides (merged with baseGame) */
  freeSpins?: Partial<CascadeModeConfig>;
  /** Hold & spin mode override */
  holdRespin?: Partial<CascadeModeConfig>;
  /** Bonus mode override */
  bonus?: Partial<CascadeModeConfig>;
  /** Turbo speed variant */
  turbo?: CascadeSpeedVariant;
  /** Instant/skip variant */
  instant?: CascadeSpeedVariant;
  /** Default speed variant applied in normal mode */
  normal?: CascadeSpeedVariant;
}
