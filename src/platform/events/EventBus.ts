/**
 * EventBus - Central event system
 * Type-safe pub/sub event system for game-wide communication.
 * Enhanced with priority conflict resolution for deterministic execution.
 */

import { EventMap, GameEventType } from './EventMap';
import { EventEnvelope } from './EventEnvelope';

export type EventCallback<T = unknown> = (payload: T, envelope: EventEnvelope) => void;

export type PriorityTieBreaker = 'insertion-order' | 'reverse-insertion' | 'stable-sort';

interface EventSubscription {
  id: string;
  callback: EventCallback<unknown>;
  once: boolean;
  priority: number;
  insertionIndex: number; // Track insertion order for tie-breaking
}

/**
 * Central event bus for type-safe game-wide communication.
 */
export class EventBus {
  private static instance: EventBus | null = null;
  private static allowDirectInstantiation: boolean = false; // Allow ReplayPlayer to create shadow instance

  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private subscriptionIdCounter: number = 0;
  private insertionCounter: number = 0; // Global insertion counter for tie-breaking
  private eventHistory: EventEnvelope[] = [];
  private maxHistoryLength: number = 100;
  private isProcessing: boolean = false;
  private pendingEvents: { envelope: EventEnvelope }[] = [];
  private priorityTieBreaker: PriorityTieBreaker = 'insertion-order'; // Configurable tie-breaker

  private constructor() {
    if (!EventBus.allowDirectInstantiation && EventBus.instance !== null) {
      throw new Error('Use EventBus.getInstance() or EventBus.createIsolated()');
    }
  }

  /** Get singleton instance */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.allowDirectInstantiation = true;
      EventBus.instance = new EventBus();
      EventBus.allowDirectInstantiation = false;
    }
    return EventBus.instance;
  }

  /**
   * Create an isolated EventBus instance (for replay, testing, etc.)
   * This is NOT a singleton and does not interfere with the main instance
   */
  public static createIsolated(): EventBus {
    EventBus.allowDirectInstantiation = true;
    const isolated = new EventBus();
    EventBus.allowDirectInstantiation = false;
    return isolated;
  }

  /**
   * Subscribe to an event
   */
  public on<K extends keyof EventMap>(
    type: K,
    callback: EventCallback<EventMap[K]>,
    priority: number = 0
  ): string {
    return this.subscribe(type as string, callback as EventCallback<unknown>, false, priority);
  }

  /**
   * Subscribe to an event (fires once)
   */
  public once<K extends keyof EventMap>(
    type: K,
    callback: EventCallback<EventMap[K]>,
    priority: number = 0
  ): string {
    return this.subscribe(type as string, callback as EventCallback<unknown>, true, priority);
  }

  /**
   * Unsubscribe from an event
   */
  public off(subscriptionId: string): boolean {
    for (const [type, subs] of this.subscriptions) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Emit an event
   */
  public emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const envelope = new EventEnvelope(type as string, payload);

    // Add to history (circular buffer already implemented in EventHistory)
    this.eventHistory.push(envelope);
    if (this.eventHistory.length > this.maxHistoryLength) {
      this.eventHistory.shift(); // O(n) operation - acceptable for maxHistory=100
    }

    // Queue if processing - preserve the *original* envelope for determinism/audit
    if (this.isProcessing) {
      this.pendingEvents.push({ envelope });
      return;
    }

    this.processEvent(type as string, payload, envelope);
  }

  /**
   * Process an event
   */
  private processEvent(type: string, payload: unknown, envelope: EventEnvelope): void {
    const subs = this.subscriptions.get(type);
    if (!subs || subs.length === 0) return;

    this.isProcessing = true;

    // Sort by priority (higher first), then by tie-breaker strategy
    const sortedSubs = this.sortSubscriptionsByPriority([...subs]);
    const toRemove: string[] = [];

    for (const sub of sortedSubs) {
      if (envelope.isStopped()) break;

      try {
        sub.callback(payload, envelope);

        // stopPropagation: stop notifying lower-priority handlers
        if (envelope.isPropagationStopped()) break;

        if (sub.once) {
          toRemove.push(sub.id);
        }
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${type}:`, error);
      }
    }

    // Remove once handlers
    for (const id of toRemove) {
      this.off(id);
    }

    this.isProcessing = false;

    // Process pending events
    while (this.pendingEvents.length > 0) {
      const pending = this.pendingEvents.shift()!;
      this.processEvent(pending.envelope.type, pending.envelope.payload, pending.envelope);
    }
  }

  /**
   * Sort subscriptions by priority with configurable tie-breaking
   */
  private sortSubscriptionsByPriority(subs: EventSubscription[]): EventSubscription[] {
    return subs.sort((a, b) => {
      // Primary sort: higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
        // Secondary sort: tie-breaker strategy (must be deterministic)
        switch (this.priorityTieBreaker) {
          case 'insertion-order':
            return a.insertionIndex - b.insertionIndex; // Earlier insertion first
          case 'reverse-insertion':
            return b.insertionIndex - a.insertionIndex; // Later insertion first
          case 'stable-sort':
          default:
            // Explicitly stable + deterministic across runtimes
            return a.insertionIndex - b.insertionIndex;
        }
    });
  }

  /**
   * Internal subscribe method
   */
  private subscribe(
    type: string,
    callback: EventCallback<unknown>,
    once: boolean,
    priority: number
  ): string {
    const id = `sub_${++this.subscriptionIdCounter}`;
    
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, []);
    }

    this.subscriptions.get(type)!.push({
      id,
      callback,
      once,
      priority,
      insertionIndex: ++this.insertionCounter, // Track insertion order
    });

    return id;
  }

  /**
   * Clear all subscriptions for an event type
   */
  public clearType(type: keyof EventMap): void {
    this.subscriptions.delete(type as string);
  }

  /**
   * Clear all subscriptions
   */
  public clearAll(): void {
    this.subscriptions.clear();
  }

  /**
   * Get event history
   */
  public getHistory(): EventEnvelope[] {
    return [...this.eventHistory];
  }

  /**
   * Get subscription count for a type
   */
  public getSubscriptionCount(type: keyof EventMap): number {
    return this.subscriptions.get(type as string)?.length ?? 0;
  }

  /**
   * Check if event type has subscribers
   */
  public hasSubscribers(type: keyof EventMap): boolean {
    return this.getSubscriptionCount(type) > 0;
  }

  /**
   * Set priority tie-breaker strategy
   * @param strategy - How to resolve subscribers with same priority
   */
  public setPriorityTieBreaker(strategy: PriorityTieBreaker): void {
    this.priorityTieBreaker = strategy;
    console.log(`[EventBus] Priority tie-breaker set to: ${strategy}`);
  }

  /**
   * Get current tie-breaker strategy
   */
  public getPriorityTieBreaker(): PriorityTieBreaker {
    return this.priorityTieBreaker;
  }

  /**
   * Reset the event bus
   */
  public reset(): void {
    this.subscriptions.clear();
    this.eventHistory = [];
    this.pendingEvents = [];
    this.isProcessing = false;
    this.insertionCounter = 0;
  }

  /**
   * Destroy the event bus
   */
  public destroy(): void {
    this.reset();
    EventBus.instance = null;
  }
}
