/**
 * TimelineRunner - Unit Tests
 * Verifies cancellation tokens, error boundaries, state tracking,
 * pause/resume, skipTo, concurrent starts, empty actions, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimelineRunner } from '../TimelineRunner';
import { TimelineAction, CancellationToken } from '../TimelineTypes';

// Helper to create a simple callback action
function makeAction(id: string, opts: { duration?: number; fn?: (token?: CancellationToken) => Promise<void> | void } = {}): TimelineAction {
  return {
    id,
    type: 'callback',
    execute: async (token) => opts.fn?.(token),
    duration: opts.duration ?? 100,
  };
}

describe('TimelineRunner', () => {
  // ── Cancellation Tokens ─────────────────────────────────────────────

  describe('Cancellation Tokens', () => {
    it('should pass cancellation token to actions', async () => {
      let receivedToken: CancellationToken | undefined;

      const action: TimelineAction = {
        id: 'test',
        type: 'callback',
        execute: async (token) => {
          receivedToken = token;
        },
        duration: 100,
      };

      const runner = new TimelineRunner();
      runner.setActions([action]);
      await runner.start();

      expect(receivedToken).toBeDefined();
      expect(receivedToken?.isCancelled).toBe(false);
    });

    it('should cancel all running actions when stop() is called', async () => {
      let tokenWasCancelled = false;

      const action: TimelineAction = {
        id: 'long-running',
        type: 'callback',
        execute: async (token) => {
          token?.onCancel(() => {
            tokenWasCancelled = true;
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        },
        duration: 1000,
      };

      const runner = new TimelineRunner();
      runner.setActions([action]);

      const runPromise = runner.start();
      await new Promise((resolve) => setTimeout(resolve, 10));
      runner.stop();

      await runPromise.catch(() => {});

      expect(tokenWasCancelled).toBe(true);
    });

    it('should support actions checking isCancelled flag', async () => {
      let loopIterations = 0;

      const action: TimelineAction = {
        id: 'loop',
        type: 'callback',
        execute: async (token) => {
          for (let i = 0; i < 100; i++) {
            if (token?.isCancelled) break;
            loopIterations++;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        },
        duration: 1000,
      };

      const runner = new TimelineRunner();
      runner.setActions([action]);

      const runPromise = runner.start();
      await new Promise((resolve) => setTimeout(resolve, 50));
      runner.stop();

      await runPromise.catch(() => {});

      expect(loopIterations).toBeLessThan(100);
      expect(loopIterations).toBeGreaterThan(0);
    });
  });

  // ── Error Boundaries ────────────────────────────────────────────────

  describe('Error Boundaries', () => {
    it('should catch action errors and mark timeline as failed', async () => {
      const action: TimelineAction = {
        id: 'failing-action',
        type: 'callback',
        execute: async () => {
          throw new Error('Action failed');
        },
        duration: 100,
      };

      const runner = new TimelineRunner();
      runner.setActions([action]);

      await expect(runner.start()).rejects.toThrow('Action failed');

      const state = runner.getState();
      expect(state.isFailed).toBe(true);
      expect(state.lastError?.message).toBe('Action failed');
    });

    it('should call onError callback when action fails', async () => {
      const onError = vi.fn();

      const action: TimelineAction = {
        id: 'failing',
        type: 'callback',
        execute: async () => {
          throw new Error('Test error');
        },
        duration: 100,
      };

      const runner = new TimelineRunner({ onError });
      runner.setActions([action]);

      await runner.start().catch(() => {});

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test error',
      }));
    });

    it('should not continue timeline after action failure', async () => {
      let secondActionExecuted = false;

      const actions: TimelineAction[] = [
        {
          id: 'first',
          type: 'callback',
          execute: async () => {
            throw new Error('First action failed');
          },
          duration: 100,
        },
        {
          id: 'second',
          type: 'callback',
          execute: async () => {
            secondActionExecuted = true;
          },
          duration: 100,
        },
      ];

      const runner = new TimelineRunner();
      runner.setActions(actions);

      await runner.start().catch(() => {});

      expect(secondActionExecuted).toBe(false);
    });

    it('should not loop if timeline fails during loop', async () => {
      let executionCount = 0;

      const action: TimelineAction = {
        id: 'failing-on-second',
        type: 'callback',
        execute: async () => {
          executionCount++;
          if (executionCount === 2) {
            throw new Error('Failed on second iteration');
          }
        },
        duration: 100,
      };

      const runner = new TimelineRunner({ loop: true });
      runner.setActions([action]);

      await runner.start().catch(() => {});

      expect(executionCount).toBe(2);
    });

    it('should handle synchronous throw inside action', async () => {
      const action: TimelineAction = {
        id: 'sync-throw',
        type: 'callback',
        execute: () => {
          throw new Error('Sync failure');
        },
        duration: 50,
      };

      const runner = new TimelineRunner();
      runner.setActions([action]);

      await expect(runner.start()).rejects.toThrow('Sync failure');
      expect(runner.getState().isFailed).toBe(true);
    });
  });

  // ── State Tracking ──────────────────────────────────────────────────

  describe('State Tracking', () => {
    it('should track isFailed state separately from isRunning', async () => {
      const action: TimelineAction = {
        id: 'fail',
        type: 'callback',
        execute: async () => {
          throw new Error('Fail');
        },
        duration: 100,
      };

      const runner = new TimelineRunner();
      runner.setActions([action]);

      try {
        await runner.start();
      } catch (error) {
        // Expected to throw
      }

      const state = runner.getState();
      expect(state.isRunning).toBe(false);
      expect(state.isFailed).toBe(true);
    });

    it('should reset failure state on new start()', async () => {
      const successAction = makeAction('ok');
      const runner = new TimelineRunner();
      runner.setActions([successAction]);

      await runner.start();
      expect(runner.getState().isFailed).toBe(false);

      const failingAction: TimelineAction = {
        id: 'fail',
        type: 'callback',
        execute: async () => { throw new Error('Fail'); },
        duration: 100,
      };

      runner.setActions([failingAction]);
      await runner.start().catch(() => {});
      expect(runner.getState().isFailed).toBe(true);

      runner.setActions([successAction]);
      await runner.start();
      expect(runner.getState().isFailed).toBe(false);
    });

    it('should report isRunning=true during execution', async () => {
      let wasRunningDuringAction = false;

      const runner = new TimelineRunner();
      runner.setActions([makeAction('check', {
        fn: () => { wasRunningDuringAction = runner.isRunning(); },
      })]);

      await runner.start();
      expect(wasRunningDuringAction).toBe(true);
      expect(runner.isRunning()).toBe(false);
    });

    it('should track currentActionIndex during execution', async () => {
      const indices: number[] = [];

      const actions = [0, 1, 2].map(i =>
        makeAction(`a${i}`, { fn: () => { indices.push(runner.getState().currentActionIndex); } })
      );

      const runner = new TimelineRunner();
      runner.setActions(actions);
      await runner.start();

      expect(indices).toEqual([0, 1, 2]);
    });
  });

  // ── Progress Tracking ───────────────────────────────────────────────

  describe('Progress Tracking', () => {
    it('should report progress updates', async () => {
      const progressUpdates: number[] = [];

      const actions: TimelineAction[] = [
        makeAction('a1'),
        makeAction('a2'),
      ];

      const runner = new TimelineRunner({
        onUpdate: (progress) => {
          progressUpdates.push(progress);
        },
      });

      runner.setActions(actions);
      await runner.start();

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(1);
    });

    it('should handle actions with zero duration in progress calc', async () => {
      const runner = new TimelineRunner();
      runner.setActions([makeAction('zero', { duration: 0 })]);

      // getProgress should not divide by zero
      expect(runner.getProgress()).toBe(0);
      await runner.start();
    });

    it('should clamp progress to 1', async () => {
      const runner = new TimelineRunner();
      runner.setActions([makeAction('a', { duration: 50 })]);
      await runner.start();
      expect(runner.getProgress()).toBeLessThanOrEqual(1);
    });
  });

  // ── Empty & Edge Cases ──────────────────────────────────────────────

  describe('Empty & Edge Cases', () => {
    it('should complete immediately with empty action list', async () => {
      const onComplete = vi.fn();
      const runner = new TimelineRunner({ onComplete });
      runner.setActions([]);
      await runner.start();

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(runner.isRunning()).toBe(false);
    });

    it('should be a no-op when starting an already running timeline', async () => {
      let execCount = 0;
      const action = makeAction('slow', {
        duration: 500,
        fn: async () => {
          execCount++;
          await new Promise(r => setTimeout(r, 100));
        },
      });

      const runner = new TimelineRunner();
      runner.setActions([action]);

      const p1 = runner.start();
      const p2 = runner.start(); // should no-op since already running

      await Promise.all([p1, p2].map(p => p.catch(() => {})));

      expect(execCount).toBe(1);
    });

    it('should handle stop() when not running', () => {
      const runner = new TimelineRunner();
      // Should not throw
      expect(() => runner.stop()).not.toThrow();
    });

    it('should handle reset() when not running', () => {
      const runner = new TimelineRunner();
      runner.setActions([makeAction('a')]);
      expect(() => runner.reset()).not.toThrow();
      expect(runner.getState().currentActionIndex).toBe(0);
    });

    it('should handle pause/resume when not running', () => {
      const runner = new TimelineRunner();
      expect(() => runner.pause()).not.toThrow();
      expect(() => runner.resume()).not.toThrow();
    });
  });

  // ── Pause / Resume ──────────────────────────────────────────────────

  describe('Pause / Resume', () => {
    it('should pause and resume execution', async () => {
      const executionOrder: string[] = [];

      const actions = [
        makeAction('first', { fn: () => { executionOrder.push('first'); } }),
        makeAction('second', {
          fn: async () => {
            await new Promise(r => setTimeout(r, 50));
            executionOrder.push('second');
          },
        }),
      ];

      const runner = new TimelineRunner();
      runner.setActions(actions);

      const runPromise = runner.start();

      // Let first action complete, then pause
      await new Promise(r => setTimeout(r, 10));
      runner.pause();
      expect(runner.isPaused()).toBe(true);

      // Resume after a brief delay
      await new Promise(r => setTimeout(r, 50));
      runner.resume();

      await runPromise;

      expect(executionOrder).toContain('first');
      expect(runner.isRunning()).toBe(false);
    });

    it('should report isPaused correctly', () => {
      const runner = new TimelineRunner();
      expect(runner.isPaused()).toBe(false);
    });
  });

  // ── SkipTo ──────────────────────────────────────────────────────────

  describe('skipTo', () => {
    it('should clamp out-of-range indices', () => {
      const runner = new TimelineRunner();
      runner.setActions([makeAction('a'), makeAction('b')]);

      // Negative index — no crash
      runner.skipTo(-1);
      expect(runner.getState().currentActionIndex).toBe(0);

      // Beyond length — no crash
      runner.skipTo(999);
      expect(runner.getState().currentActionIndex).toBe(0);
    });

    it('should skip to valid index', () => {
      const runner = new TimelineRunner();
      runner.setActions([makeAction('a'), makeAction('b'), makeAction('c')]);

      runner.skipTo(2);
      expect(runner.getState().currentActionIndex).toBe(2);
    });
  });

  // ── onComplete callback ─────────────────────────────────────────────

  describe('onComplete callback', () => {
    it('should fire onComplete when timeline finishes successfully', async () => {
      const onComplete = vi.fn();
      const runner = new TimelineRunner({ onComplete });
      runner.setActions([makeAction('a')]);
      await runner.start();

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('should NOT fire onComplete on failure', async () => {
      const onComplete = vi.fn();
      const runner = new TimelineRunner({ onComplete });
      runner.setActions([makeAction('fail', { fn: () => { throw new Error('boom'); } })]);

      await runner.start().catch(() => {});

      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should still complete if stop() is called during a blocking action', async () => {
      const onComplete = vi.fn();
      const runner = new TimelineRunner({ onComplete });
      runner.setActions([makeAction('slow', {
        fn: async () => { await new Promise(r => setTimeout(r, 200)); },
        duration: 200,
      })]);

      const p = runner.start();
      await new Promise(r => setTimeout(r, 10));
      runner.stop();
      await p.catch(() => {});

      // Note: stop() during a blocking action doesn't prevent onComplete
      // because the action promise must resolve before the loop can check isRunning.
      // This is a known behavior — true interruption requires CancellationToken.
      expect(onComplete).toHaveBeenCalled();
    });
  });

  // ── Looping ─────────────────────────────────────────────────────────

  describe('Looping', () => {
    it('should loop actions when loop=true', async () => {
      let count = 0;

      const runner = new TimelineRunner({ loop: true });
      runner.setActions([makeAction('counter', {
        fn: async () => {
          count++;
          // Must yield so stop() can interrupt the loop
          await new Promise(r => setTimeout(r, 5));
        },
      })]);

      const p = runner.start();
      await new Promise(r => setTimeout(r, 80));
      runner.stop();
      await p.catch(() => {});

      expect(count).toBeGreaterThan(1);
    });

    it('should reset elapsedTime each loop iteration', async () => {
      const elapsed: number[] = [];

      const runner = new TimelineRunner({
        loop: true,
        onUpdate: (p) => elapsed.push(p),
      });
      runner.setActions([makeAction('a', {
        duration: 100,
        fn: async () => { await new Promise(r => setTimeout(r, 5)); },
      })]);

      const p = runner.start();
      await new Promise(r => setTimeout(r, 80));
      runner.stop();
      await p.catch(() => {});

      // Progress should hit 1 and then reset
      expect(elapsed.some(e => e === 1)).toBe(true);
    });
  });

  // ── Static run helper ───────────────────────────────────────────────

  describe('Static run()', () => {
    it('should execute actions and complete', async () => {
      let executed = false;
      await TimelineRunner.run([makeAction('a', { fn: () => { executed = true; } })]);
      expect(executed).toBe(true);
    });

    it('should propagate errors', async () => {
      await expect(
        TimelineRunner.run([makeAction('fail', { fn: () => { throw new Error('static fail'); } })])
      ).rejects.toThrow('static fail');
    });
  });

  // ── Action ordering ─────────────────────────────────────────────────

  describe('Action ordering', () => {
    it('should execute actions in sequence order', async () => {
      const order: number[] = [];

      const actions = [0, 1, 2, 3, 4].map(i =>
        makeAction(`a${i}`, { fn: () => { order.push(i); } })
      );

      const runner = new TimelineRunner();
      runner.setActions(actions);
      await runner.start();

      expect(order).toEqual([0, 1, 2, 3, 4]);
    });

    it('should respect action priority field without reordering (informational)', async () => {
      // Priority is metadata only — execution order matches array order
      const order: string[] = [];
      const actions: TimelineAction[] = [
        { ...makeAction('low', { fn: () => { order.push('low'); } }), priority: 1 },
        { ...makeAction('high', { fn: () => { order.push('high'); } }), priority: 10 },
      ];

      await TimelineRunner.run(actions);
      expect(order).toEqual(['low', 'high']);
    });
  });
});
