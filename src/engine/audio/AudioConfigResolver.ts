/**
 * Engine.Audio — AudioConfigResolver
 *
 * Namespace: EngineAudio  |  Global: Engine.Audio.ConfigResolver
 *
 * Loads a game's /game-configs/games/{gameId}/audio.json and resolves
 * a canonical EventAudioMap: { engineEvent → spriteName }.
 *
 * Resolution chain (per event):
 *   1. Game audio.json eventMap override
 *   2. Engine default sprite key
 *   3. null (sound not configured — skip silently)
 *
 * Also exposes music keys so AudioManager can cross-fade correctly.
 * DO NOT put game-specific logic here — only key resolution.
 */

import { EngineAudio } from './types/AudioTypes';

const NS = '[Engine.Audio.ConfigResolver]';

// ─── Engine-level event → sprite key defaults ──────────────────────────────
// These map to real sprite keys in PrimarySounds.json / SecondarySounds.json

export const ENGINE_AUDIO_EVENT_DEFAULTS: EngineAudio.EventAudioMap = {
  // Spin lifecycle
  'spin:start':      'sx_spin_start_btn',
  'spin:stop':       'sx_spin_stop_btn',
  'spin:loop':       'sx_reel_spinning',

  // Reel stops (individual)
  'reel:stop:1':     'sx_reelstop_1',
  'reel:stop:2':     'sx_reelstop_2',
  'reel:stop:3':     'sx_reelstop_3',
  'reel:stop:4':     'sx_reelstop_4',
  'reel:stop:5':     'sx_reelstop_5',

  // Win tiers
  'win:any':         'sx_show_popup',
  'win:anticipation':'sx_anticipation',

  // Music tracks
  'music:base':      'mx_background_sound',
  'music:freespins': 'mx_freespins_background_sound_v2',

  // UI
  'ui:click':        'sx_button_click_sound',
  'ui:intro':        'sx_game_intro',

  // Ambient
  'ambient:base':    'ambientSoundBGFS',
};

// ─── Resolved audio config shape ───────────────────────────────────────────

export interface ResolvedAudioConfig {
  gameId:      string;
  eventMap:    EngineAudio.EventAudioMap;
  musicBase:   string;
  musicFS:     string;
  /** Per-game sprite base path (e.g. /assets/games/slots/neon-nights/audios) */
  spritesBasePath: string | null;
  volumes: {
    master:  number;
    music:   number;
    sfx:     number;
    ambient: number;
    ui:      number;
    voice:   number;
  };
  muteOnBlur:  boolean;
  muteOnPause: boolean;
  ducking: {
    enabled:    boolean;
    duckVolume: number;
    fadeMs:     number;
    restoreMs:  number;
  };
  spinLoopStopEvent: 'reels_stopped' | 'spin_complete';
}

// ─── Raw audio.json shape (game-config file) ───────────────────────────────

interface GameAudioJson {
  basePath?:   string;                        // per-game sprites path
  eventMap?:   Record<string, string>;
  volumes?:    Partial<ResolvedAudioConfig['volumes']>;
  music?: {
    base?: { key: string };
    freeSpins?: { key: string };
  };
  mute?: {
    onBlur?:  boolean;
    onPause?: boolean;
  };
  ducking?: Partial<ResolvedAudioConfig['ducking']>;
  spinLoopStopEvent?: 'reels_stopped' | 'spin_complete';
}

export class AudioConfigResolver {
  private static instance: AudioConfigResolver | null = null;
  private cache: Map<string, ResolvedAudioConfig> = new Map();

  private constructor() {}

  public static getInstance(): AudioConfigResolver {
    if (!AudioConfigResolver.instance) {
      AudioConfigResolver.instance = new AudioConfigResolver();
    }
    return AudioConfigResolver.instance;
  }

  /**
   * Load and resolve the audio config for a game.
   * Falls back gracefully if the game has no audio.json.
   */
  public async resolve(gameId: string): Promise<ResolvedAudioConfig> {
    if (this.cache.has(gameId)) {
      return this.cache.get(gameId)!;
    }

    let gameJson: GameAudioJson = {};

    try {
      const url = `/game-configs/games/${gameId}/audio.json`;
      const res = await fetch(url);
      if (res.ok) {
        gameJson = await res.json();
        console.log(`${NS} Loaded audio.json for "${gameId}"`);
      } else {
        console.warn(`${NS} No audio.json for "${gameId}" (${res.status}) — using engine defaults`);
      }
    } catch (err) {
      console.warn(`${NS} Failed to fetch audio.json for "${gameId}" — using engine defaults`, err);
    }

    // Merge game event map overrides on top of engine defaults
    const eventMap: EngineAudio.EventAudioMap = {
      ...ENGINE_AUDIO_EVENT_DEFAULTS,
      ...(gameJson.eventMap ?? {}),
    };

    // Resolve music keys (game audio.json may use nested music block)
    const musicBase = gameJson.music?.base?.key
      ?? eventMap['music:base']
      ?? ENGINE_AUDIO_EVENT_DEFAULTS['music:base']!;

    const musicFS = gameJson.music?.freeSpins?.key
      ?? eventMap['music:freespins']
      ?? ENGINE_AUDIO_EVENT_DEFAULTS['music:freespins']!;

    const resolved: ResolvedAudioConfig = {
      gameId,
      eventMap,
      musicBase,
      musicFS,
      spritesBasePath: gameJson.basePath ?? null,
      volumes: {
        master:  gameJson.volumes?.master  ?? 1.0,
        music:   gameJson.volumes?.music   ?? 0.7,
        sfx:     gameJson.volumes?.sfx     ?? 1.0,
        ambient: gameJson.volumes?.ambient ?? 0.3,
        ui:      gameJson.volumes?.ui      ?? 0.8,
        voice:   gameJson.volumes?.voice   ?? 1.0,
      },
      muteOnBlur:  gameJson.mute?.onBlur  ?? false,
      muteOnPause: gameJson.mute?.onPause ?? false,
      ducking: {
        enabled:    gameJson.ducking?.enabled    ?? true,
        duckVolume: gameJson.ducking?.duckVolume ?? 0.3,
        fadeMs:     gameJson.ducking?.fadeMs      ?? 200,
        restoreMs:  gameJson.ducking?.restoreMs   ?? 300,
      },
      spinLoopStopEvent: gameJson.spinLoopStopEvent ?? 'reels_stopped',
    };

    this.cache.set(gameId, resolved);
    console.log(`${NS} Resolved config for "${gameId}":`, resolved.eventMap);
    return resolved;
  }

  /** Get cached config synchronously (only after resolve() has been called) */
  public get(gameId: string): ResolvedAudioConfig | null {
    return this.cache.get(gameId) ?? null;
  }

  /** Get sprite key for an engine event, with fallback */
  public getSpriteKey(
    gameId:      string,
    event:       string,
    fallback?:   string
  ): string | null {
    const config = this.cache.get(gameId);
    if (!config) return fallback ?? null;
    return config.eventMap[event] ?? fallback ?? null;
  }

  public destroy(): void {
    this.cache.clear();
    AudioConfigResolver.instance = null;
  }
}
