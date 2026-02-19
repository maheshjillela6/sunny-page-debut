/**
 * Engine.Audio — Global Type Definitions
 *
 * Namespace: EngineAudio
 * All audio contracts for the multi-game slot framework live here.
 * No game-specific logic — only engine-level contracts.
 *
 * Import: import { EngineAudio } from '@/engine/audio/types/AudioTypes';
 */

export namespace EngineAudio {

  // ─── Channel Categories ─────────────────────────────────────────────────

  /** Audio channel categories — maps to independent volume tracks */
  export enum Channel {
    MUSIC   = 'music',
    SFX     = 'sfx',
    AMBIENT = 'ambient',
    UI      = 'ui',
    VOICE   = 'voice',
  }

  /** Lifecycle states of the AudioManager */
  export enum ManagerState {
    UNINITIALIZED = 'uninitialized',
    LOADING       = 'loading',
    READY         = 'ready',
    SUSPENDED     = 'suspended',
    DESTROYED     = 'destroyed',
  }

  /** Priority levels — higher-priority sounds can interrupt lower ones */
  export enum Priority {
    LOW      = 0,
    NORMAL   = 1,
    HIGH     = 2,
    CRITICAL = 3,
  }

  /** Supported sprite pack identifiers — must match public/assets/audio/sprites/{id}.json */
  export enum SpritePack {
    PRIMARY   = 'PrimarySounds',
    SECONDARY = 'SecondarySounds',
  }

  // ─── Sprite Manifest ────────────────────────────────────────────────────

  /** Raw Howler sprite entry: [offset, duration] or [offset, duration, loop] */
  export type SpriteEntry = [number, number] | [number, number, boolean];

  /** Raw JSON structure loaded from sprite manifest files */
  export interface SpriteManifest {
    urls:   string[];
    sprite: Record<string, SpriteEntry | [number, number, boolean?]>;
  }

  // ─── Volume State ────────────────────────────────────────────────────────

  export interface VolumeState {
    master:  number; // 0–1
    music:   number;
    sfx:     number;
    ambient: number;
    ui:      number;
    voice:   number;
    muted:   boolean;
  }

  // ─── Playback Options ────────────────────────────────────────────────────

  export interface PlayOptions {
    channel?:  Channel;
    volume?:   number;   // 0–1 override applied after channel volume
    loop?:     boolean;
    priority?: Priority;
    onEnd?:    () => void;
    fadeIn?:   number;   // ms
    fadeOut?:  number;   // ms
  }

  /** Handle returned from play() — used to stop/fade specific instances */
  export interface SoundHandle {
    soundId:  number;      // Howler sound id
    sprite:   string;
    pack:     SpritePack;
    channel:  Channel;
    stop:     () => void;
    fade:     (toVolume: number, durationMs: number) => void;
  }

  /** Internal tracking record for an active sound */
  export interface ActiveSound {
    soundId:   number;
    sprite:    string;
    pack:      SpritePack;
    channel:   Channel;
    priority:  Priority;
    loop:      boolean;
    startedAt: number;
  }

  // ─── Music Crossfade ─────────────────────────────────────────────────────

  export interface MusicTransition {
    from:      string | null;
    to:        string;
    pack:      SpritePack;
    fadeOutMs: number;
    fadeInMs:  number;
  }

  // ─── Engine-Level Audio Config ───────────────────────────────────────────

  /** Engine defaults — individual games may override via their audio.json */
  export interface AudioConfig {
    enabled:        boolean;
    defaultVolumes: VolumeState;
    muteOnBlur:     boolean;
    muteOnPause:    boolean;
    spritePacks:    SpritePack[];
    spritesBasePath: string;
  }

  // ─── Loader ──────────────────────────────────────────────────────────────

  export interface LoadResult {
    pack:    SpritePack;
    success: boolean;
    error?:  Error;
  }

  // ─── Event → Sprite Key Map ───────────────────────────────────────────────
  /**
   * Maps engine event identifiers to sprite keys.
   * Keys are engine event names (e.g. 'spin:start', 'reel:stop:1').
   * Values are sprite keys that exist in PRIMARY or SECONDARY packs.
   */
  export type EventAudioMap = Record<string, string>;

  // ─── EventBus Payloads ────────────────────────────────────────────────────

  export interface AudioReadyPayload     { packs: SpritePack[] }
  export interface AudioErrorPayload     { error: Error; pack?: SpritePack }
  export interface AudioMutePayload      { muted: boolean }
  export interface AudioVolumePayload    { channel: Channel; value: number }
  export interface AudioPlayPayload      { sprite: string; pack: SpritePack; soundId: number }
  export interface AudioStopPayload      { sprite: string; soundId: number }
  export interface AudioMusicPayload     { from: string | null; to: string }
}

// ─── Engine-level defaults (used by AudioManager if no game config present) ─

export const AUDIO_ENGINE_DEFAULTS: EngineAudio.AudioConfig = {
  enabled: true,
  defaultVolumes: {
    master:  1.0,
    music:   0.7,
    sfx:     1.0,
    ambient: 0.3,
    ui:      0.8,
    voice:   1.0,
    muted:   false,
  },
  muteOnBlur:      false,   // Engine default: do NOT auto-mute on page blur
  muteOnPause:     false,   // Engine default: do NOT auto-mute on engine pause
  spritePacks:     [EngineAudio.SpritePack.PRIMARY, EngineAudio.SpritePack.SECONDARY],
  spritesBasePath: '/assets/audio/sprites',
};
