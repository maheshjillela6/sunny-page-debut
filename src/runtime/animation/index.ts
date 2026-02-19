/**
 * Animation module public API.
 *
 * Game code should import from here:
 *   import { TweenFactory } from '@/runtime/animation';
 *   import type { TweenOptions, TweenHandle } from '@/runtime/animation';
 *
 * GSAP is never exposed through this barrel.
 */

export { TweenFactory } from './TweenFactory';
export type {
  TweenType,
  TweenLayerId,
  TweenOptions,
  TweenHandle,
  TweenTimeline,
} from './TweenTypes';
