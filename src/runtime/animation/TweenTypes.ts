/**
 * TweenTypes - Public type definitions for the TweenFactory abstraction.
 *
 * Game code imports ONLY from this file and TweenFactory.ts.
 * GSAP is never exposed here.
 */

// ── Supported animation presets ─────────────────────────────────────────────

export type TweenType =
  | 'pulse'
  | 'bounce'
  | 'shake'
  | 'fadeIn'
  | 'fadeOut'
  | 'slideIn'
  | 'slideOut'
  | 'zoomIn'
  | 'zoomOut'
  | 'rotate'
  | 'drop'
  | 'flip'
  | 'glow'
  | 'blur'
  | 'symbolLand'
  | 'winPulse'
  | 'scatterGlow'
  | 'bigWinShake'
  // ── New symbol lifecycle presets ──
  | 'landBounce'
  | 'landBounceHorizontal'
  | 'landBounceSpecial'
  | 'winZoomRotate'
  | 'winZoomRotateSpecial'
  | 'glowPulse';

// ── Layer identifiers for group kill ────────────────────────────────────────

export type TweenLayerId =
  | 'BACKGROUND'
  | 'REELS'
  | 'PRESENTATION'
  | 'UI'
  | 'OVERLAY'
  | 'WIN'
  | 'TRANSITION';

// ── Options passed by game code ─────────────────────────────────────────────

export interface TweenOptions {
  /** Animation preset type */
  type: TweenType;
  /** Duration in seconds (default varies per type) */
  duration?: number;
  /** Delay before start in seconds */
  delay?: number;
  /** Number of repeats (-1 = infinite) */
  repeat?: number;
  /** Convenience alias for repeat: -1 */
  loop?: boolean;
  /** Yoyo (reverse on each repeat) */
  yoyo?: boolean;
  /** GSAP-compatible easing string (e.g. "elastic.out(1, 0.4)") */
  easing?: string;
  /** Stagger delay between targets when an array is passed */
  stagger?: number;
  /** Assign this tween to a layer for grouped kill */
  layerId?: TweenLayerId;
  /** Callback when complete */
  onComplete?: () => void;
  /** Callback on each frame */
  onUpdate?: (progress: number) => void;

  // ── Type-specific overrides ──

  /** Scale amount for pulse / bounce / winPulse / zoomIn / zoomOut */
  scale?: number;
  /** Shake / bigWinShake intensity in pixels */
  intensity?: number;
  /** Slide / drop distance in pixels */
  distance?: number;
  /** Slide direction */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Rotation amount in radians (for 'rotate') */
  angle?: number;
  /** Glow / scatterGlow color (hex number) */
  color?: number;
  /** Blur strength for 'blur' type */
  strength?: number;
}

// ── Timeline builder (mirrors GSAP timeline API without exposing it) ────────

export interface TweenTimeline {
  /** Add a tween to the timeline at current position */
  add(target: any, options: TweenOptions): TweenTimeline;
  /** Add a tween at a specific position (seconds or label) */
  addAt(target: any, options: TweenOptions, position: number | string): TweenTimeline;
  /** Add a label */
  label(name: string): TweenTimeline;
  /** Add a delay */
  addDelay(seconds: number): TweenTimeline;
  /** Add a callback at current position */
  call(fn: () => void): TweenTimeline;
  /** Play the timeline */
  play(): TweenTimeline;
  /** Pause the timeline */
  pause(): TweenTimeline;
  /** Resume */
  resume(): TweenTimeline;
  /** Kill the entire timeline */
  kill(): void;
  /** Whether the timeline is active */
  isActive(): boolean;
  /** Set onComplete handler */
  onComplete(fn: () => void): TweenTimeline;
}

// ── Tween handle returned by TweenFactory.play() ───────────────────────────

export interface TweenHandle {
  /** Kill this specific tween */
  kill(): void;
  /** Pause */
  pause(): void;
  /** Resume */
  resume(): void;
  /** Whether tween is still running */
  isActive(): boolean;
}
