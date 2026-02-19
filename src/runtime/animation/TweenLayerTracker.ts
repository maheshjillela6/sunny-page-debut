/**
 * TweenLayerTracker - Tracks active tweens per layer for grouped kill.
 *
 * Internal module – game code uses TweenFactory.killLayer() instead.
 */

import gsap from 'gsap';
import type { TweenLayerId } from './TweenTypes';
import { removeAllManagedFilters } from './TweenFilterManager';
import { Container } from 'pixi.js';

interface TrackedTween {
  tween: gsap.core.Tween | gsap.core.Timeline;
  target: any;
}

const layerTweens = new Map<TweenLayerId, TrackedTween[]>();

export function trackTween(
  layerId: TweenLayerId,
  tween: gsap.core.Tween | gsap.core.Timeline,
  target: any,
): void {
  if (!layerTweens.has(layerId)) layerTweens.set(layerId, []);
  layerTweens.get(layerId)!.push({ tween, target });
}

export function killLayer(layerId: TweenLayerId): void {
  const tweens = layerTweens.get(layerId);
  if (!tweens) return;

  for (const { tween, target } of tweens) {
    tween.kill();
    if (target instanceof Container) {
      removeAllManagedFilters(target);
    }
  }

  layerTweens.set(layerId, []);
}

/**
 * Prune completed tweens to avoid memory buildup.
 * Called periodically or before new tween registration.
 */
export function pruneLayer(layerId: TweenLayerId): void {
  const tweens = layerTweens.get(layerId);
  if (!tweens) return;
  layerTweens.set(
    layerId,
    tweens.filter((t) => t.tween.isActive()),
  );
}

export function killAll(): void {
  for (const [layerId] of layerTweens) {
    killLayer(layerId);
  }
}
