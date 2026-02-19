/**
 * EventEnvelope - Wrapper for event data
 * Enhanced with sequence numbers and integrity verification for GLI compliance
 */

/**
 * Envelope containing event metadata and payload.
 * Guarantees deterministic ordering via immutable sequence numbers.
 */
export class EventEnvelope<T = unknown> {
  private static globalSequence: number = 0;
  private static resetSequenceOnInit: boolean = false;

  public readonly type: string;
  public readonly payload: T;
  public readonly timestamp: number;
  public readonly id: string;
  public readonly sequence: number; // Immutable ordering for replay determinism
  public readonly hash: string | null = null; // Integrity verification
  
  private stopped: boolean = false;
  private propagationStopped: boolean = false;

  constructor(type: string, payload: T, options?: { skipHash?: boolean }) {
    this.type = type;
    this.payload = payload;
    this.timestamp = Date.now();
    this.sequence = ++EventEnvelope.globalSequence;
    this.id = `evt_${this.sequence}_${this.timestamp}`;
    
    // Compute integrity hash (async would require Promise, so sync for now)
    // For full GLI compliance, use crypto.subtle in production
    if (!options?.skipHash) {
      this.hash = this.computeSyncHash();
    }
  }

  /**
   * Compute synchronous hash for event integrity
   * NOTE: In production, replace with crypto.subtle.digest('SHA-256', ...)
   */
  private computeSyncHash(): string {
    const data = JSON.stringify({
      type: this.type,
      payload: this.payload,
      sequence: this.sequence,
      timestamp: this.timestamp,
    });
    
    // Simple hash for development (replace with SHA-256 in production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /** Stop event processing */
  public stop(): void {
    this.stopped = true;
  }

  /** Check if event is stopped */
  public isStopped(): boolean {
    return this.stopped;
  }

  /** Stop propagation to lower priority handlers */
  public stopPropagation(): void {
    this.propagationStopped = true;
  }

  /** Check if propagation is stopped */
  public isPropagationStopped(): boolean {
    return this.propagationStopped;
  }

  /** Get time since event was created */
  public getAge(): number {
    return Date.now() - this.timestamp;
  }

  /** Clone the envelope */
  public clone(): EventEnvelope<T> {
    return new EventEnvelope(this.type, this.payload);
  }

  /** Convert to plain object */
  public toJSON(): {
    id: string;
    type: string;
    payload: T;
    timestamp: number;
    sequence: number;
    hash: string | null;
  } {
    return {
      id: this.id,
      type: this.type,
      payload: this.payload,
      timestamp: this.timestamp,
      sequence: this.sequence,
      hash: this.hash,
    };
  }

  /**
   * Verify event integrity by comparing computed hash
   * @returns true if hash matches, false if tampered or hash unavailable
   */
  public verifyIntegrity(): boolean {
    if (!this.hash) return false;
    const computedHash = this.computeSyncHash();
    return this.hash === computedHash;
  }

  /**
   * Reset global sequence counter (for testing only)
   */
  public static resetSequence(): void {
    EventEnvelope.globalSequence = 0;
  }

  /**
   * Get current global sequence
   */
  public static getCurrentSequence(): number {
    return EventEnvelope.globalSequence;
  }
}
