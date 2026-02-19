/**
 * DataSerializer - Serialization utilities for game data
 */

import { GameData } from './DataStore';

export class DataSerializer {
  public static serialize(data: GameData): string {
    try {
      return JSON.stringify(data);
    } catch (error) {
      console.error('[DataSerializer] Failed to serialize data:', error);
      throw new Error('Serialization failed');
    }
  }

  public static deserialize(json: string): GameData {
    try {
      const data = JSON.parse(json);
      return DataSerializer.validate(data);
    } catch (error) {
      console.error('[DataSerializer] Failed to deserialize data:', error);
      throw new Error('Deserialization failed');
    }
  }

  public static toBase64(data: GameData): string {
    const json = DataSerializer.serialize(data);
    return btoa(encodeURIComponent(json));
  }

  public static fromBase64(base64: string): GameData {
    const json = decodeURIComponent(atob(base64));
    return DataSerializer.deserialize(json);
  }

  private static validate(data: unknown): GameData {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid data format');
    }

    const gameData = data as GameData;

    const requiredKeys: (keyof GameData)[] = [
      'session',
      'wallet',
      'round',
      'features',
      'settings',
    ];

    for (const key of requiredKeys) {
      if (!(key in gameData)) {
        throw new Error(`Missing required key: ${key}`);
      }
    }

    return gameData;
  }

  public static compress(data: GameData): Uint8Array {
    const json = DataSerializer.serialize(data);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }

  public static decompress(compressed: Uint8Array): GameData {
    const decoder = new TextDecoder();
    const json = decoder.decode(compressed);
    return DataSerializer.deserialize(json);
  }
}

export default DataSerializer;
