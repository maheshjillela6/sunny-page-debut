/**
 * DataHydrator - Hydrates game state from various sources
 */

import { GameData, DataStore } from './DataStore';
import { DataSerializer } from './DataSerializer';

export interface HydrationSource {
  type: 'localStorage' | 'sessionStorage' | 'server' | 'url';
  key?: string;
  data?: GameData;
}

export class DataHydrator {
  private store: DataStore;

  constructor() {
    this.store = DataStore.getInstance();
  }

  public async hydrate(source: HydrationSource): Promise<boolean> {
    try {
      let data: GameData | null = null;

      switch (source.type) {
        case 'localStorage':
          data = this.hydrateFromLocalStorage(source.key || 'gameState');
          break;
        case 'sessionStorage':
          data = this.hydrateFromSessionStorage(source.key || 'gameState');
          break;
        case 'server':
          data = source.data || null;
          break;
        case 'url':
          data = this.hydrateFromUrl();
          break;
      }

      if (data) {
        this.store.restore(data);
        console.log('[DataHydrator] State hydrated from', source.type);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[DataHydrator] Hydration failed:', error);
      return false;
    }
  }

  private hydrateFromLocalStorage(key: string): GameData | null {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return DataSerializer.deserialize(stored);
  }

  private hydrateFromSessionStorage(key: string): GameData | null {
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    return DataSerializer.deserialize(stored);
  }

  private hydrateFromUrl(): GameData | null {
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get('state');
    if (!stateParam) return null;
    return DataSerializer.fromBase64(stateParam);
  }

  public persist(target: 'localStorage' | 'sessionStorage', key: string = 'gameState'): void {
    const snapshot = this.store.getSnapshot();
    const serialized = DataSerializer.serialize(snapshot);

    if (target === 'localStorage') {
      localStorage.setItem(key, serialized);
    } else {
      sessionStorage.setItem(key, serialized);
    }
  }

  public clear(target: 'localStorage' | 'sessionStorage', key: string = 'gameState'): void {
    if (target === 'localStorage') {
      localStorage.removeItem(key);
    } else {
      sessionStorage.removeItem(key);
    }
  }
}

export default DataHydrator;
