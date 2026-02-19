/**
 * Engine.Audio — AudioManager (Singleton)
 *
 * Namespace: EngineAudio  |  Global: Engine.Audio.AudioManager
 *
 * THE single source of truth for all audio in the framework.
 * Responsibilities:
 *   • Load and manage Howler sprite packs (Primary + Secondary)
 *   • Maintain per-channel volume state (music / sfx / ambient / ui / voice)
 *   • Provide a typed play/stop API with priority and fade support
 *   • Handle music crossfading with safe transitions
 *   • Mute on page blur / engine pause (configurable)
 *   • Emit typed events on AudioEventBus
 *   • Safely guard against missing sprites without throwing
 *
 * Import: import { AudioManager } from '@/engine/audio/AudioManager';
 *
 * DO NOT instantiate per-game. One instance for the entire engine.
 */

import { EngineAudio, AUDIO_ENGINE_DEFAULTS } from './types/AudioTypes';
import { AudioSpriteLoader }                  from './AudioSpriteLoader';
import { AudioChannel }                       from './AudioChannel';
import { AudioEventBus }                      from './AudioEventBus';

import { Howler }                              from 'howler';

const NS = '[Engine.Audio.Manager]';

export class AudioManager {
  private static instance: AudioManager | null = null;

  // ── Core sub-systems ─────────────────────────────────────────────────────
  private loader:   AudioSpriteLoader;
  private eventBus: AudioEventBus;

  // ── Channel registry (one per EngineAudio.Channel enum value) ────────────
  private channels: Map<EngineAudio.Channel, AudioChannel> = new Map();

  // ── State ─────────────────────────────────────────────────────────────────
  private state:        EngineAudio.ManagerState = EngineAudio.ManagerState.UNINITIALIZED;
  private config:       EngineAudio.AudioConfig  = AUDIO_ENGINE_DEFAULTS;
  private masterVolume: number                   = 1.0;
  private muted:        boolean                  = false;

  // ── Music tracking (for crossfade) ────────────────────────────────────────
  private currentMusic: EngineAudio.SoundHandle | null = null;
  private currentMusicSprite: string | null             = null;
  private currentMusicPack:   EngineAudio.SpritePack | null = null;

  // ── Page-visibility auto-mute ─────────────────────────────────────────────
  private boundOnBlur:   () => void;
  private boundOnFocus:  () => void;
  private blurMuted:     boolean = false;

  // ── Audio context unlock ────────────────────────────────────────────────
  private contextUnlocked: boolean = false;
  private pendingMusic: { sprite: string; pack?: EngineAudio.SpritePack; fadeOutMs: number; fadeInMs: number } | null = null;
  private unlockHandler: (() => void) | null = null;

  private constructor() {
    this.loader   = AudioSpriteLoader.getInstance();
    this.eventBus = AudioEventBus.getInstance();
    this.boundOnBlur  = this.onPageBlur.bind(this);
    this.boundOnFocus = this.onPageFocus.bind(this);
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // ── Initialization ────────────────────────────────────────────────────────

  /**
   * Initialize the audio system. Must be called once at engine startup.
   * Accepts an optional partial config to override engine defaults.
   */
  public async initialize(
    overrides?: Partial<EngineAudio.AudioConfig>
  ): Promise<void> {
    if (this.state !== EngineAudio.ManagerState.UNINITIALIZED) {
      console.warn(`${NS} Already initialized — state: ${this.state}`);
      return;
    }

    this.state  = EngineAudio.ManagerState.LOADING;
    this.config = { ...AUDIO_ENGINE_DEFAULTS, ...overrides };

    const { defaultVolumes } = this.config;
    this.masterVolume = defaultVolumes.master;
    this.muted        = defaultVolumes.muted;

    // Build channel registry from defaults
    this.initChannels(defaultVolumes);

    // Register page-visibility handlers
    if (this.config.muteOnBlur) {
      window.addEventListener('blur',  this.boundOnBlur);
      window.addEventListener('focus', this.boundOnFocus);
    }

    // ── Audio Context Unlock ─────────────────────────────────────────────
    // Browsers require a user gesture to unlock AudioContext.
    // Check if already unlocked, otherwise listen for first interaction.
    this.checkAndSetupUnlock();

    // Sprite packs are loaded per-game via loadGameSprites() called by AudioController.
    // If a fallback base path is configured, load from there (legacy support).
    if (this.config.enabled && this.config.spritesBasePath) {
      const results = await Promise.all(
        this.config.spritePacks.map((pack) =>
          this.loader.load(pack, this.config.spritesBasePath)
        )
      );

      results.forEach((r) => {
        if (!r.success) {
          console.warn(`${NS} Fallback pack "${r.pack}" not loaded (per-game loading may override)`);
        }
      });

      this.applyAllChannelVolumes();
    }

    this.state = EngineAudio.ManagerState.READY;
    const loadedPacks = this.loader.getLoadedPacks();
    console.log(`${NS} Ready. Loaded packs: [${loadedPacks.join(', ')}]`);
    this.eventBus.emit('audio:ready', { packs: loadedPacks });
  }

  /** Check if Howler's AudioContext is already running; if not, set up auto-unlock on user gesture */
  private checkAndSetupUnlock(): void {
    // Check if already unlocked
    const ctx = Howler.ctx;
    if (ctx && ctx.state === 'running') {
      this.contextUnlocked = true;
      console.log(`${NS} AudioContext already unlocked`);
      return;
    }

    console.log(`${NS} AudioContext suspended — waiting for user gesture to unlock`);

    this.unlockHandler = () => {
      const ctx = Howler.ctx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.contextUnlocked = true;
          console.log(`${NS} 🔓 AudioContext unlocked by user gesture`);
          this.removeUnlockListeners();

          // Play any deferred music
          if (this.pendingMusic) {
            const { sprite, pack, fadeOutMs, fadeInMs } = this.pendingMusic;
            this.pendingMusic = null;
            this.playMusic(sprite, pack, fadeOutMs, fadeInMs).catch(() => {});
          }
        });
      } else if (ctx && ctx.state === 'running') {
        this.contextUnlocked = true;
        this.removeUnlockListeners();
        if (this.pendingMusic) {
          const { sprite, pack, fadeOutMs, fadeInMs } = this.pendingMusic;
          this.pendingMusic = null;
          this.playMusic(sprite, pack, fadeOutMs, fadeInMs).catch(() => {});
        }
      }
    };

    const events = ['click', 'touchstart', 'keydown', 'pointerdown'];
    events.forEach((e) => document.addEventListener(e, this.unlockHandler!, { once: false, passive: true }));
  }

  private removeUnlockListeners(): void {
    if (!this.unlockHandler) return;
    const events = ['click', 'touchstart', 'keydown', 'pointerdown'];
    events.forEach((e) => document.removeEventListener(e, this.unlockHandler!));
    this.unlockHandler = null;
  }

  // ── Per-Game Sprite Loading ───────────────────────────────────────────────

  /**
   * Load sprite packs from a game-specific base path.
   * Unloads existing packs first, then loads from the new path.
   * Games without audio files will gracefully have no sprites loaded.
   */
  public async loadGameSprites(basePath: string): Promise<void> {
    if (!this.config.enabled) return;

    // Unload existing packs
    for (const pack of this.config.spritePacks) {
      this.loader.unload(pack);
    }

    const results = await Promise.all(
      this.config.spritePacks.map((pack) =>
        this.loader.load(pack, basePath)
      )
    );

    results.forEach((r) => {
      if (!r.success) {
        console.warn(`${NS} Pack "${r.pack}" not found at "${basePath}" — game runs without this pack's audio`);
      }
    });

    this.applyAllChannelVolumes();
    const loadedPacks = this.loader.getLoadedPacks();
    console.log(`${NS} Game sprites loaded from "${basePath}": [${loadedPacks.join(', ')}]`);
  }


  private initChannels(vol: EngineAudio.VolumeState): void {
    const channelVolumes: Record<EngineAudio.Channel, number> = {
      [EngineAudio.Channel.MUSIC]:   vol.music,
      [EngineAudio.Channel.SFX]:     vol.sfx,
      [EngineAudio.Channel.AMBIENT]: vol.ambient,
      [EngineAudio.Channel.UI]:      vol.ui,
      [EngineAudio.Channel.VOICE]:   vol.voice,
    };

    for (const [ch, defaultVol] of Object.entries(channelVolumes)) {
      this.channels.set(
        ch as EngineAudio.Channel,
        new AudioChannel(ch as EngineAudio.Channel, defaultVol)
      );
    }
  }

  // ── Core Playback API ─────────────────────────────────────────────────────

  /**
   * Play a sprite by key. Searches PRIMARY pack first, then SECONDARY.
   * Safe: logs a warning and returns null if sprite is not found.
   */
  public play(
    sprite:  string,
    options: EngineAudio.PlayOptions = {}
  ): EngineAudio.SoundHandle | null {
    this.guardReady('play');

    const channel = options.channel ?? EngineAudio.Channel.SFX;
    const pack    = this.resolveSpritePack(sprite);

    if (!pack) {
      console.warn(`${NS} Sprite "${sprite}" not found in any loaded pack — skipping.`);
      return null;
    }

    const howl    = this.loader.getHowl(pack)!;
    const ch      = this.channels.get(channel)!;
    const handle  = ch.play(howl, sprite, pack, this.masterVolume, options);

    if (handle) {
      this.eventBus.emit('audio:play', { sprite, pack, soundId: handle.soundId });
    }

    return handle;
  }

  /**
   * Play a sprite from a specific named pack.
   * Use when you need explicit pack control (e.g., PRIMARY vs SECONDARY).
   */
  public playFromPack(
    pack:    EngineAudio.SpritePack,
    sprite:  string,
    options: EngineAudio.PlayOptions = {}
  ): EngineAudio.SoundHandle | null {
    this.guardReady('playFromPack');

    if (!this.loader.isLoaded(pack)) {
      console.warn(`${NS} Pack "${pack}" is not loaded yet.`);
      return null;
    }

    if (!this.loader.hasSprite(pack, sprite)) {
      console.warn(`${NS} Sprite "${sprite}" not found in pack "${pack}" — skipping.`);
      return null;
    }

    const howl    = this.loader.getHowl(pack)!;
    const channel = options.channel ?? EngineAudio.Channel.SFX;
    const ch      = this.channels.get(channel)!;
    const handle  = ch.play(howl, sprite, pack, this.masterVolume, options);

    if (handle) {
      this.eventBus.emit('audio:play', { sprite, pack, soundId: handle.soundId });
    }

    return handle;
  }

  // ── Music API ─────────────────────────────────────────────────────────────

  /**
   * Crossfade to a new music sprite. Fades out current music, fades in new track.
   * Safe to call if music is already playing the same sprite.
   */
  public async playMusic(
    sprite:    string,
    pack?:     EngineAudio.SpritePack,
    fadeOutMs: number = 500,
    fadeInMs:  number = 1000
  ): Promise<void> {
    this.guardReady('playMusic');

    // If AudioContext is not yet unlocked, defer music until user gesture
    if (!this.contextUnlocked) {
      console.log(`${NS} AudioContext locked — deferring music "${sprite}" until user gesture`);
      this.pendingMusic = { sprite, pack, fadeOutMs, fadeInMs };
      return;
    }

    if (this.currentMusicSprite === sprite) return; // already playing

    const resolvedPack = pack ?? this.resolveSpritePack(sprite);
    if (!resolvedPack) {
      console.warn(`${NS} Music sprite "${sprite}" not found — skipping.`);
      return;
    }

    const prevSprite = this.currentMusicSprite;

    // Fade out and stop current music
    if (this.currentMusic) {
      const handle = this.currentMusic;
      handle.fade(0, fadeOutMs);
      await this.delay(fadeOutMs);
      handle.stop();
      this.currentMusic = null;
    }

    this.currentMusicSprite = sprite;
    this.currentMusicPack   = resolvedPack;

    const handle = this.play(sprite, {
      channel:  EngineAudio.Channel.MUSIC,
      loop:     true,
      fadeIn:   fadeInMs,
      priority: EngineAudio.Priority.HIGH,
    });

    this.currentMusic = handle;
    this.eventBus.emit('audio:music:change', { from: prevSprite, to: sprite });
    console.log(`${NS} 🎵 Music: "${prevSprite ?? 'none'}" → "${sprite}"`);
  }

  /** Stop music with optional fade */
  public stopMusic(fadeMs = 500): void {
    if (!this.currentMusic) return;
    const handle = this.currentMusic;
    if (fadeMs > 0) {
      handle.fade(0, fadeMs);
      setTimeout(() => handle.stop(), fadeMs);
    } else {
      handle.stop();
    }
    this.currentMusic       = null;
    this.currentMusicSprite = null;
    this.currentMusicPack   = null;
  }

  // ── Volume API ────────────────────────────────────────────────────────────

  public setMasterVolume(value: number): void {
    this.masterVolume = Math.max(0, Math.min(1, value));
    this.applyAllChannelVolumes();
  }

  public setChannelVolume(channel: EngineAudio.Channel, value: number): void {
    const ch = this.channels.get(channel);
    if (!ch) return;
    ch.setVolume(Math.max(0, Math.min(1, value)));
    this.applyChannelVolumeToHowls(channel);
    this.eventBus.emit('audio:volume:change', { channel, value });
  }

  public getMasterVolume(): number { return this.masterVolume; }

  public getChannelVolume(channel: EngineAudio.Channel): number {
    return this.channels.get(channel)?.getVolume() ?? 0;
  }

  // ── Ducking API ──────────────────────────────────────────────────────────

  private duckedChannels: Map<EngineAudio.Channel, number> = new Map(); // channel → original volume

  /** Temporarily lower a channel's volume (e.g., duck music during wins) */
  public duckChannel(channel: EngineAudio.Channel, targetVolume: number, fadeMs: number = 200): void {
    const ch = this.channels.get(channel);
    if (!ch) return;

    // Store original volume if not already ducked
    if (!this.duckedChannels.has(channel)) {
      this.duckedChannels.set(channel, ch.getVolume());
    }

    const duckedVol = Math.max(0, Math.min(1, targetVolume));
    ch.setVolume(duckedVol);

    // Apply with fade to active sounds
    const effective = this.muted ? 0 : duckedVol * this.masterVolume;
    ch.getActiveSounds().forEach((sound) => {
      const howl = this.loader.getHowl(sound.pack);
      if (howl && fadeMs > 0) {
        howl.fade(howl.volume(sound.soundId) as unknown as number, effective, fadeMs, sound.soundId);
      } else {
        howl?.volume(effective, sound.soundId);
      }
    });
  }

  /** Restore a ducked channel to its original volume */
  public unduckChannel(channel: EngineAudio.Channel, fadeMs: number = 300): void {
    const originalVol = this.duckedChannels.get(channel);
    if (originalVol === undefined) return;

    this.duckedChannels.delete(channel);

    const ch = this.channels.get(channel);
    if (!ch) return;

    ch.setVolume(originalVol);

    const effective = this.muted ? 0 : originalVol * this.masterVolume;
    ch.getActiveSounds().forEach((sound) => {
      const howl = this.loader.getHowl(sound.pack);
      if (howl && fadeMs > 0) {
        howl.fade(howl.volume(sound.soundId) as unknown as number, effective, fadeMs, sound.soundId);
      } else {
        howl?.volume(effective, sound.soundId);
      }
    });
  }

  // ── Mute API ──────────────────────────────────────────────────────────────

  public mute(): void   { this.setMuted(true);  }
  public unmute(): void { this.setMuted(false); }
  public toggleMute(): void { this.setMuted(!this.muted); }
  public isMuted(): boolean { return this.muted; }

  private setMuted(muted: boolean): void {
    this.muted = muted;
    this.channels.forEach((ch) => ch.setMuted(muted));
    this.applyAllChannelVolumes();
    this.eventBus.emit('audio:mute', { muted });
    console.log(`${NS} ${muted ? '🔇 Muted' : '🔊 Unmuted'}`);
  }

  // ── Stop API ──────────────────────────────────────────────────────────────

  public stopChannel(channel: EngineAudio.Channel, fadeMs = 0): void {
    this.channels.get(channel)?.stopAll(this.masterVolume, fadeMs);
  }

  public stopAll(fadeMs = 0): void {
    this.channels.forEach((ch) => ch.stopAll(this.masterVolume, fadeMs));
  }

  // ── Engine Lifecycle Hooks ────────────────────────────────────────────────

  /** Call from engine on:pause — mutes all audio if configured */
  public onEnginePause(): void {
    if (this.config.muteOnPause && !this.muted) {
      this.setMuted(true);
      this.eventBus.emit('audio:suspended', {});
    }
  }

  /** Call from engine on:resume */
  public onEngineResume(): void {
    if (this.blurMuted) return; // still blurred
    if (this.muted && this.config.muteOnPause) {
      this.setMuted(false);
      this.eventBus.emit('audio:resumed', {});
    }
  }

  // ── Page Visibility ───────────────────────────────────────────────────────

  private onPageBlur(): void {
    if (!this.muted) {
      this.blurMuted = true;
      this.setMuted(true);
      this.eventBus.emit('audio:suspended', {});
    }
  }

  private onPageFocus(): void {
    if (this.blurMuted) {
      this.blurMuted = false;
      this.setMuted(false);
      this.eventBus.emit('audio:resumed', {});
    }
  }

  // ── Internal Helpers ──────────────────────────────────────────────────────

  /**
   * Search PRIMARY first, then SECONDARY for a sprite key.
   * Returns null if not found in any loaded pack.
   */
  private resolveSpritePack(sprite: string): EngineAudio.SpritePack | null {
    const searchOrder = [
      EngineAudio.SpritePack.PRIMARY,
      EngineAudio.SpritePack.SECONDARY,
    ];
    for (const pack of searchOrder) {
      if (this.loader.isLoaded(pack) && this.loader.hasSprite(pack, sprite)) {
        return pack;
      }
    }
    return null;
  }

  private applyAllChannelVolumes(): void {
    for (const channel of this.channels.keys()) {
      this.applyChannelVolumeToHowls(channel);
    }
  }

  private applyChannelVolumeToHowls(channel: EngineAudio.Channel): void {
    const ch = this.channels.get(channel);
    if (!ch) return;

    const effective = this.muted ? 0 : ch.getVolume() * this.masterVolume;

    // Apply to every active sound in this channel using both volume AND mute
    ch.getActiveSounds().forEach((sound) => {
      const howl = this.loader.getHowl(sound.pack);
      if (!howl) return;
      howl.mute(this.muted, sound.soundId);
      if (!this.muted) {
        howl.volume(effective, sound.soundId);
      }
    });
  }

  private guardReady(method: string): void {
    if (this.state !== EngineAudio.ManagerState.READY) {
      console.warn(`${NS} ${method}() called before AudioManager is ready (state: ${this.state})`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  public getState():    EngineAudio.ManagerState { return this.state; }
  public getEventBus(): AudioEventBus            { return this.eventBus; }
  public getLoader():   AudioSpriteLoader        { return this.loader; }

  /** Get current volume snapshot */
  public getVolumeState(): EngineAudio.VolumeState {
    return {
      master:  this.masterVolume,
      music:   this.channels.get(EngineAudio.Channel.MUSIC)?.getVolume()   ?? 0,
      sfx:     this.channels.get(EngineAudio.Channel.SFX)?.getVolume()     ?? 0,
      ambient: this.channels.get(EngineAudio.Channel.AMBIENT)?.getVolume() ?? 0,
      ui:      this.channels.get(EngineAudio.Channel.UI)?.getVolume()      ?? 0,
      voice:   this.channels.get(EngineAudio.Channel.VOICE)?.getVolume()   ?? 0,
      muted:   this.muted,
    };
  }

  // ── Destroy ───────────────────────────────────────────────────────────────

  public destroy(): void {
    window.removeEventListener('blur',  this.boundOnBlur);
    window.removeEventListener('focus', this.boundOnFocus);
    this.removeUnlockListeners();
    this.pendingMusic = null;

    this.stopAll(0);
    this.channels.forEach((ch) => ch.destroy());
    this.channels.clear();

    this.loader.destroy();
    this.eventBus.destroy();

    this.state         = EngineAudio.ManagerState.DESTROYED;
    AudioManager.instance = null;
    console.log(`${NS} Destroyed`);
  }
}
