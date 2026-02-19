/**
 * EventEnvelope - Unit Tests
 * Verifies sequence numbers, integrity hashing, and verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventEnvelope } from '../EventEnvelope';

describe('EventEnvelope', () => {
  beforeEach(() => {
    // Reset sequence counter before each test
    EventEnvelope.resetSequence();
  });

  describe('Sequence Numbers', () => {
    it('should assign sequential numbers to envelopes', () => {
      const env1 = new EventEnvelope('test', { data: 1 });
      const env2 = new EventEnvelope('test', { data: 2 });
      const env3 = new EventEnvelope('test', { data: 3 });

      expect(env1.sequence).toBe(1);
      expect(env2.sequence).toBe(2);
      expect(env3.sequence).toBe(3);
    });

    it('should maintain sequence across different event types', () => {
      const env1 = new EventEnvelope('type-a', {});
      const env2 = new EventEnvelope('type-b', {});
      const env3 = new EventEnvelope('type-a', {});

      expect(env1.sequence).toBe(1);
      expect(env2.sequence).toBe(2);
      expect(env3.sequence).toBe(3);
    });

    it('should reset sequence when resetSequence() is called', () => {
      new EventEnvelope('test', {});
      new EventEnvelope('test', {});

      expect(EventEnvelope.getCurrentSequence()).toBe(2);

      EventEnvelope.resetSequence();

      const env = new EventEnvelope('test', {});
      expect(env.sequence).toBe(1);
    });

    it('should include sequence in toJSON()', () => {
      const env = new EventEnvelope('test', { data: 123 });
      const json = env.toJSON();

      expect(json.sequence).toBeDefined();
      expect(json.sequence).toBe(env.sequence);
    });
  });

  describe('Integrity Hashing', () => {
    it('should compute hash by default', () => {
      const env = new EventEnvelope('test', { data: 'hello' });

      expect(env.hash).toBeDefined();
      expect(env.hash).not.toBe('');
    });

    it('should skip hash when skipHash=true', () => {
      const env = new EventEnvelope('test', { data: 'hello' }, { skipHash: true });

      expect(env.hash).toBeNull();
    });

    it('should produce same hash for identical payloads', () => {
      const payload = { data: 'test', value: 123 };
      
      EventEnvelope.resetSequence();
      const env1 = new EventEnvelope('type', payload);
      
      EventEnvelope.resetSequence();
      const env2 = new EventEnvelope('type', payload);

      expect(env1.hash).toBe(env2.hash);
    });

    it('should produce different hashes for different payloads', () => {
      const env1 = new EventEnvelope('test', { data: 'A' });
      const env2 = new EventEnvelope('test', { data: 'B' });

      expect(env1.hash).not.toBe(env2.hash);
    });

    it('should include sequence in hash computation', () => {
      const payload = { data: 'same' };
      
      const env1 = new EventEnvelope('type', payload);
      const env2 = new EventEnvelope('type', payload);

      // Different sequences → different hashes
      expect(env1.hash).not.toBe(env2.hash);
    });
  });

  describe('Integrity Verification', () => {
    it('should verify integrity for unmodified envelope', () => {
      const env = new EventEnvelope('test', { data: 'hello' });

      expect(env.verifyIntegrity()).toBe(true);
    });

    it('should fail verification if hash is null', () => {
      const env = new EventEnvelope('test', { data: 'hello' }, { skipHash: true });

      expect(env.verifyIntegrity()).toBe(false);
    });

    // Note: In real implementation with crypto.subtle, you'd test payload tampering
    // For now, we just verify the method exists and works with the sync hash
  });

  describe('Clone', () => {
    it('should create independent copy', () => {
      const original = new EventEnvelope('test', { data: 'original' });
      const cloned = original.clone();

      expect(cloned.type).toBe(original.type);
      expect(cloned.payload).toEqual(original.payload);
      expect(cloned.id).not.toBe(original.id); // Different IDs
    });
  });

  describe('Event Control', () => {
    it('should track stopped state', () => {
      const env = new EventEnvelope('test', {});

      expect(env.isStopped()).toBe(false);

      env.stop();

      expect(env.isStopped()).toBe(true);
    });

    it('should track propagation stopped state', () => {
      const env = new EventEnvelope('test', {});

      expect(env.isPropagationStopped()).toBe(false);

      env.stopPropagation();

      expect(env.isPropagationStopped()).toBe(true);
    });
  });
});
