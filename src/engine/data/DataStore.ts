/**
 * DataStore - Centralized data store for game state
 */

import { EventBus } from '@/platform/events/EventBus';

export interface GameData {
  session: SessionData;
  wallet: WalletData;
  round: RoundData;
  features: FeatureData;
  settings: SettingsData;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  gameId: string;
  startTime: number;
  lastActivity: number;
}

export interface WalletData {
  balance: number;
  currency: string;
  bet: number;
  lines: number;
  totalBet: number;
}

export interface RoundData {
  roundId: string | null;
  state: 'idle' | 'spinning' | 'evaluating' | 'presenting';
  symbols: string[][] | null;
  wins: WinInfo[];
  totalWin: number;
}

export interface WinInfo {
  lineId: number;
  symbols: string[];
  positions: { row: number; col: number }[];
  amount: number;
  multiplier: number;
}

export interface FeatureData {
  active: string | null;
  freeSpins: {
    remaining: number;
    total: number;
    multiplier: number;
  };
  holdRespin: {
    holds: { row: number; col: number }[];
    respinsRemaining: number;
  };
}

export interface SettingsData {
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  musicVolume: number;
  turboMode: boolean;
  autoPlay: boolean;
  autoPlaySpins: number;
}

export class DataStore {
  private static instance: DataStore | null = null;

  private data: GameData;
  private eventBus: EventBus;
  private subscribers: Map<string, Set<(data: unknown) => void>> = new Map();

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.data = this.createDefaultData();
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private createDefaultData(): GameData {
    return {
      session: {
        sessionId: '',
        userId: '',
        gameId: '',
        startTime: 0,
        lastActivity: 0,
      },
      wallet: {
        balance: 1000,
        currency: 'USD',
        bet: 1,
        lines: 25,
        totalBet: 25,
      },
      round: {
        roundId: null,
        state: 'idle',
        symbols: null,
        wins: [],
        totalWin: 0,
      },
      features: {
        active: null,
        freeSpins: {
          remaining: 0,
          total: 0,
          multiplier: 1,
        },
        holdRespin: {
          holds: [],
          respinsRemaining: 0,
        },
      },
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        soundVolume: 0.8,
        musicVolume: 0.5,
        turboMode: false,
        autoPlay: false,
        autoPlaySpins: 0,
      },
    };
  }

  public get<K extends keyof GameData>(key: K): GameData[K] {
    return this.data[key];
  }

  public set<K extends keyof GameData>(key: K, value: Partial<GameData[K]>): void {
    this.data[key] = { ...this.data[key], ...value };
    this.notifySubscribers(key);
  }

  public subscribe<K extends keyof GameData>(
    key: K,
    callback: (data: GameData[K]) => void
  ): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback as (data: unknown) => void);

    return () => {
      this.subscribers.get(key)?.delete(callback as (data: unknown) => void);
    };
  }

  private notifySubscribers(key: string): void {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      const value = this.data[key as keyof GameData];
      callbacks.forEach((callback) => callback(value));
    }
  }

  public getSnapshot(): GameData {
    return JSON.parse(JSON.stringify(this.data));
  }

  public restore(snapshot: GameData): void {
    this.data = snapshot;
    Object.keys(this.data).forEach((key) => {
      this.notifySubscribers(key);
    });
  }

  public reset(): void {
    this.data = this.createDefaultData();
    Object.keys(this.data).forEach((key) => {
      this.notifySubscribers(key);
    });
  }
}

export default DataStore;
