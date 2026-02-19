/**
 * SoundManager - Manages game audio
 */

import { EventBus } from '../events/EventBus';
import { appendVersionToUrl } from '../../config/version.config';

export interface SoundConfig {
  id: string;
  url: string;
  volume: number;
  loop: boolean;
  group: 'sfx' | 'music' | 'ui';
}

export interface AudioState {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

export class SoundManager {
  private static instance: SoundManager | null = null;

  private eventBus: EventBus;
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private state: AudioState = {
    masterVolume: 1,
    sfxVolume: 0.8,
    musicVolume: 0.5,
    muted: false,
  };

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.setupEventListeners();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private setupEventListeners(): void {
    this.eventBus.on('audio:sound:play', (payload) => {
      this.play(payload.soundId, payload.volume, payload.loop);
    });

    this.eventBus.on('audio:sound:stop', (payload) => {
      this.stop(payload.soundId);
    });

    this.eventBus.on('audio:mute', () => {
      this.mute();
    });

    this.eventBus.on('audio:unmute', () => {
      this.unmute();
    });
  }

  public async initialize(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();

    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.sfxGain = this.audioContext.createGain();
    this.sfxGain.connect(this.masterGain);
    this.sfxGain.gain.value = this.state.sfxVolume;

    this.musicGain = this.audioContext.createGain();
    this.musicGain.connect(this.masterGain);
    this.musicGain.gain.value = this.state.musicVolume;
  }

  public async load(config: SoundConfig): Promise<void> {
    if (!this.audioContext) await this.initialize();

    try {
      const response = await fetch(appendVersionToUrl(config.url));
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.sounds.set(config.id, audioBuffer);
    } catch (error) {
      console.error(`[SoundManager] Failed to load sound: ${config.id}`, error);
    }
  }

  public play(soundId: string, volume?: number, loop?: boolean): void {
    if (this.state.muted || !this.audioContext) return;

    const buffer = this.sounds.get(soundId);
    if (!buffer) {
      console.warn(`[SoundManager] Sound not found: ${soundId}`);
      return;
    }

    this.stop(soundId);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop ?? false;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume ?? 1;
    gainNode.connect(this.sfxGain!);

    source.connect(gainNode);
    source.start(0);

    this.activeSources.set(soundId, source);
    this.gainNodes.set(soundId, gainNode);

    source.onended = () => {
      this.activeSources.delete(soundId);
      this.gainNodes.delete(soundId);
    };
  }

  public stop(soundId: string): void {
    const source = this.activeSources.get(soundId);
    if (source) {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
      this.activeSources.delete(soundId);
      this.gainNodes.delete(soundId);
    }
  }

  public stopAll(): void {
    for (const [id] of this.activeSources) {
      this.stop(id);
    }
  }

  public mute(): void {
    this.state.muted = true;
    if (this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }

  public unmute(): void {
    this.state.muted = false;
    if (this.masterGain) {
      this.masterGain.gain.value = this.state.masterVolume;
    }
  }

  public setMasterVolume(volume: number): void {
    this.state.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && !this.state.muted) {
      this.masterGain.gain.value = this.state.masterVolume;
    }
  }

  public setSfxVolume(volume: number): void {
    this.state.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.state.sfxVolume;
    }
  }

  public setMusicVolume(volume: number): void {
    this.state.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGain) {
      this.musicGain.gain.value = this.state.musicVolume;
    }
  }

  public getState(): AudioState {
    return { ...this.state };
  }

  public destroy(): void {
    this.stopAll();
    this.sounds.clear();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    SoundManager.instance = null;
  }
}

export default SoundManager;
