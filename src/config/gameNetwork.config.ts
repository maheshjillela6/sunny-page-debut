/**
 * Game network configuration
 * Loaded per game from /public/game-configs/games/<gameId>/network.json
 */

import type { NetworkAdapterType } from '@/platform/networking/INetworkAdapter';
import { appendVersionToUrl } from '@/config/version.config';

export interface GameNetworkConfig {
  adapterType: NetworkAdapterType;
  rest?: {
    baseUrl?: string;
    timeout?: number;
  };
  stomp?: {
    url?: string;
    reconnectDelay?: number;
    heartbeatIncoming?: number;
  };
}

export async function fetchGameNetworkConfig(gameId: string): Promise<GameNetworkConfig | null> {
  const url = `/game-configs/games/${encodeURIComponent(gameId)}/network.json`;

  try {
    const res = await fetch(appendVersionToUrl(url), { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;

    if (!json || typeof json !== 'object') return null;

    const cfg = json as Partial<GameNetworkConfig>;
    if (!cfg.adapterType) return null;

    return {
      adapterType: cfg.adapterType,
      rest: cfg.rest,
      stomp: cfg.stomp,
    };
  } catch {
    return null;
  }
}
