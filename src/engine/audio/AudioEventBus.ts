/**
 * Engine.Audio — AudioEventBus
 *
 * Namespace: EngineAudio
 * Typed event bus dedicated to audio events.
 * Bridges the AudioManager with the wider engine EventBus.
 *
 * Import: import { AudioEventBus } from '@/engine/audio/AudioEventBus';
 */

import {
  EngineAudio,
  type EngineAudio as EA,
} from './types/AudioTypes';

type AudioEventMap = {
  'audio:ready':         EA.AudioReadyPayload;
  'audio:error':         EA.AudioErrorPayload;
  'audio:mute':          EA.AudioMutePayload;
  'audio:volume:change': EA.AudioVolumePayload;
  'audio:play':          EA.AudioPlayPayload;
  'audio:stop':          EA.AudioStopPayload;
  'audio:music:change':  EA.AudioMusicPayload;
  'audio:suspended':     Record<string, never>;
  'audio:resumed':       Record<string, never>;
};

type AudioEventKey = keyof AudioEventMap;
type AudioListener<K extends AudioEventKey> = (payload: AudioEventMap[K]) => void;

export class AudioEventBus {
  private static instance: AudioEventBus | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<AudioEventKey, Set<AudioListener<any>>> = new Map();

  private constructor() {}

  public static getInstance(): AudioEventBus {
    if (!AudioEventBus.instance) {
      AudioEventBus.instance = new AudioEventBus();
    }
    return AudioEventBus.instance;
  }

  public on<K extends AudioEventKey>(event: K, listener: AudioListener<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as AudioListener<AudioEventKey>);
  }

  public off<K extends AudioEventKey>(event: K, listener: AudioListener<K>): void {
    this.listeners.get(event)?.delete(listener as AudioListener<AudioEventKey>);
  }

  public once<K extends AudioEventKey>(event: K, listener: AudioListener<K>): void {
    const wrapper: AudioListener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  public emit<K extends AudioEventKey>(event: K, payload: AudioEventMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (e) {
        console.error(`[Engine.Audio.EventBus] Error in "${event}" listener:`, e);
      }
    });
  }

  public destroy(): void {
    this.listeners.clear();
    AudioEventBus.instance = null;
  }
}
