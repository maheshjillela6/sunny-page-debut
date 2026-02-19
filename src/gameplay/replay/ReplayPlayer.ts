/**
 * ReplayPlayer - Plays back recorded game sessions
 * Enhanced with isolated event context to prevent live game contamination
 */

import { EventBus } from '../../platform/events/EventBus';
import { ReplaySession, ReplayEvent } from './ReplayRecorder';
import { EventMap } from '../../platform/events/EventMap';

export interface ReplayState {
  isPlaying: boolean;
  isPaused: boolean;
  currentEventIndex: number;
  elapsedTime: number;
  playbackSpeed: number;
  compensatedTime: number; // Track compensated time for turbo/skip accuracy
}

export interface ReplayPlayerConfig {
  speed: number;
  onEventPlayed?: (event: ReplayEvent) => void;
  onComplete?: () => void;
  onProgress?: (progress: number) => void;
}

export class ReplayPlayer {
  private static instance: ReplayPlayer | null = null;
  
  private eventBus: EventBus; // Live event bus (for monitoring only)
  private replayBus: EventBus; // Isolated shadow bus for replay events
  private session: ReplaySession | null = null;
  private state: ReplayState;
  private config: ReplayPlayerConfig;
  private playbackTimer: number | null = null;
  private startTime: number = 0;

  private constructor() {
    this.eventBus = EventBus.getInstance(); // Keep reference for compatibility
    this.replayBus = EventBus.createIsolated(); // Create isolated shadow bus
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentEventIndex: 0,
      elapsedTime: 0,
      playbackSpeed: 1,
      compensatedTime: 0,
    };
    this.config = {
      speed: 1,
    };
    
    console.log('[ReplayPlayer] Initialized with isolated replay context');
  }

  public static getInstance(): ReplayPlayer {
    if (!ReplayPlayer.instance) {
      ReplayPlayer.instance = new ReplayPlayer();
    }
    return ReplayPlayer.instance;
  }

  /**
   * Load a replay session
   */
  public loadSession(session: ReplaySession): void {
    this.session = session;
    this.reset();
    console.log(`[ReplayPlayer] Loaded session: ${session.id} with ${session.events.length} events`);
  }

  /**
   * Start playback
   */
  public play(config?: Partial<ReplayPlayerConfig>): void {
    if (!this.session || this.state.isPlaying) return;

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.playbackSpeed = this.config.speed;
    this.startTime = Date.now() - this.state.elapsedTime;

    this.scheduleNextEvent();
    console.log('[ReplayPlayer] Playback started');
  }

  /**
   * Pause playback
   */
  public pause(): void {
    if (!this.state.isPlaying) return;
    
    this.state.isPaused = true;
    this.clearTimer();
    console.log('[ReplayPlayer] Playback paused');
  }

  /**
   * Resume playback
   */
  public resume(): void {
    if (!this.state.isPlaying || !this.state.isPaused) return;

    this.state.isPaused = false;
    this.startTime = Date.now() - this.state.elapsedTime;
    this.scheduleNextEvent();
    console.log('[ReplayPlayer] Playback resumed');
  }

  /**
   * Stop playback
   */
  public stop(): void {
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.clearTimer();
    console.log('[ReplayPlayer] Playback stopped');
  }

  /**
   * Reset to beginning
   */
  public reset(): void {
    this.stop();
    this.state.currentEventIndex = 0;
    this.state.elapsedTime = 0;
  }

  /**
   * Set playback speed
   */
  public setSpeed(speed: number): void {
    this.state.playbackSpeed = speed;
    this.config.speed = speed;
    
    if (this.state.isPlaying && !this.state.isPaused) {
      this.clearTimer();
      this.scheduleNextEvent();
    }
  }

  /**
   * Skip to a specific event
   */
  public skipToEvent(index: number): void {
    if (!this.session) return;
    
    if (index >= 0 && index < this.session.events.length) {
      this.state.currentEventIndex = index;
      if (index > 0) {
        this.state.elapsedTime = this.session.events[index - 1].timestamp;
      } else {
        this.state.elapsedTime = 0;
      }
    }
  }

  /**
   * Skip to a specific time
   */
  public skipToTime(timeMs: number): void {
    if (!this.session) return;

    const targetIndex = this.session.events.findIndex(e => e.timestamp >= timeMs);
    if (targetIndex !== -1) {
      this.skipToEvent(targetIndex);
    }
  }

  private scheduleNextEvent(): void {
    if (!this.session || !this.state.isPlaying || this.state.isPaused) return;

    // Sort events by sequence (not timestamp) for deterministic playback
    const sortedEvents = [...this.session.events].sort((a, b) => a.sequence - b.sequence);
    const event = sortedEvents[this.state.currentEventIndex];
    
    if (!event) {
      this.complete();
      return;
    }

    // CRITICAL: Compensate for playback speed to prevent drift
    // Use compensated time instead of wall-clock time
    const targetTime = event.timestamp / this.state.playbackSpeed;
    const currentCompensatedTime = (Date.now() - this.startTime);
    const delay = Math.max(0, targetTime - currentCompensatedTime);

    this.playbackTimer = window.setTimeout(() => {
      this.playEvent(event);
      this.state.currentEventIndex++;
      this.state.elapsedTime = event.timestamp;
      this.state.compensatedTime = currentCompensatedTime + delay;
      
      // Report progress
      if (this.session) {
        const progress = this.state.currentEventIndex / sortedEvents.length;
        this.config.onProgress?.(progress);
      }
      
      this.scheduleNextEvent();
    }, delay);
  }

  private playEvent(event: ReplayEvent): void {
    // CRITICAL: Emit to isolated replay bus, NOT live bus
    // This prevents replay from interfering with running game
    this.replayBus.emit(
      event.type as keyof EventMap,
      event.payload as any
    );
    this.config.onEventPlayed?.(event);
  }

  private complete(): void {
    this.state.isPlaying = false;
    this.config.onComplete?.();
    console.log('[ReplayPlayer] Playback complete');
  }

  private clearTimer(): void {
    if (this.playbackTimer !== null) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  /**
   * Get current state
   */
  public getState(): ReplayState {
    return { ...this.state };
  }

  /**
   * Get loaded session
   */
  public getSession(): ReplaySession | null {
    return this.session;
  }

  /**
   * Get progress (0-1)
   */
  public getProgress(): number {
    if (!this.session || this.session.events.length === 0) return 0;
    return this.state.currentEventIndex / this.session.events.length;
  }

  /**
   * Get total duration
   */
  public getTotalDuration(): number {
    if (!this.session || this.session.events.length === 0) return 0;
    return this.session.events[this.session.events.length - 1].timestamp;
  }

  /**
   * Subscribe to replay events (on isolated bus)
   * Use this to observe replay without affecting live game
   */
  public onReplayEvent<K extends keyof EventMap>(
    type: K,
    callback: (payload: EventMap[K]) => void
  ): string {
    return this.replayBus.on(type, callback as any);
  }

  /**
   * Unsubscribe from replay events
   */
  public offReplayEvent(subscriptionId: string): void {
    this.replayBus.off(subscriptionId);
  }

  /**
   * Get the isolated replay bus (for advanced use cases)
   */
  public getReplayBus(): EventBus {
    return this.replayBus;
  }

  public static reset(): void {
    if (ReplayPlayer.instance) {
      ReplayPlayer.instance.stop();
      ReplayPlayer.instance.replayBus.destroy();
    }
    ReplayPlayer.instance = null;
  }
}
