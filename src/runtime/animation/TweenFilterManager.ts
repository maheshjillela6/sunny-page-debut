/**
 * TweenFilterManager - Manages PixiJS filter lifecycle for glow/blur tweens.
 *
 * Automatically adds filters before animation, animates their properties via GSAP,
 * and removes them on completion to avoid memory leaks and duplicates.
 *
 * Internal module – game code does not import this.
 */

import gsap from 'gsap';
import { Container, BlurFilter } from 'pixi.js';
import type { TweenOptions } from './TweenTypes';

/** Tracks which filters we added so we can clean them up */
const managedFilters = new WeakMap<Container, Set<any>>();

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create and animate a glow filter on the target.
 * Returns the gsap tween so the caller can track / kill it.
 */
export function animateGlow(
  target: Container,
  opts: TweenOptions,
): gsap.core.Tween {
  const color = opts.color ?? 0xfbbf24;
  const intensity = opts.strength ?? 10;
  const dur = opts.duration ?? 0.8;
  const ease = opts.easing ?? 'sine.inOut';
  const repeat = opts.loop ? -1 : (opts.repeat ?? 0);
  const yoyo = opts.yoyo ?? true;

  // Use BlurFilter as a lightweight glow approximation (avoids external deps)
  const filter = new BlurFilter({ strength: 0, quality: 3 });
  addFilter(target, filter);

  const proxy = { strength: 0, alpha: 0 };

  return gsap.to(proxy, {
    strength: intensity,
    alpha: 1,
    duration: dur,
    ease,
    repeat,
    yoyo,
    delay: opts.delay,
    onUpdate: () => {
      filter.strength = proxy.strength;
      // Tint the container slightly for glow effect
      (target as any).tint = color;
      opts.onUpdate?.(0);
    },
    onComplete: () => {
      removeFilter(target, filter);
      (target as any).tint = 0xffffff;
      opts.onComplete?.();
    },
  });
}

/**
 * Create and animate a blur filter on the target.
 */
export function animateBlur(
  target: Container,
  opts: TweenOptions,
): gsap.core.Tween {
  const strength = opts.strength ?? 8;
  const dur = opts.duration ?? 0.4;
  const ease = opts.easing ?? 'power2.out';
  const repeat = opts.loop ? -1 : (opts.repeat ?? 0);
  const yoyo = opts.yoyo ?? false;

  const filter = new BlurFilter({ strength: 0, quality: 3 });
  addFilter(target, filter);

  const proxy = { strength: 0 };

  return gsap.to(proxy, {
    strength,
    duration: dur,
    ease,
    repeat,
    yoyo,
    delay: opts.delay,
    onUpdate: () => {
      filter.strength = proxy.strength;
      opts.onUpdate?.(0);
    },
    onComplete: () => {
      if (!opts.loop && repeat <= 0) {
        removeFilter(target, filter);
      }
      opts.onComplete?.();
    },
  });
}

// ── Filter lifecycle helpers ────────────────────────────────────────────────

function addFilter(target: Container, filter: any): void {
  const existing = Array.isArray(target.filters) ? [...target.filters] : [];
  target.filters = [...existing, filter];

  if (!managedFilters.has(target)) managedFilters.set(target, new Set());
  managedFilters.get(target)!.add(filter);
}

export function removeFilter(target: Container, filter: any): void {
  if (Array.isArray(target.filters)) {
    target.filters = target.filters.filter((f) => f !== filter);
    if (target.filters.length === 0) target.filters = [];
  }
  managedFilters.get(target)?.delete(filter);
}

/**
 * Remove ALL managed filters from a target (called when killing all tweens on a target).
 */
export function removeAllManagedFilters(target: Container): void {
  const set = managedFilters.get(target);
  if (!set) return;

  if (Array.isArray(target.filters)) {
    target.filters = target.filters.filter((f) => !set.has(f));
    if (target.filters.length === 0) target.filters = [];
  }
  set.clear();
}
