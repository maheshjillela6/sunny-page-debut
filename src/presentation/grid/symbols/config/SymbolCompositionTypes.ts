/**
 * SymbolCompositionTypes - Configuration types for fully pluggable symbol rendering.
 *
 * Every symbol's visual structure, layer composition, and state-based animation
 * is defined through these types. No hardcoded rendering logic in the engine.
 */

import type { TweenType } from '../../../../runtime/animation/TweenTypes';

// ── Symbol lifecycle states ────────────────────────────────────────────────

export type SymbolLifecycleState =
  | 'spinning'
  | 'landing'
  | 'idle'
  | 'win'
  | 'big_win'
  | 'anticipation'
  | 'feature_override';

// ── Layer visual types ─────────────────────────────────────────────────────

export type SymbolLayerType = 'sprite' | 'spine' | 'graphics' | 'image';

// ── Animation driver ───────────────────────────────────────────────────────

export type AnimationDriver = 'spine' | 'tween' | 'none';

// ── Graphics shape definitions ─────────────────────────────────────────────

export interface GraphicsShapeConfig {
  shape: 'rect' | 'circle' | 'oval' | 'polygon' | 'roundRect';
  fill?: string | number;
  fillAlpha?: number;
  stroke?: string | number;
  strokeWidth?: number;
  strokeAlpha?: number;
  cornerRadius?: number;
  /** For polygon: array of [x, y] pairs */
  points?: number[];
  /** Inset from symbol bounds (px). Defaults 0. */
  padding?: number;
}

// ── Tween animation config (resolved by TweenFactory) ──────────────────────

export interface TweenAnimationConfig {
  type: TweenType;
  duration?: number;
  delay?: number;
  repeat?: number;
  loop?: boolean;
  yoyo?: boolean;
  easing?: string;
  scale?: number;
  intensity?: number;
  color?: number;
  strength?: number;
  distance?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

// ── Spine animation config ─────────────────────────────────────────────────

export interface SpineAnimationConfig {
  /** Spine skeleton key (registered in SpineFactory) */
  skeletonKey: string;
  /** Animation name to play */
  animationName: string;
  loop?: boolean;
  timeScale?: number;
  mixDuration?: number;
}

// ── Per-state rendering rule for a single layer ────────────────────────────

export interface LayerStateRule {
  /** Whether this layer is visible in this state */
  visible: boolean;
  /** Whether the layer is static (no animation) */
  static?: boolean;
  /** Animation driver for this state */
  animationDriver?: AnimationDriver;
  /** Tween config (when driver is 'tween') */
  tween?: TweenAnimationConfig;
  /** Spine animation config (when driver is 'spine') */
  spine?: SpineAnimationConfig;
  /** Whether to swap the renderer for this state (e.g. sprite→spine) */
  swapRenderer?: boolean;
  /** If swapping, the replacement layer type */
  swapLayerType?: SymbolLayerType;
  /** If swapping, the replacement asset key */
  swapAssetKey?: string;
  /** Alpha override for this state */
  alpha?: number;
  /** Scale override */
  scale?: number;
}

// ── Single visual layer definition ─────────────────────────────────────────

export interface SymbolLayerConfig {
  /** Unique layer id within the symbol (e.g. "bg", "fg", "overlay") */
  id: string;
  /** Visual type */
  type: SymbolLayerType;
  /** z-index within symbol (lower = further back) */
  zIndex: number;
  /** Asset key (texture key for sprite/image, skeleton key for spine) */
  assetKey?: string;
  /** Spritesheet frame name (for sprite type) */
  frameName?: string;
  /** Graphics shape definition (for graphics type) */
  graphics?: GraphicsShapeConfig;
  /** Anchor point [x, y]. Defaults [0.5, 0.5] */
  anchor?: [number, number];
  /** Offset from symbol center [x, y] */
  offset?: [number, number];
  /** Scale factor [x, y] or single number */
  scale?: number | [number, number];
  /** Alpha. Defaults 1. */
  alpha?: number;
  /** Tint color (hex). Sprite/image only. */
  tint?: number;
  /** Per-state rendering rules. Missing states inherit defaults. */
  states: Partial<Record<SymbolLifecycleState, LayerStateRule>>;
  /** Default state rule (used when a specific state isn't defined) */
  defaultState?: LayerStateRule;
}

// ── Complete symbol composition ────────────────────────────────────────────

export interface SymbolCompositionConfig {
  /** Symbol id this composition belongs to */
  symbolId: string;
  /** Width of the symbol in pixels (overrides grid cell if set) */
  width?: number;
  /** Height of the symbol in pixels */
  height?: number;
  /** Visual layers, rendered in zIndex order */
  layers: SymbolLayerConfig[];
  /** Highlight overlay config */
  highlight?: {
    color?: number;
    alpha?: number;
    padding?: number;
    cornerRadius?: number;
    /** Whether to use a glow filter instead of graphics overlay */
    useGlow?: boolean;
    /** Tween to play on highlight */
    tween?: TweenAnimationConfig;
  };
}

// ── Game-level symbol rendering config ─────────────────────────────────────

export interface GameSymbolRenderingConfig {
  /** Default composition for symbols not explicitly configured */
  defaultComposition?: Partial<SymbolCompositionConfig>;
  /** Per-symbol compositions */
  symbols: Record<string, SymbolCompositionConfig>;
}

// ── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_LAYER_STATE: LayerStateRule = {
  visible: true,
  static: true,
  animationDriver: 'none',
};

export const DEFAULT_HIGHLIGHT = {
  color: 0xf1c40f,
  alpha: 0.4,
  padding: 4,
  cornerRadius: 16,
  useGlow: false,
};
