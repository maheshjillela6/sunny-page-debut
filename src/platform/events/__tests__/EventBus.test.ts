/**
 * EventBus - Unit Tests
 * Verifies sequence ordering, priority resolution, and isolated instances
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../EventBus';
import { EventEnvelope } from '../EventEnvelope';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    // Reset singleton and sequence before each test
    EventBus.getInstance().destroy();
    EventEnvelope.resetSequence();
    eventBus = EventBus.getInstance();
  });

  afterEach(() => {
    eventBus.destroy();
  });

  describe('Sequence Numbers', () => {
    it('should assign incremental sequence numbers to events', () => {
      const sequences: number[] = [];
      
      eventBus.on('engine:init', (payload, envelope) => {
        sequences.push(envelope.sequence);
      });

      eventBus.emit('engine:init', { timestamp: Date.now() });
      eventBus.emit('engine:init', { timestamp: Date.now() });
      eventBus.emit('engine:init', { timestamp: Date.now() });

      expect(sequences).toHaveLength(3);
      expect(sequences[0]).toBeLessThan(sequences[1]);
      expect(sequences[1]).toBeLessThan(sequences[2]);
    });

    it('should maintain sequence order across different event types', () => {
      const eventLog: Array<{ type: string; seq: number }> = [];

      eventBus.on('engine:init', (_, env) => {
        eventLog.push({ type: 'engine:init', seq: env.sequence });
      });

      eventBus.on('engine:ready', (_, env) => {
        eventLog.push({ type: 'engine:ready', seq: env.sequence });
      });

      eventBus.emit('engine:init', { timestamp: 1 });
      eventBus.emit('engine:ready', { timestamp: 2 });
      eventBus.emit('engine:init', { timestamp: 3 });

      // Verify global ordering
      expect(eventLog[0].seq).toBe(1);
      expect(eventLog[1].seq).toBe(2);
      expect(eventLog[2].seq).toBe(3);
    });
  });

  describe('Priority Resolution', () => {
    it('should execute high-priority handlers before low-priority', () => {
      const executionOrder: string[] = [];

      eventBus.on('engine:init', () => { executionOrder.push('low'); }, 0);
      eventBus.on('engine:init', () => { executionOrder.push('high'); }, 10);
      eventBus.on('engine:init', () => { executionOrder.push('medium'); }, 5);

      eventBus.emit('engine:init', { timestamp: Date.now() });

      expect(executionOrder).toEqual(['high', 'medium', 'low']);
    });

    it('should resolve same-priority ties using insertion order (default)', () => {
      const executionOrder: number[] = [];

      eventBus.on('engine:init', () => { executionOrder.push(1); }, 5);
      eventBus.on('engine:init', () => { executionOrder.push(2); }, 5);
      eventBus.on('engine:init', () => { executionOrder.push(3); }, 5);

      eventBus.emit('engine:init', { timestamp: Date.now() });

      // Default tie-breaker: insertion-order (first subscribed = first executed)
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should resolve same-priority ties using reverse-insertion when configured', () => {
      const executionOrder: number[] = [];

      eventBus.setPriorityTieBreaker('reverse-insertion');

      eventBus.on('engine:init', () => { executionOrder.push(1); }, 5);
      eventBus.on('engine:init', () => { executionOrder.push(2); }, 5);
      eventBus.on('engine:init', () => { executionOrder.push(3); }, 5);

      eventBus.emit('engine:init', { timestamp: Date.now() });

      // Reverse tie-breaker: last subscribed = first executed
      expect(executionOrder).toEqual([3, 2, 1]);
    });
  });

  describe('Isolated Instances', () => {
    it('should create truly isolated EventBus instances', () => {
      const isolated1 = EventBus.createIsolated();
      const isolated2 = EventBus.createIsolated();
      const main = EventBus.getInstance();

      const mainCalls: number[] = [];
      const iso1Calls: number[] = [];
      const iso2Calls: number[] = [];

      main.on('engine:init', () => { mainCalls.push(1); });
      isolated1.on('engine:init', () => { iso1Calls.push(1); });
      isolated2.on('engine:init', () => { iso2Calls.push(1); });

      // Emit on main
      main.emit('engine:init', { timestamp: 1 });
      expect(mainCalls).toHaveLength(1);
      expect(iso1Calls).toHaveLength(0);
      expect(iso2Calls).toHaveLength(0);

      // Emit on isolated1
      isolated1.emit('engine:init', { timestamp: 2 });
      expect(mainCalls).toHaveLength(1);
      expect(iso1Calls).toHaveLength(1);
      expect(iso2Calls).toHaveLength(0);

      // Emit on isolated2
      isolated2.emit('engine:init', { timestamp: 3 });
      expect(mainCalls).toHaveLength(1);
      expect(iso1Calls).toHaveLength(1);
      expect(iso2Calls).toHaveLength(1);
    });

    it('should allow isolated instances to be destroyed independently', () => {
      const isolated = EventBus.createIsolated();
      const calls: number[] = [];

      isolated.on('engine:init', () => { calls.push(1); });
      isolated.emit('engine:init', { timestamp: 1 });
      expect(calls).toHaveLength(1);

      isolated.destroy();

      // Main instance should still work
      eventBus.emit('engine:init', { timestamp: 2 });
      // (no error thrown)
    });
  });

  describe('Error Handling', () => {
    it('should catch handler errors and continue processing', () => {
      const executionOrder: string[] = [];

      eventBus.on('engine:init', () => {
        executionOrder.push('first');
        throw new Error('Handler failed');
      });

      eventBus.on('engine:init', () => {
        executionOrder.push('second');
      });

      // Should not throw
      expect(() => {
        eventBus.emit('engine:init', { timestamp: 1 });
      }).not.toThrow();

      // Second handler should still execute
      expect(executionOrder).toEqual(['first', 'second']);
    });
  });

  describe('Event History', () => {
    it('should store events in history with sequence metadata', () => {
      eventBus.emit('engine:init', { timestamp: 1 });
      eventBus.emit('engine:ready', { timestamp: 2 });

      const history = eventBus.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('engine:init');
      expect(history[1].type).toBe('engine:ready');
      expect(history[0].sequence).toBeLessThan(history[1].sequence);
    });

    it('should limit history to maxHistoryLength', () => {
      const bus = EventBus.createIsolated();

      // Emit 150 events (max is 100)
      for (let i = 0; i < 150; i++) {
        bus.emit('engine:init', { timestamp: i });
      }

      const history = bus.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });
});
