/**
 * Engine.Audio — AudioChannel
 *
 * Namespace: EngineAudio
 * Represents a single audio channel (music, sfx, ambient, ui, voice).
 * Manages volume, mute state, and active sound tracking per channel.
 *
 * Used internally by AudioManager — not to be used directly by games.
 * Import: import { AudioChannel } from '@/engine/audio/AudioChannel';
 */

import { Howl } from 'howler';
import { EngineAudio } from './types/AudioTypes';
import { AudioSpriteLoader } from './AudioSpriteLoader';

const NS = '[Engine.Audio.Channel]';

export class AudioChannel {
  private readonly channel: EngineAudio.Channel;
  private volume: number;
  private muted: boolean = false;
  private activeSounds: Map<number, EngineAudio.ActiveSound> = new Map();
  private loader: AudioSpriteLoader;

  constructor(channel: EngineAudio.Channel, initialVolume: number) {
    this.channel  = channel;
    this.volume   = Math.max(0, Math.min(1, initialVolume));
    this.loader   = AudioSpriteLoader.getInstance();
  }

  // ─── Volume ──────────────────────────────────────────────────────────────

  public getVolume(): number { return this.volume; }

  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.applyVolumeToActiveSounds();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumeToActiveSounds();
  }

  public isMuted(): boolean { return this.muted; }

  /** Effective volume = channel volume * master volume (passed in) when not muted */
  public effectiveVolume(masterVolume: number): number {
    return this.muted ? 0 : this.volume * masterVolume;
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  public play(
    howl:         Howl,
    sprite:       string,
    pack:         EngineAudio.SpritePack,
    masterVolume: number,
    options:      EngineAudio.PlayOptions = {}
  ): EngineAudio.SoundHandle | null {
    if (!howl) {
      console.warn(`${NS} [${this.channel}] No Howl instance for pack "${pack}"`);
      return null;
    }

    const effectiveVol = options.volume !== undefined
      ? options.volume * masterVolume
      : this.effectiveVolume(masterVolume);

    // DO NOT set howl.volume(effectiveVol) globally — that clobbers
    // all other sounds sharing this Howl (e.g., music & sfx in same sprite pack).
    // Instead, set volume per-soundId AFTER play().

    const soundId = howl.play(sprite);
    if (soundId === undefined || soundId === null) {
      console.warn(`${NS} [${this.channel}] howl.play("${sprite}") returned null — sprite missing?`);
      return null;
    }

    // Set volume on THIS sound only (not the global Howl)
    howl.volume(effectiveVol, soundId);

    // Override loop per-play if provided
    if (options.loop !== undefined) {
      howl.loop(options.loop, soundId);
    }

    // Fade in if requested
    if (options.fadeIn && options.fadeIn > 0) {
      howl.fade(0, effectiveVol, options.fadeIn, soundId);
    }

    // Wire end callback
    if (options.onEnd) {
      howl.once('end', options.onEnd, soundId);
    }

    const record: EngineAudio.ActiveSound = {
      soundId,
      sprite,
      pack,
      channel:   this.channel,
      priority:  options.priority ?? EngineAudio.Priority.NORMAL,
      loop:      options.loop ?? false,
      startedAt: Date.now(),
    };

    this.activeSounds.set(soundId, record);

    // Auto-remove from tracking when sound ends (non-looping)
    howl.once('end', () => this.activeSounds.delete(soundId), soundId);
    howl.once('stop', () => this.activeSounds.delete(soundId), soundId);

    console.debug(`${NS} [${this.channel}] ▶ "${sprite}" (id=${soundId}, vol=${effectiveVol.toFixed(2)})`);

    return {
      soundId,
      sprite,
      pack,
      channel: this.channel,
      stop: () => {
        const h = this.loader.getHowl(pack);
        if (h) {
          if (options.fadeOut && options.fadeOut > 0) {
            h.fade(effectiveVol, 0, options.fadeOut, soundId);
            setTimeout(() => h.stop(soundId), options.fadeOut);
          } else {
            h.stop(soundId);
          }
        }
        this.activeSounds.delete(soundId);
      },
      fade: (toVolume: number, durationMs: number) => {
        const h = this.loader.getHowl(pack);
        if (h) h.fade(effectiveVol, toVolume * masterVolume, durationMs, soundId);
      },
    };
  }

  /** Stop all active sounds in this channel */
  public stopAll(masterVolume: number, fadeMs = 0): void {
    this.activeSounds.forEach((sound) => {
      const howl = this.loader.getHowl(sound.pack);
      if (!howl) return;
      if (fadeMs > 0) {
        const vol = this.effectiveVolume(masterVolume);
        howl.fade(vol, 0, fadeMs, sound.soundId);
        setTimeout(() => howl.stop(sound.soundId), fadeMs);
      } else {
        howl.stop(sound.soundId);
      }
    });
    this.activeSounds.clear();
  }

  /** Reapply current volume to all active sounds (called after volume/mute changes) */
  private applyVolumeToActiveSounds(): void {
    // Note: This is called by setVolume/setMuted but actual Howl volume updates
    // are driven by AudioManager.applyChannelVolumeToHowls() which has the masterVolume.
    // We don't have masterVolume here, so AudioManager handles the actual Howl updates.
  }

  public getActiveSounds(): EngineAudio.ActiveSound[] {
    return Array.from(this.activeSounds.values());
  }

  public getActiveCount(): number {
    return this.activeSounds.size;
  }

  public destroy(): void {
    this.activeSounds.clear();
  }
}
