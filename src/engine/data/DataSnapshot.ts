/**
 * DataSnapshot - Snapshot utilities for game state
 */

import { GameData } from './DataStore';

export interface Snapshot {
  id: string;
  timestamp: number;
  data: GameData;
  metadata: SnapshotMetadata;
}

export interface SnapshotMetadata {
  version: string;
  gameId: string;
  checksum: string;
}

export class DataSnapshot {
  public static create(data: GameData, gameId: string): Snapshot {
    const snapshot: Snapshot = {
      id: DataSnapshot.generateId(),
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data)),
      metadata: {
        version: '1.0.0',
        gameId,
        checksum: DataSnapshot.calculateChecksum(data),
      },
    };
    return snapshot;
  }

  public static validate(snapshot: Snapshot): boolean {
    const checksum = DataSnapshot.calculateChecksum(snapshot.data);
    return checksum === snapshot.metadata.checksum;
  }

  public static merge(base: GameData, partial: Partial<GameData>): GameData {
    return {
      ...base,
      ...partial,
      session: { ...base.session, ...(partial.session || {}) },
      wallet: { ...base.wallet, ...(partial.wallet || {}) },
      round: { ...base.round, ...(partial.round || {}) },
      features: { ...base.features, ...(partial.features || {}) },
      settings: { ...base.settings, ...(partial.settings || {}) },
    };
  }

  private static generateId(): string {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static calculateChecksum(data: GameData): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export default DataSnapshot;
