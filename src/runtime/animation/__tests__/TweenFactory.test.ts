/**
 * TweenFactory unit tests
 *
 * Validates:
 * - Preset resolution for all tween types
 * - Filter management (glow/blur add + cleanup)
 * - Layer tracking and killLayer
 * - Timeline builder API
 * - Handle lifecycle (kill/pause/resume)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock GSAP before importing TweenFactory
const mockTween = {
  kill: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  isActive: vi.fn(() => true),
};

const mockTimeline = {
  kill: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  play: vi.fn(),
  isActive: vi.fn(() => false),
  to: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  fromTo: vi.fn().mockReturnThis(),
  addLabel: vi.fn().mockReturnThis(),
  call: vi.fn().mockReturnThis(),
  eventCallback: vi.fn().mockReturnThis(),
  clear: vi.fn(),
};

vi.mock('gsap', () => ({
  default: {
    to: vi.fn(() => mockTween),
    from: vi.fn(() => mockTween),
    fromTo: vi.fn(() => mockTween),
    set: vi.fn(),
    killTweensOf: vi.fn(),
    delayedCall: vi.fn(() => mockTween),
    timeline: vi.fn(() => mockTimeline),
    globalTimeline: { clear: vi.fn() },
  },
}));

vi.mock('pixi.js', () => ({
  Container: class {
    filters: any[] = [];
    tint: number = 0xffffff;
  },
  BlurFilter: class {
    strength: number;
    quality: number;
    constructor(opts: any) {
      this.strength = opts?.strength ?? 0;
      this.quality = opts?.quality ?? 3;
    }
  },
}));

import { TweenFactory } from '../TweenFactory';
import type { TweenOptions, TweenHandle } from '../TweenTypes';
import gsap from 'gsap';
import { Container } from 'pixi.js';

describe('TweenFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── play() ────────────────────────────────────────────────────────────

  describe('play()', () => {
    it('plays a pulse tween via gsap.to', () => {
      const target = { scale: { x: 1, y: 1 } };
      const handle = TweenFactory.play(target, { type: 'pulse', duration: 0.6 });

      expect(gsap.to).toHaveBeenCalled();
      expect(handle).toBeDefined();
      expect(handle.isActive()).toBe(true);
    });

    it('plays symbolLand via gsap.fromTo', () => {
      const target = { scale: { x: 1, y: 1 } };
      TweenFactory.play(target, { type: 'symbolLand' });

      expect(gsap.fromTo).toHaveBeenCalled();
    });

    it('plays fadeIn via gsap.fromTo', () => {
      const target = { alpha: 1 };
      TweenFactory.play(target, { type: 'fadeIn' });

      expect(gsap.fromTo).toHaveBeenCalled();
    });

    it('plays slideIn via gsap.from', () => {
      const target = { x: 0, y: 0, alpha: 1 };
      TweenFactory.play(target, { type: 'slideIn', direction: 'left' });

      expect(gsap.from).toHaveBeenCalled();
    });

    it('supports loop option (repeat: -1)', () => {
      const target = {};
      TweenFactory.play(target, { type: 'winPulse', loop: true });

      const callArgs = (gsap.to as any).mock.calls[0][1];
      expect(callArgs.repeat).toBe(-1);
    });

    it('passes stagger to GSAP', () => {
      const targets = [{}, {}, {}];
      TweenFactory.play(targets, { type: 'pulse', stagger: 0.1 });

      const callArgs = (gsap.to as any).mock.calls[0][1];
      expect(callArgs.stagger).toBe(0.1);
    });
  });

  // ── Filter animations ────────────────────────────────────────────────

  describe('filter animations', () => {
    it('plays glow animation on a Container', () => {
      const target = new Container();
      const handle = TweenFactory.play(target, { type: 'glow', color: 0xff0000 });

      // Should use gsap.to for the proxy
      expect(gsap.to).toHaveBeenCalled();
      expect(handle).toBeDefined();
    });

    it('plays blur animation on a Container', () => {
      const target = new Container();
      TweenFactory.play(target, { type: 'blur', strength: 12 });

      expect(gsap.to).toHaveBeenCalled();
    });
  });

  // ── kill() ────────────────────────────────────────────────────────────

  describe('kill()', () => {
    it('kills tweens on a target', () => {
      const target = {};
      TweenFactory.kill(target);

      expect(gsap.killTweensOf).toHaveBeenCalledWith(target);
    });

    it('removes managed filters from Container targets', () => {
      const target = new Container();
      target.filters = [{ fake: true }] as any;
      TweenFactory.kill(target);

      expect(gsap.killTweensOf).toHaveBeenCalledWith(target);
    });
  });

  // ── TweenHandle ───────────────────────────────────────────────────────

  describe('TweenHandle', () => {
    it('exposes kill/pause/resume/isActive', () => {
      const handle = TweenFactory.play({}, { type: 'fadeIn' });

      handle.pause();
      expect(mockTween.pause).toHaveBeenCalled();

      handle.resume();
      expect(mockTween.resume).toHaveBeenCalled();

      handle.kill();
      expect(mockTween.kill).toHaveBeenCalled();
    });
  });

  // ── timeline() ────────────────────────────────────────────────────────

  describe('timeline()', () => {
    it('creates a paused timeline', () => {
      const tl = TweenFactory.timeline();

      expect(gsap.timeline).toHaveBeenCalledWith({ paused: true });
      expect(tl).toBeDefined();
    });

    it('supports chaining add/label/delay/call/play', () => {
      const target = {};
      const tl = TweenFactory.timeline()
        .label('start')
        .add(target, { type: 'fadeIn' })
        .addDelay(0.5)
        .call(() => {})
        .onComplete(() => {})
        .play();

      expect(mockTimeline.addLabel).toHaveBeenCalledWith('start');
      expect(mockTimeline.play).toHaveBeenCalled();
    });

    it('supports kill', () => {
      const tl = TweenFactory.timeline();
      tl.kill();
      expect(mockTimeline.kill).toHaveBeenCalled();
    });
  });

  // ── Layer tracking ────────────────────────────────────────────────────

  describe('layer tracking', () => {
    it('tracks tweens by layerId', () => {
      const target = {};
      TweenFactory.play(target, { type: 'pulse', layerId: 'PRESENTATION' });

      // Kill should not throw
      TweenFactory.killLayer('PRESENTATION');
    });

    it('killAll clears global timeline', () => {
      TweenFactory.killAll();
      expect(gsap.globalTimeline.clear).toHaveBeenCalled();
    });
  });

  // ── Raw API ───────────────────────────────────────────────────────────

  describe('raw API', () => {
    it('TweenFactory.to wraps gsap.to', () => {
      TweenFactory.to({}, { duration: 1, x: 100 });
      expect(gsap.to).toHaveBeenCalled();
    });

    it('TweenFactory.set wraps gsap.set', () => {
      TweenFactory.set({}, { alpha: 0 });
      expect(gsap.set).toHaveBeenCalled();
    });

    it('TweenFactory.delayedCall wraps gsap.delayedCall', () => {
      const fn = vi.fn();
      TweenFactory.delayedCall(1, fn);
      expect(gsap.delayedCall).toHaveBeenCalledWith(1, fn);
    });
  });
});
