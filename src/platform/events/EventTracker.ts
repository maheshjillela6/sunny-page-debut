/**
 * EventTracker - Tracks event statistics
 */

export interface EventStats {
  type: string;
  count: number;
  lastEmitted: number;
  averageHandlerTime: number;
}

/**
 * Tracks statistics for events.
 */
export class EventTracker {
  private stats: Map<string, EventStats> = new Map();

  /** Track an event emission */
  public track(type: string, handlerTimeMs: number = 0): void {
    let stat = this.stats.get(type);
    
    if (!stat) {
      stat = {
        type,
        count: 0,
        lastEmitted: 0,
        averageHandlerTime: 0,
      };
      this.stats.set(type, stat);
    }

    stat.count++;
    stat.lastEmitted = Date.now();
    stat.averageHandlerTime = 
      (stat.averageHandlerTime * (stat.count - 1) + handlerTimeMs) / stat.count;
  }

  /** Get stats for a type */
  public getStats(type: string): EventStats | undefined {
    return this.stats.get(type);
  }

  /** Get all stats */
  public getAllStats(): EventStats[] {
    return Array.from(this.stats.values());
  }

  /** Get top events by count */
  public getTopByCount(limit: number = 10): EventStats[] {
    return this.getAllStats()
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /** Get total event count */
  public getTotalCount(): number {
    return Array.from(this.stats.values()).reduce((sum, s) => sum + s.count, 0);
  }

  /** Reset stats */
  public reset(): void {
    this.stats.clear();
  }
}
