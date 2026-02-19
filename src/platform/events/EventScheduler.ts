/**
 * EventScheduler - Schedules events for future execution
 */

import { EventBus } from './EventBus';
import { EventMap } from './EventMap';

interface ScheduledEvent {
  id: string;
  type: keyof EventMap;
  payload: unknown;
  executeAt: number;
  repeat?: {
    interval: number;
    remaining: number;
  };
}

/**
 * Schedules events for delayed or repeated execution.
 */
export class EventScheduler {
  private scheduledEvents: Map<string, ScheduledEvent> = new Map();
  private eventBus: EventBus;
  private idCounter: number = 0;
  private tickCallback: (() => void) | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Schedule an event to fire after a delay
   */
  public schedule<K extends keyof EventMap>(
    type: K,
    payload: EventMap[K],
    delayMs: number
  ): string {
    const id = `sched_${++this.idCounter}`;
    
    this.scheduledEvents.set(id, {
      id,
      type,
      payload,
      executeAt: Date.now() + delayMs,
    });

    return id;
  }

  /**
   * Schedule a repeating event
   */
  public scheduleRepeat<K extends keyof EventMap>(
    type: K,
    payload: EventMap[K],
    intervalMs: number,
    count: number = Infinity
  ): string {
    const id = `sched_${++this.idCounter}`;
    
    this.scheduledEvents.set(id, {
      id,
      type,
      payload,
      executeAt: Date.now() + intervalMs,
      repeat: {
        interval: intervalMs,
        remaining: count,
      },
    });

    return id;
  }

  /**
   * Cancel a scheduled event
   */
  public cancel(id: string): boolean {
    return this.scheduledEvents.delete(id);
  }

  /**
   * Cancel all scheduled events
   */
  public cancelAll(): void {
    this.scheduledEvents.clear();
  }

  /**
   * Update scheduled events (call each frame)
   */
  public update(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, event] of this.scheduledEvents) {
      if (now >= event.executeAt) {
        // Execute event
        this.eventBus.emit(event.type, event.payload as EventMap[typeof event.type]);

        if (event.repeat && event.repeat.remaining > 1) {
          // Reschedule
          event.executeAt = now + event.repeat.interval;
          event.repeat.remaining--;
        } else {
          toRemove.push(id);
        }
      }
    }

    for (const id of toRemove) {
      this.scheduledEvents.delete(id);
    }
  }

  /**
   * Get scheduled event count
   */
  public getScheduledCount(): number {
    return this.scheduledEvents.size;
  }

  /**
   * Check if event is scheduled
   */
  public isScheduled(id: string): boolean {
    return this.scheduledEvents.has(id);
  }

  /**
   * Clear all scheduled events
   */
  public clear(): void {
    this.scheduledEvents.clear();
  }
}
