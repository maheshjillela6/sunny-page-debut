/**
 * StateSerializer - Serialization utilities for game state
 */

import { GameSession } from './GameSession';

export interface SerializedState {
  version: string;
  timestamp: number;
  checksum: string;
  data: object;
}

export class StateSerializer {
  private static VERSION = '1.0.0';

  public static serialize(session: GameSession): string {
    const snapshot = session.createSnapshot();
    const serialized: SerializedState = {
      version: this.VERSION,
      timestamp: Date.now(),
      checksum: this.generateChecksum(snapshot),
      data: snapshot,
    };
    return JSON.stringify(serialized);
  }

  public static deserialize(json: string): SerializedState | null {
    try {
      const parsed = JSON.parse(json) as SerializedState;
      
      // Version check
      if (parsed.version !== this.VERSION) {
        console.warn(`[StateSerializer] Version mismatch: ${parsed.version} vs ${this.VERSION}`);
        return null;
      }

      // Checksum validation
      if (!this.validateChecksum(parsed.data, parsed.checksum)) {
        console.error('[StateSerializer] Checksum validation failed');
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('[StateSerializer] Failed to deserialize:', error);
      return null;
    }
  }

  public static restore(session: GameSession, serialized: SerializedState): boolean {
    try {
      session.restoreFromSnapshot(serialized.data);
      return true;
    } catch (error) {
      console.error('[StateSerializer] Failed to restore:', error);
      return false;
    }
  }

  private static generateChecksum(data: object): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256:${Math.abs(hash).toString(16)}`;
  }

  private static validateChecksum(data: object, checksum: string): boolean {
    return this.generateChecksum(data) === checksum;
  }

  // Compact serialization for reconnect tokens
  public static createResumeToken(sessionId: string, roundId: string, mode: string): string {
    const payload = { s: sessionId, r: roundId, m: mode, t: Date.now() };
    return btoa(JSON.stringify(payload));
  }

  public static parseResumeToken(token: string): { sessionId: string; roundId: string; mode: string; timestamp: number } | null {
    try {
      const payload = JSON.parse(atob(token));
      return {
        sessionId: payload.s,
        roundId: payload.r,
        mode: payload.m,
        timestamp: payload.t,
      };
    } catch {
      return null;
    }
  }
}

export default StateSerializer;
