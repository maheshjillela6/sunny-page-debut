/**
 * EventTimeline - Records event timeline for debugging/replay
 */

import { EventEnvelope } from './EventEnvelope';

export interface TimelineEntry {
  envelope: EventEnvelope;
  relativeTime: number;
}

/**
 * Records event timeline for debugging and replay.
 */
export class EventTimeline {
  private entries: TimelineEntry[] = [];
  private startTime: number = 0;
  private isRecording: boolean = false;
  private maxEntries: number = 1000;

  /** Start recording */
  public startRecording(): void {
    this.entries = [];
    this.startTime = Date.now();
    this.isRecording = true;
  }

  /** Stop recording */
  public stopRecording(): void {
    this.isRecording = false;
  }

  /** Record an event */
  public record(envelope: EventEnvelope): void {
    if (!this.isRecording) return;

    const entry: TimelineEntry = {
      envelope,
      relativeTime: Date.now() - this.startTime,
    };

    this.entries.push(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /** Get all entries */
  public getEntries(): TimelineEntry[] {
    return [...this.entries];
  }

  /** Get entries by type */
  public getEntriesByType(type: string): TimelineEntry[] {
    return this.entries.filter(e => e.envelope.type === type);
  }

  /** Get entries in time range */
  public getEntriesInRange(startMs: number, endMs: number): TimelineEntry[] {
    return this.entries.filter(
      e => e.relativeTime >= startMs && e.relativeTime <= endMs
    );
  }

  /** Get timeline duration */
  public getDuration(): number {
    if (this.entries.length === 0) return 0;
    return this.entries[this.entries.length - 1].relativeTime;
  }

  /** Clear timeline */
  public clear(): void {
    this.entries = [];
    this.startTime = 0;
  }

  /** Export timeline as JSON */
  public export(): string {
    return JSON.stringify(this.entries.map(e => ({
      type: e.envelope.type,
      payload: e.envelope.payload,
      relativeTime: e.relativeTime,
    })));
  }

  /** Check if recording */
  public getIsRecording(): boolean {
    return this.isRecording;
  }
}
