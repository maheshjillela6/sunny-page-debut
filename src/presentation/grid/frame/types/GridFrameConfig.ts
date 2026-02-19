/**
 * GridFrameConfig - Complete config schema for the Grid Frame plugin system.
 *
 * Defines all visual properties, animation bindings, and container variants
 * for both code-based and image-based grid frames.
 * All values come from config (shared defaults + game overrides). No hardcoding.
 */

import type { HexColor } from '@/presentation/layers/config/LayerConfigManager';

// ── Top-level config ────────────────────────────────────────────────────────

export interface GridFrameConfig {
  /** Master switch */
  enabled?: boolean;

  /** 'code' = programmatic sub-containers, 'image' = texture-based frame */
  type: 'code' | 'image';

  /** Padding around the grid area */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };

  /** Deterministic render order (lower = further back). Container names as keys. */
  renderOrder?: string[];

  /** Code-based frame config (used when type = 'code') */
  code?: CodeFrameConfig;

  /** Image-based frame config (used when type = 'image') */
  image?: ImageFrameConfig;
}

// ── Code-based frame ────────────────────────────────────────────────────────

export interface CodeFrameConfig {
  background?: FrameContainerConfig<BackgroundVariant>;
  frameBorder?: FrameContainerConfig<FrameBorderVariant>;
  columnSeparator?: FrameContainerConfig<ColumnSeparatorVariant>;
  rowSeparator?: FrameContainerConfig<RowSeparatorVariant>;
  effect?: FrameContainerConfig<EffectVariant>;
  animation?: FrameContainerConfig<AnimationVariant>;
}

/** Generic container descriptor – every sub-container follows this shape */
export interface FrameContainerConfig<V> {
  enabled?: boolean;
  zIndex?: number;
  /** Named variants – the active one is selected at runtime */
  variants?: Record<string, V>;
  /** Which variant is active by default */
  activeVariant?: string;
  /** Lifecycle-bound animations */
  animations?: FrameAnimationBindings;
}

// ── Lifecycle animation bindings ────────────────────────────────────────────

export interface FrameAnimationBindings {
  idle?: FrameAnimation[];
  spin?: FrameAnimation[];
  win?: FrameAnimation[];
  feature?: FrameAnimation[];
  custom?: Record<string, FrameAnimation[]>;
}

export interface FrameAnimation {
  target?: string; // child label inside the container
  property: 'alpha' | 'scaleX' | 'scaleY' | 'x' | 'y' | 'rotation' | 'tint';
  from?: number;
  to: number;
  durationMs: number;
  ease?: string;
  delay?: number;
  loop?: boolean;
  yoyo?: boolean;
}

// ── Variant types ───────────────────────────────────────────────────────────

export interface BackgroundVariant {
  fill?: HexColor;
  fillAlpha?: number;
  radius?: number;
  /** Extra inset/outset relative to grid bounds */
  inset?: number;
  gradient?: GradientDef;
  blendMode?: string;
}

export interface FrameBorderVariant {
  stroke?: HexColor;
  strokeWidth?: number;
  strokeAlpha?: number;
  radius?: number;
  /** Padding outside grid bounds */
  margin?: number;
  dash?: { length?: number; gap?: number };
  blendMode?: string;
  /** Optional inner border */
  inner?: {
    stroke?: HexColor;
    strokeWidth?: number;
    strokeAlpha?: number;
    radius?: number;
    margin?: number;
  };
}

export interface ColumnSeparatorVariant {
  stroke?: HexColor;
  strokeWidth?: number;
  strokeAlpha?: number;
  /** Top/bottom padding for the separator line */
  paddingY?: number;
  dash?: { length?: number; gap?: number };
  blendMode?: string;
}

export interface RowSeparatorVariant {
  stroke?: HexColor;
  strokeWidth?: number;
  strokeAlpha?: number;
  /** Left/right padding for the separator line */
  paddingX?: number;
  dash?: { length?: number; gap?: number };
  blendMode?: string;
}

export interface EffectVariant {
  type: 'glow' | 'shadow' | 'particles' | 'custom';
  color?: HexColor;
  alpha?: number;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  /** For particles */
  count?: number;
  spread?: number;
  blendMode?: string;
}

export interface AnimationVariant {
  type: 'pulse' | 'shimmer' | 'rotate' | 'custom';
  color?: HexColor;
  alpha?: number;
  durationMs?: number;
  loop?: boolean;
  /** For shimmer */
  width?: number;
  angle?: number;
  blendMode?: string;
}

// ── Gradient ────────────────────────────────────────────────────────────────

export interface GradientDef {
  type: 'linear' | 'radial';
  stops: Array<{ color: HexColor; position: number; alpha?: number }>;
  angle?: number; // for linear
}

// ── Image-based frame ───────────────────────────────────────────────────────

export interface ImageFrameConfig {
  /** Active variant name */
  activeVariant?: string;
  variants?: Record<string, ImageFrameVariant>;
  /** Lifecycle-bound animations */
  animations?: FrameAnimationBindings;
}

export interface ImageFrameVariant {
  /** 9-slice texture keys */
  textures?: {
    topLeft?: string;
    top?: string;
    topRight?: string;
    left?: string;
    center?: string;
    right?: string;
    bottomLeft?: string;
    bottom?: string;
    bottomRight?: string;
    /** Or a single frame texture */
    frame?: string;
  };
  /** Padding / margins */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  alpha?: number;
  tint?: HexColor;
  blendMode?: string;
}
