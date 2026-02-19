/**
 * GenericLayerSchema - Unified, reusable schema for all data-driven Pixi layers.
 *
 * Any layer can be described by a single JSON file conforming to `GenericLayerConfig`.
 * The schema supports:
 *   - enabled flag
 *   - zIndex override
 *   - sublayers (named child containers with their own elements)
 *   - element types: image, sprite, spine, graphics, container, text
 *   - animation sequences (playOnEnter / playOnExit / state-based)
 *   - fallback graphics
 *   - visibility rules (game-state conditions)
 *   - event bindings
 */

import type { HexColor } from './LayerConfigManager';

// ── Element Types ───────────────────────────────────────────────────────────

export type ElementType = 'image' | 'sprite' | 'spine' | 'graphics' | 'container' | 'text';

/** Position descriptor reused across elements */
export interface ElementPosition {
  x?: number;
  y?: number;
  anchor?: { x: number; y: number };
  pivot?: { x: number; y: number };
}

/** Transform descriptor */
export interface ElementTransform {
  scale?: number | { x: number; y: number };
  rotation?: number;
  alpha?: number;
}

/** Animation keyframe */
export interface AnimationKeyframe {
  property: 'x' | 'y' | 'alpha' | 'scaleX' | 'scaleY' | 'rotation' | 'tint';
  from?: number;
  to: number;
  durationMs: number;
  ease?: string;
  delay?: number;
}

/** Animation sequence – a named collection of keyframes */
export interface AnimationSequence {
  name: string;
  keyframes: AnimationKeyframe[];
  loop?: boolean;
}

/** Visibility rule – element shown/hidden based on game state */
export interface VisibilityRule {
  /** State key to watch (e.g. 'feature.active', 'round.isFreeSpin') */
  stateKey: string;
  /** Expected value; if omitted, truthy check */
  equals?: string | number | boolean;
  /** Invert the condition */
  invert?: boolean;
}

/** Event binding – trigger actions on EventBus events */
export interface EventBinding {
  /** Event name from EventBus */
  event: string;
  /** Action to perform */
  action: 'show' | 'hide' | 'playAnimation' | 'stopAnimation' | 'destroy' | 'custom';
  /** Optional animation name for playAnimation */
  animationName?: string;
  /** Custom handler identifier */
  handlerId?: string;
}

/** Graphics shape descriptors */
export type GraphicsShape =
  | { kind: 'rect'; x?: number; y?: number; width: number; height: number; radius?: number }
  | { kind: 'circle'; x?: number; y?: number; radius: number }
  | { kind: 'ellipse'; x?: number; y?: number; radiusX: number; radiusY: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'polygon'; points: number[] }
  | { kind: 'starfield'; config: StarfieldConfig };

export interface StarfieldConfig {
  count: number;
  area?: { width?: number; height?: number };
  colors?: HexColor[];
  radiusMin?: number;
  radiusMax?: number;
  alphaMin?: number;
  alphaMax?: number;
  pulseDurationMs?: number;
}

/** Text style descriptor */
export interface TextStyleConfig {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fill?: HexColor;
  stroke?: HexColor;
  strokeWidth?: number;
  letterSpacing?: number;
  lineHeight?: number;
  wordWrap?: boolean;
  wordWrapWidth?: number;
  dropShadow?: {
    color?: HexColor;
    alpha?: number;
    blur?: number;
    distance?: number;
    angle?: number;
  };
}

// ── Element Descriptor ──────────────────────────────────────────────────────

export interface LayerElement {
  /** Unique id within the layer */
  id: string;
  /** Element type */
  type: ElementType;
  /** Position & anchor */
  position?: ElementPosition;
  /** Transform overrides */
  transform?: ElementTransform;

  // ── Type-specific fields ──

  /** For type: 'image' | 'sprite' */
  textureKey?: string;
  /** Scale mode for images */
  scaleMode?: 'cover' | 'contain' | 'stretch' | 'none';

  /** For type: 'spine' */
  spineKey?: string;
  spineAnimation?: { name?: string; loop?: boolean };
  fillScreen?: boolean;

  /** For type: 'graphics' */
  shape?: GraphicsShape;
  fill?: HexColor;
  fillAlpha?: number;
  stroke?: HexColor;
  strokeWidth?: number;
  strokeAlpha?: number;

  /** For type: 'text' */
  text?: string;
  textStyle?: TextStyleConfig;

  /** For type: 'container' – nested children */
  children?: LayerElement[];

  // ── Behaviour ──

  /** Animations keyed by trigger */
  animations?: {
    playOnEnter?: AnimationSequence;
    playOnExit?: AnimationSequence;
    /** State-based animations: key = state name */
    states?: Record<string, AnimationSequence>;
  };

  /** Fallback element if primary asset not loaded */
  fallback?: LayerElement;

  /** Visibility conditions */
  visibilityRules?: VisibilityRule[];

  /** Event bindings */
  eventBindings?: EventBinding[];

  /** Interactive flag */
  interactive?: boolean;

  /** Event mode override */
  eventMode?: 'none' | 'passive' | 'auto' | 'static' | 'dynamic';
}

// ── Sublayer ────────────────────────────────────────────────────────────────

export interface Sublayer {
  /** Sublayer name (becomes container label) */
  name: string;
  /** Z-index within parent layer */
  zIndex?: number;
  /** Visibility flag */
  visible?: boolean;
  /** Elements in this sublayer */
  elements: LayerElement[];
  /** Sublayer-level visibility rules */
  visibilityRules?: VisibilityRule[];
}

// ── GenericLayerConfig ──────────────────────────────────────────────────────

export interface GenericLayerConfig {
  /** Whether this layer is enabled at all */
  enabled?: boolean;
  /** Z-index override (defaults to StageLayer enum value) */
  zIndex?: number;
  /** Named sublayers */
  sublayers?: Sublayer[];
  /** Top-level elements (placed directly in the layer) */
  elements?: LayerElement[];
  /** Layer-level animations */
  animations?: {
    playOnEnter?: AnimationSequence;
    playOnExit?: AnimationSequence;
    states?: Record<string, AnimationSequence>;
  };
  /** Layer-level visibility rules */
  visibilityRules?: VisibilityRule[];
  /** Layer-level event bindings */
  eventBindings?: EventBinding[];

  // ── Legacy passthrough ──
  // Layers that already have custom typed configs can embed them here.
  // ConfigDrivenLayer ignores unknown keys; specialized subclasses pick them up.
  [key: string]: unknown;
}
