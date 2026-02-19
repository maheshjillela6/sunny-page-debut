/**
 * EventHistory - Event history buffer
 */

import { EventEnvelope } from './EventEnvelope';

/**
 * Circular buffer for event history.
 */
export class EventHistory {
  private buffer: EventEnvelope[] = [];
  private maxSize: number;
  private pointer: number = 0;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /** Add event to history */
  public push(envelope: EventEnvelope): void {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(envelope);
    } else {
      this.buffer[this.pointer] = envelope;
    }
    this.pointer = (this.pointer + 1) % this.maxSize;
  }

  /** Get all events in order */
  public getAll(): EventEnvelope[] {
    if (this.buffer.length < this.maxSize) {
      return [...this.buffer];
    }

    // Reconstruct order from circular buffer
    return [
      ...this.buffer.slice(this.pointer),
      ...this.buffer.slice(0, this.pointer),
    ];
  }

  /** Get last N events */
  public getLast(count: number): EventEnvelope[] {
    const all = this.getAll();
    return all.slice(-count);
  }

  /** Get events by type */
  public getByType(type: string): EventEnvelope[] {
    return this.getAll().filter(e => e.type === type);
  }

  /** Get size */
  public size(): number {
    return this.buffer.length;
  }

  /** Clear history */
  public clear(): void {
    this.buffer = [];
    this.pointer = 0;
  }
}
