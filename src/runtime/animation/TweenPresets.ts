/**
 * TweenPresets - Maps TweenType names to GSAP tween configurations.
 *
 * PixiJS v8 note: `scale` is an ObservablePoint, so we can't use
 * `{ scaleX, scaleY }` directly. Instead, scale-based presets are
 * marked with `scaleTarget: true` so TweenFactory tweens `target.scale`
 * with `{ x, y }` properties.
 */

import type { TweenOptions } from './TweenTypes';

export interface ResolvedTween {
  vars: Record<string, any>;
  method: 'to' | 'from' | 'fromTo';
  fromVars?: Record<string, any>;
  needsFilter?: 'glow' | 'blur';
  /** If true, tween target.scale instead of target */
  scaleTarget?: boolean;
  /** If set, create a timeline with multiple steps */
  timeline?: TimelineStep[];
}

export interface TimelineStep {
  target: 'self' | 'scale';
  method: 'to' | 'from' | 'fromTo';
  vars: Record<string, any>;
  fromVars?: Record<string, any>;
  position?: string | number;
}

export function resolvePreset(opts: TweenOptions): ResolvedTween {
  const dur = opts.duration ?? getDefaultDuration(opts.type);
  const ease = opts.easing ?? getDefaultEase(opts.type);
  const repeat = opts.loop ? -1 : (opts.repeat ?? 0);
  const yoyo = opts.yoyo ?? shouldYoyo(opts.type);

  const base: Record<string, any> = {
    duration: dur,
    delay: opts.delay,
    repeat,
    yoyo,
    ease,
    stagger: opts.stagger,
    onComplete: opts.onComplete,
  };

  switch (opts.type) {
    // ── Scale-based presets (target.scale) ───────────────────────────────

    case 'pulse':
    case 'winPulse': {
      const s = opts.scale ?? (opts.type === 'winPulse' ? 1.15 : 1.1);
      return {
        method: 'to',
        vars: { ...base, x: s, y: s },
        scaleTarget: true,
      };
    }

    case 'bounce':
    case 'symbolLand': {
      const s = opts.scale ?? 0.85;
      return {
        method: 'fromTo',
        fromVars: { x: s, y: s },
        vars: { ...base, x: 1, y: 1, ease: ease ?? 'elastic.out(1, 0.4)' },
        scaleTarget: true,
      };
    }

    case 'zoomIn':
      return {
        method: 'fromTo',
        fromVars: { x: 0, y: 0 },
        vars: { ...base, x: 1, y: 1 },
        scaleTarget: true,
      };

    case 'zoomOut':
      return {
        method: 'to',
        vars: { ...base, x: 0, y: 0 },
        scaleTarget: true,
      };

    case 'flip':
      return {
        method: 'to',
        vars: { ...base, x: 0, duration: dur / 2, yoyo: true, repeat: 1, ease: 'power2.inOut' },
        scaleTarget: true,
      };

    // ── Position / transform presets (target directly) ──────────────────

    case 'shake':
    case 'bigWinShake': {
      const intensity = opts.intensity ?? (opts.type === 'bigWinShake' ? 8 : 3);
      return {
        method: 'to',
        vars: {
          ...base,
          x: `+=${intensity}`,
          yoyo: true,
          repeat: repeat === 0 ? 5 : repeat,
          ease: 'power1.inOut',
          duration: dur / 6,
        },
      };
    }

    case 'fadeIn':
      return {
        method: 'fromTo',
        fromVars: { alpha: 0 },
        vars: { ...base, alpha: 1 },
      };

    case 'fadeOut':
      return {
        method: 'to',
        vars: { ...base, alpha: 0 },
      };

    case 'slideIn': {
      const dist = opts.distance ?? 200;
      const dir = opts.direction ?? 'left';
      const fromX = dir === 'left' ? -dist : dir === 'right' ? dist : 0;
      const fromY = dir === 'up' ? -dist : dir === 'down' ? dist : 0;
      return {
        method: 'from',
        vars: { ...base, x: `+=${fromX}`, y: `+=${fromY}`, alpha: 0 },
      };
    }

    case 'slideOut': {
      const dist = opts.distance ?? 200;
      const dir = opts.direction ?? 'right';
      const toX = dir === 'left' ? -dist : dir === 'right' ? dist : 0;
      const toY = dir === 'up' ? -dist : dir === 'down' ? dist : 0;
      return {
        method: 'to',
        vars: { ...base, x: `+=${toX}`, y: `+=${toY}`, alpha: 0 },
      };
    }

    case 'rotate':
      return {
        method: 'to',
        vars: { ...base, rotation: opts.angle ?? Math.PI * 2 },
      };

    case 'drop': {
      const dist = opts.distance ?? 400;
      return {
        method: 'from',
        vars: { ...base, y: `-=${dist}`, ease: ease ?? 'bounce.out' },
      };
    }

    // ── Filter presets ──────────────────────────────────────────────────

    case 'glow':
    case 'scatterGlow':
      return {
        method: 'to',
        vars: { ...base },
        needsFilter: 'glow',
      };

    case 'blur':
      return {
        method: 'to',
        vars: { ...base },
        needsFilter: 'blur',
      };

    // ── New symbol lifecycle presets ─────────────────────────────────────

    case 'landBounce': {
      // Move up slightly then settle back — uses fromTo so Y always returns to 0
      const dist = opts.distance ?? 12;
      return {
        method: 'to',
        vars: { duration: dur },
        timeline: [
          {
            target: 'self',
            method: 'fromTo',
            fromVars: { y: 0 },
            vars: { y: -dist, duration: dur * 0.4, ease: 'power2.out', yoyo: true, repeat: 1 },
          },
        ],
      };
    }

    case 'landBounceHorizontal': {
      // Horizontal version: bounce on X axis for right-to-left / left-to-right reels
      const dist = opts.distance ?? 12;
      const dir = opts.direction === 'right' ? 1 : -1;
      return {
        method: 'to',
        vars: { duration: dur },
        timeline: [
          {
            target: 'self',
            method: 'fromTo',
            fromVars: { x: 0 },
            vars: { x: dist * dir, duration: dur * 0.4, ease: 'power2.out', yoyo: true, repeat: 1 },
          },
        ],
      };
    }

    case 'landBounceSpecial': {
      // More pronounced: move up + slight scale overshoot
      const dist = opts.distance ?? 18;
      return {
        method: 'to',
        vars: { duration: dur },
        timeline: [
          {
            target: 'self',
            method: 'fromTo',
            fromVars: { y: 0 },
            vars: { y: -dist, duration: dur * 0.4, ease: 'power2.out', yoyo: true, repeat: 1 },
          },
          {
            target: 'scale',
            method: 'fromTo',
            fromVars: { x: 1, y: 1 },
            vars: { x: 1.12, y: 1.12, duration: dur * 0.35, ease: 'power2.out', yoyo: true, repeat: 1 },
            position: 0,
          },
        ],
      };
    }

    case 'winZoomRotate': {
      // Zoom IN (scale up), hold with slight rotation, then zoom back to normal
      const s = opts.scale ?? 1.15;
      const angle = opts.angle ?? 0.04;
      return {
        method: 'to',
        vars: { duration: dur },
        timeline: [
          // Phase 1: zoom in + slight rotate
          {
            target: 'scale',
            method: 'fromTo',
            fromVars: { x: 1, y: 1 },
            vars: { x: s, y: s, duration: dur * 0.3, ease: 'back.out(1.4)' },
          },
          {
            target: 'self',
            method: 'fromTo',
            fromVars: { rotation: 0 },
            vars: { rotation: angle, duration: dur * 0.25, ease: 'sine.inOut', yoyo: true, repeat: 1 },
            position: 0,
          },
          // Phase 2: hold zoomed (implicit via timeline gap)
          // Phase 3: zoom back out to normal
          {
            target: 'scale',
            method: 'to',
            vars: { x: 1, y: 1, duration: dur * 0.35, ease: 'power2.inOut' },
            position: `>${dur * 0.15}`,
          },
        ],
      };
    }

    case 'winZoomRotateSpecial': {
      // More dramatic zoom in + rotate for special symbols
      const s = opts.scale ?? 1.2;
      const angle = opts.angle ?? 0.06;
      return {
        method: 'to',
        vars: { duration: dur },
        timeline: [
          {
            target: 'scale',
            method: 'fromTo',
            fromVars: { x: 1, y: 1 },
            vars: { x: s, y: s, duration: dur * 0.3, ease: 'back.out(1.6)' },
          },
          {
            target: 'self',
            method: 'fromTo',
            fromVars: { rotation: 0 },
            vars: { rotation: angle, duration: dur * 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 },
            position: 0,
          },
          {
            target: 'scale',
            method: 'to',
            vars: { x: 1, y: 1, duration: dur * 0.4, ease: 'power2.inOut' },
            position: `>${dur * 0.15}`,
          },
        ],
      };
    }

    case 'glowPulse': {
      // Pulsing glow filter effect
      return {
        method: 'to',
        vars: { ...base },
        needsFilter: 'glow',
      };
    }

    default:
      return { method: 'to', vars: base };
  }
}

// ── Defaults ────────────────────────────────────────────────────────────────

function getDefaultDuration(type: string): number {
  const map: Record<string, number> = {
    pulse: 0.6, winPulse: 0.5, bounce: 0.4, symbolLand: 0.35,
    shake: 0.5, bigWinShake: 0.8, fadeIn: 0.3, fadeOut: 0.3,
    slideIn: 0.4, slideOut: 0.4, zoomIn: 0.5, zoomOut: 0.4,
    rotate: 1, drop: 0.6, flip: 0.5, glow: 0.8, scatterGlow: 1,
    blur: 0.4,
    landBounce: 0.35, landBounceHorizontal: 0.35, landBounceSpecial: 0.45,
    winZoomRotate: 0.7, winZoomRotateSpecial: 0.9,
    glowPulse: 0.8,
  };
  return map[type] ?? 0.5;
}

function getDefaultEase(type: string): string {
  const map: Record<string, string> = {
    pulse: 'sine.inOut', winPulse: 'sine.inOut', bounce: 'elastic.out(1, 0.4)',
    symbolLand: 'elastic.out(1, 0.4)', shake: 'power1.inOut',
    bigWinShake: 'power1.inOut', fadeIn: 'power2.out', fadeOut: 'power2.in',
    slideIn: 'power3.out', slideOut: 'power3.in', zoomIn: 'back.out(1.4)',
    zoomOut: 'power2.in', rotate: 'linear', drop: 'bounce.out',
    flip: 'power2.inOut', glow: 'sine.inOut', scatterGlow: 'sine.inOut',
    blur: 'power2.out',
    landBounce: 'power2.out', landBounceHorizontal: 'power2.out', landBounceSpecial: 'power2.out',
    winZoomRotate: 'power2.inOut', winZoomRotateSpecial: 'power2.inOut',
    glowPulse: 'sine.inOut',
  };
  return map[type] ?? 'power2.out';
}

function shouldYoyo(type: string): boolean {
  return ['pulse', 'winPulse', 'shake', 'bigWinShake', 'glow', 'scatterGlow', 'glowPulse'].includes(type);
}
