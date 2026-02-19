/**
 * ReplayPlayer - Unit Tests
 * Verifies isolated replay context, sequence-based playback, and contamination prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplayPlayer } from '../ReplayPlayer';
import { ReplaySession } from '../ReplayRecorder';
import { EventBus } from '../../../platform/events/EventBus';

describe('ReplayPlayer', () => {
  let player: ReplayPlayer;

  beforeEach(() => {
    ReplayPlayer.reset();
    player = ReplayPlayer.getInstance();
  });

  describe('Isolated Replay Context', () => {
    it('should use isolated EventBus for replay events', () => {
      const mainBus = EventBus.getInstance();
      const mainCalls: number[] = [];

      mainBus.on('engine:init', () => {
        mainCalls.push(1);
      });

      const session: ReplaySession = {
        id: 'test-session',
        gameId: 'game-1',
        startTime: Date.now(),
        events: [
          {
            timestamp: 0,
            sequence: 1,
            type: 'engine:init',
            payload: { timestamp: 1 },
          },
        ],
        metadata: {
          initialBalance: 100,
          bet: 10,
        },
      };

      player.loadSession(session);
      player.play({ speed: 1000 }); // Very fast

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Main bus should NOT receive replay events
          expect(mainCalls).toHaveLength(0);
          resolve();
        }, 100);
      });
    });

    it('should allow subscribing to replay events via onReplayEvent', () => {
      const replayCalls: number[] = [];

      player.onReplayEvent('engine:init', () => {
        replayCalls.push(1);
      });

      const session: ReplaySession = {
        id: 'test',
        gameId: 'g1',
        startTime: Date.now(),
        events: [
          {
            timestamp: 0,
            sequence: 1,
            type: 'engine:init',
            payload: { timestamp: 1 },
          },
        ],
        metadata: { initialBalance: 100, bet: 10 },
      };

      player.loadSession(session);
      player.play({ speed: 1000 });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(replayCalls).toHaveLength(1);
          resolve();
        }, 100);
      });
    });

    it('should provide access to isolated replay bus', () => {
      const replayBus = player.getReplayBus();
      const mainBus = EventBus.getInstance();

      // They should be different instances
      expect(replayBus).not.toBe(mainBus);
    });
  });

  describe('Sequence-Based Playback', () => {
    it('should play events in sequence order, not timestamp order', async () => {
      const playbackOrder: number[] = [];

      player.onReplayEvent('engine:init', (payload: any) => {
        playbackOrder.push(payload.value);
      });

      // Events with out-of-order timestamps but correct sequence
      const session: ReplaySession = {
        id: 'test',
        gameId: 'g1',
        startTime: Date.now(),
        events: [
          {
            timestamp: 200, // Later timestamp
            sequence: 1,    // But sequence 1
            type: 'engine:init',
            payload: { value: 1 },
          },
          {
            timestamp: 50,  // Earlier timestamp
            sequence: 3,    // But sequence 3
            type: 'engine:init',
            payload: { value: 3 },
          },
          {
            timestamp: 100,
            sequence: 2,
            type: 'engine:init',
            payload: { value: 2 },
          },
        ],
        metadata: { initialBalance: 100, bet: 10 },
      };

      player.loadSession(session);
      player.play({ speed: 1000 });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should be in sequence order: 1, 2, 3
          expect(playbackOrder).toEqual([1, 2, 3]);
          resolve();
        }, 200);
      });
    });
  });

  describe('Duration Compensation', () => {
    it('should track compensated time for accurate turbo mode', async () => {
      player.onReplayEvent('engine:init', () => {});

      const session: ReplaySession = {
        id: 'test',
        gameId: 'g1',
        startTime: Date.now(),
        events: [
          { timestamp: 0, sequence: 1, type: 'engine:init', payload: {} },
          { timestamp: 1000, sequence: 2, type: 'engine:init', payload: {} },
        ],
        metadata: { initialBalance: 100, bet: 10 },
      };

      player.loadSession(session);
      player.setSpeed(10); // 10x speed
      player.play();

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const state = player.getState();
          // Should have compensatedTime tracked
          expect(state.compensatedTime).toBeGreaterThan(0);
          resolve();
        }, 200);
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should report progress during playback', async () => {
      const progressUpdates: number[] = [];

      const session: ReplaySession = {
        id: 'test',
        gameId: 'g1',
        startTime: Date.now(),
        events: [
          { timestamp: 0, sequence: 1, type: 'engine:init', payload: {} },
          { timestamp: 50, sequence: 2, type: 'engine:init', payload: {} },
          { timestamp: 100, sequence: 3, type: 'engine:init', payload: {} },
        ],
        metadata: { initialBalance: 100, bet: 10 },
      };

      player.loadSession(session);
      player.play({
        speed: 1000,
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(progressUpdates.length).toBeGreaterThan(0);
          // Last progress should be 1.0
          expect(progressUpdates[progressUpdates.length - 1]).toBe(1);
          resolve();
        }, 200);
      });
    });
  });
});
