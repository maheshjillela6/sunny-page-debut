/**
 * TweenFactory - Static facade for all game animations.
 *
 * Architecture: game code imports only TweenFactory + TweenTypes.
 * GSAP is fully encapsulated. Scale animations properly target
 * PixiJS ObservablePoint (target.scale) instead of raw properties.
 */

import gsap from 'gsap';
import { Container } from 'pixi.js';
import type { TweenOptions, TweenHandle, TweenTimeline, TweenLayerId } from './TweenTypes';
import { resolvePreset } from './TweenPresets';
import type { TimelineStep } from './TweenPresets';
import { animateGlow, animateBlur, removeAllManagedFilters } from './TweenFilterManager';
import { trackTween, killLayer as killLayerInternal, killAll as killAllInternal, pruneLayer } from './TweenLayerTracker';

export class TweenFactory {
  private constructor() {}

  // ── Core play API ───────────────────────────────────────────────────────

  static play(target: any | any[], options: TweenOptions): TweenHandle {
    const targets = Array.isArray(target) ? target : [target];

    // Handle filter-based animations
    if (options.type === 'glow' || options.type === 'scatterGlow' || options.type === 'glowPulse') {
      return TweenFactory.playFilter(targets, options, 'glow');
    }
    if (options.type === 'blur') {
      return TweenFactory.playFilter(targets, options, 'blur');
    }

    const preset = resolvePreset(options);

    // Timeline-based preset (multi-step animations)
    if (preset.timeline) {
      return TweenFactory.playTimeline(targets, preset.timeline, options);
    }

    // Determine actual tween target: for scale presets, tween target.scale
    const actualTargets = preset.scaleTarget
      ? targets.map((t: any) => t.scale)
      : targets;

    let tween: gsap.core.Tween;

    switch (preset.method) {
      case 'from':
        tween = gsap.from(actualTargets, preset.vars);
        break;
      case 'fromTo':
        tween = gsap.fromTo(actualTargets, preset.fromVars!, preset.vars);
        break;
      case 'to':
      default:
        tween = gsap.to(actualTargets, preset.vars);
        break;
    }

    if (options.layerId) {
      pruneLayer(options.layerId);
      trackTween(options.layerId, tween, targets[0]);
    }

    return wrapHandle(tween);
  }

  /**
   * Play a multi-step timeline preset. Each step can target 'self' or 'scale'.
   */
  private static playTimeline(
    targets: any[],
    steps: TimelineStep[],
    options: TweenOptions,
  ): TweenHandle {
    // Support looping timelines via repeat on the parent timeline
    const repeat = options.loop ? -1 : (options.repeat ?? 0);
    const tl = gsap.timeline({ repeat, yoyo: options.yoyo ?? false });

    for (const step of steps) {
      for (const target of targets) {
        const actualTarget = step.target === 'scale' ? target.scale : target;
        const pos = step.position ?? undefined;

        switch (step.method) {
          case 'from':
            tl.from(actualTarget, step.vars, pos);
            break;
          case 'fromTo':
            tl.fromTo(actualTarget, step.fromVars!, step.vars, pos);
            break;
          case 'to':
          default:
            tl.to(actualTarget, step.vars, pos);
            break;
        }
      }
    }

    if (options.layerId) {
      pruneLayer(options.layerId);
      trackTween(options.layerId, tl, targets[0]);
    }

    return wrapHandle(tl);
  }

  // ── Raw tween APIs (escape hatches) ───────────────────────────────────

  static to(target: any, vars: {
    duration?: number; delay?: number; ease?: string;
    repeat?: number; yoyo?: boolean; stagger?: number;
    onComplete?: () => void; onUpdate?: () => void;
    [key: string]: any;
  }, layerId?: TweenLayerId): TweenHandle {
    const tween = gsap.to(target, vars);
    if (layerId) {
      pruneLayer(layerId);
      trackTween(layerId, tween, target);
    }
    return wrapHandle(tween);
  }

  static from(target: any, vars: Record<string, any>, layerId?: TweenLayerId): TweenHandle {
    const tween = gsap.from(target, vars);
    if (layerId) trackTween(layerId, tween, target);
    return wrapHandle(tween);
  }

  static fromTo(
    target: any,
    fromVars: Record<string, any>,
    toVars: Record<string, any>,
    layerId?: TweenLayerId,
  ): TweenHandle {
    const tween = gsap.fromTo(target, fromVars, toVars);
    if (layerId) trackTween(layerId, tween, target);
    return wrapHandle(tween);
  }

  // ── Timeline API ──────────────────────────────────────────────────────

  static timeline(layerId?: TweenLayerId): TweenTimeline {
    const tl = gsap.timeline({ paused: true });

    if (layerId) {
      pruneLayer(layerId);
      trackTween(layerId, tl, null);
    }

    const api: TweenTimeline = {
      add(target: any, options: TweenOptions): TweenTimeline {
        appendToTimeline(tl, target, options);
        return api;
      },
      addAt(target: any, options: TweenOptions, position: number | string): TweenTimeline {
        appendToTimeline(tl, target, options, position);
        return api;
      },
      label(name: string): TweenTimeline {
        tl.addLabel(name);
        return api;
      },
      addDelay(seconds: number): TweenTimeline {
        tl.to({}, { duration: seconds });
        return api;
      },
      call(fn: () => void): TweenTimeline {
        tl.call(fn);
        return api;
      },
      play(): TweenTimeline {
        tl.play();
        return api;
      },
      pause(): TweenTimeline {
        tl.pause();
        return api;
      },
      resume(): TweenTimeline {
        tl.resume();
        return api;
      },
      kill(): void {
        tl.kill();
      },
      isActive(): boolean {
        return tl.isActive();
      },
      onComplete(fn: () => void): TweenTimeline {
        tl.eventCallback('onComplete', fn);
        return api;
      },
    };

    return api;
  }

  // ── Kill APIs ─────────────────────────────────────────────────────────

  static kill(target: any): void {
    gsap.killTweensOf(target);
    // Also kill tweens on scale
    if (target?.scale) {
      gsap.killTweensOf(target.scale);
    }
    if (target instanceof Container) {
      removeAllManagedFilters(target);
    }
  }

  static killLayer(layerId: TweenLayerId): void {
    killLayerInternal(layerId);
  }

  static killAll(): void {
    killAllInternal();
    gsap.globalTimeline.clear();
  }

  // ── Convenience helpers ───────────────────────────────────────────────

  static delayedCall(seconds: number, fn: () => void): TweenHandle {
    const tween = gsap.delayedCall(seconds, fn);
    return wrapHandle(tween);
  }

  static set(target: any, vars: Record<string, any>): void {
    gsap.set(target, vars);
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private static playFilter(
    targets: any[],
    options: TweenOptions,
    filterType: 'glow' | 'blur',
  ): TweenHandle {
    const tweens: gsap.core.Tween[] = [];

    for (const t of targets) {
      const tween = filterType === 'glow'
        ? animateGlow(t, options)
        : animateBlur(t, options);
      tweens.push(tween);

      if (options.layerId) {
        pruneLayer(options.layerId);
        trackTween(options.layerId, tween, t);
      }
    }

    return {
      kill: () => tweens.forEach((tw) => tw.kill()),
      pause: () => tweens.forEach((tw) => tw.pause()),
      resume: () => tweens.forEach((tw) => tw.resume()),
      isActive: () => tweens.some((tw) => tw.isActive()),
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function wrapHandle(tween: gsap.core.Tween | gsap.core.Timeline): TweenHandle {
  return {
    kill: () => tween.kill(),
    pause: () => tween.pause(),
    resume: () => tween.resume(),
    isActive: () => tween.isActive(),
  };
}

function appendToTimeline(
  tl: gsap.core.Timeline,
  target: any,
  options: TweenOptions,
  position?: number | string,
): void {
  const preset = resolvePreset(options);
  const actualTarget = preset.scaleTarget ? target.scale : target;

  switch (preset.method) {
    case 'from':
      tl.from(actualTarget, preset.vars, position);
      break;
    case 'fromTo':
      tl.fromTo(actualTarget, preset.fromVars!, preset.vars, position);
      break;
    case 'to':
    default:
      tl.to(actualTarget, preset.vars, position);
      break;
  }
}
