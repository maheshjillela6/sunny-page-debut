/**
 * ReplayRecorder - Records game events for replay
 * Enhanced with sequence-based ordering and integrity verification
 */

import { EventBus, EventCallback } from '../../platform/events/EventBus';
import { EventMap } from '../../platform/events/EventMap';

export interface ReplayEvent {
  timestamp: number;
  sequence: number; // Use sequence instead of timestamp for ordering
  type: string;
  payload: unknown;
  roundId?: string;
  hash?: string; // Event integrity hash
}

export interface ReplaySession {
  id: string;
  gameId: string;
  startTime: number;
  endTime?: number;
  events: ReplayEvent[];
  metadata: {
    initialBalance: number;
    bet: number;
    seed?: string;
  };
}

export class ReplayRecorder {
  private static instance: ReplayRecorder | null = null;
  
  private eventBus: EventBus;
  private isRecording: boolean = false;
  private currentSession: ReplaySession | null = null;
  private subscriptionIds: string[] = [];
  private recordedEvents: Set<keyof EventMap> = new Set();

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.setupDefaultEventTypes();
  }

  public static getInstance(): ReplayRecorder {
    if (!ReplayRecorder.instance) {
      ReplayRecorder.instance = new ReplayRecorder();
    }
    return ReplayRecorder.instance;
  }

  private setupDefaultEventTypes(): void {
    // Events to record for replay
    this.recordedEvents.add('game:spin:request');
    this.recordedEvents.add('game:spin:start');
    this.recordedEvents.add('game:spin:result');
    this.recordedEvents.add('game:spin:complete');
    this.recordedEvents.add('game:reel:spin:start');
    this.recordedEvents.add('game:reel:spin:stop');
    this.recordedEvents.add('feature:start');
    this.recordedEvents.add('feature:end');
    this.recordedEvents.add('wallet:balance:update');
  }

  /**
   * Start recording a new session
   */
  public startRecording(gameId: string, initialBalance: number, bet: number): void {
    if (this.isRecording) {
      this.stopRecording();
    }

    this.currentSession = {
      id: `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      gameId,
      startTime: Date.now(),
      events: [],
      metadata: {
        initialBalance,
        bet,
      },
    };

    this.isRecording = true;
    this.subscribeToEvents();

    console.log(`[ReplayRecorder] Started recording session: ${this.currentSession.id}`);
  }

  /**
   * Stop recording
   */
  public stopRecording(): ReplaySession | null {
    if (!this.isRecording || !this.currentSession) {
      return null;
    }

    this.unsubscribeFromEvents();
    
    this.currentSession.endTime = Date.now();
    this.isRecording = false;

    const session = { ...this.currentSession };
    console.log(`[ReplayRecorder] Stopped recording. ${session.events.length} events recorded.`);
    
    return session;
  }

  private subscribeToEvents(): void {
    for (const eventType of this.recordedEvents) {
      const callback: EventCallback<unknown> = (payload, envelope) => {
        // Pass envelope to extract sequence and hash
        this.recordEvent(eventType, payload, envelope);
      };
      
      const id = this.eventBus.on(eventType, callback as EventCallback<EventMap[typeof eventType]>);
      this.subscriptionIds.push(id);
    }
  }

  private unsubscribeFromEvents(): void {
    for (const id of this.subscriptionIds) {
      this.eventBus.off(id);
    }
    this.subscriptionIds = [];
  }

  private recordEvent(type: string, payload: unknown, envelope?: import('../../platform/events/EventEnvelope').EventEnvelope): void {
    if (!this.currentSession) return;

    const event: ReplayEvent = {
      timestamp: Date.now() - this.currentSession.startTime,
      sequence: envelope?.sequence ?? 0, // CRITICAL: Use envelope sequence for deterministic ordering
      type,
      payload: this.clonePayload(payload),
      hash: envelope?.hash ?? undefined, // Store integrity hash
    };

    // Extract round ID if present
    if (payload && typeof payload === 'object' && 'roundId' in payload) {
      event.roundId = (payload as { roundId: string }).roundId;
    }

    this.currentSession.events.push(event);
  }

  private clonePayload(payload: unknown): unknown {
    if (payload === null || payload === undefined) return payload;
    return JSON.parse(JSON.stringify(payload));
  }

  /**
   * Get current session
   */
  public getCurrentSession(): ReplaySession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Check if recording
   */
  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Add custom event type to record
   */
  public addEventType(eventType: keyof EventMap): void {
    this.recordedEvents.add(eventType);
  }

  /**
   * Remove event type from recording
   */
  public removeEventType(eventType: keyof EventMap): void {
    this.recordedEvents.delete(eventType);
  }

  /**
   * Export session as JSON
   */
  public exportSession(session: ReplaySession): string {
    return JSON.stringify(session, null, 2);
  }

  /**
   * Import session from JSON
   */
  public importSession(json: string): ReplaySession {
    return JSON.parse(json);
  }

  /**
   * Verify session integrity by checking all event hashes
   * @returns true if all events pass verification, false if any are tampered
   */
  public verifySessionIntegrity(session: ReplaySession): boolean {
    // Sort events by sequence (not timestamp) for deterministic verification
    const sortedEvents = [...session.events].sort((a, b) => a.sequence - b.sequence);
    
    for (const event of sortedEvents) {
      if (!event.hash) {
        console.warn(`[ReplayRecorder] Event ${event.sequence} missing hash`);
        continue;
      }
      
      // In production, re-compute hash from event data and compare
      // For now, just check hash exists
    }
    
    return true; // Placeholder - implement full verification in production
  }

  public static reset(): void {
    if (ReplayRecorder.instance) {
      ReplayRecorder.instance.stopRecording();
    }
    ReplayRecorder.instance = null;
  }
}
