/**
 * Engine.Audio — AudioController
 *
 * Namespace: EngineAudio  |  Global: Engine.Audio.Controller
 *
 * The single wiring layer between the game EventBus and AudioManager.
 * Subscribes to all relevant typed game events and translates them into
 * AudioManager.play() / playMusic() / stopMusic() calls using the
 * resolved per-game sprite key map from AudioConfigResolver.
 *
 * Architecture:
 *   EventBus (typed) → AudioController → AudioManager → Howler
 *
 * This class contains NO game-specific logic.
 * All sprite-key resolution is delegated to AudioConfigResolver.
 *
 * Usage (called from EngineKernel after AudioManager.initialize()):
 *   await AudioController.getInstance().mount(gameId);
 *   // on game exit:
 *   AudioController.getInstance().unmount();
 */

import { AudioManager }        from './AudioManager';
import { AudioConfigResolver, ResolvedAudioConfig } from './AudioConfigResolver';
import { EngineAudio }         from './types/AudioTypes';
import { EventBus }            from '@/platform/events/EventBus';

const NS = '[Engine.Audio.Controller]';

export class AudioController {
  private static instance: AudioController | null = null;

  private manager:  AudioManager;
  private resolver: AudioConfigResolver;
  private eventBus: EventBus;

  private gameId:  string | null = null;
  private mounted: boolean       = false;

  // Active loop handles
  private spinLoopHandle: EngineAudio.SoundHandle | null = null;

  // Ducking state
  private isDucked: boolean = false;
  private duckRestoreTimeout: ReturnType<typeof setTimeout> | null = null;

  // EventBus subscription IDs for cleanup
  private subIds: string[] = [];

  private constructor() {
    this.manager  = AudioManager.getInstance();
    this.resolver = AudioConfigResolver.getInstance();
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): AudioController {
    if (!AudioController.instance) {
      AudioController.instance = new AudioController();
    }
    return AudioController.instance;
  }

  // ── Mount / Unmount ──────────────────────────────────────────────────────

  /**
   * Load game audio config, apply per-game volumes, start base music,
   * and subscribe to all game EventBus events.
   * Call once per game session after AudioManager.initialize().
   */
  public async mount(gameId: string): Promise<void> {
    if (this.mounted) this.unmount();

    this.gameId  = gameId;
    this.mounted = true;

    // Load + cache game audio config (falls back to engine defaults if missing)
    const config = await this.resolver.resolve(gameId);

    // Load per-game sprite packs if the game specifies a custom basePath
    if (config.spritesBasePath) {
      await this.manager.loadGameSprites(config.spritesBasePath);
      console.log(`${NS} Loaded game sprites from: ${config.spritesBasePath}`);
    }

    // Apply per-game channel volumes
    this.manager.setMasterVolume(config.volumes.master);
    this.manager.setChannelVolume(EngineAudio.Channel.MUSIC,   config.volumes.music);
    this.manager.setChannelVolume(EngineAudio.Channel.SFX,     config.volumes.sfx);
    this.manager.setChannelVolume(EngineAudio.Channel.AMBIENT, config.volumes.ambient);
    this.manager.setChannelVolume(EngineAudio.Channel.UI,      config.volumes.ui);
    this.manager.setChannelVolume(EngineAudio.Channel.VOICE,   config.volumes.voice);

    // Subscribe to game events
    this.wireEvents();

    // Start base music
    const musicKey = config.musicBase;
    if (musicKey) {
      this.manager.playMusic(musicKey, undefined, 0, 1500)
        .catch((e) => console.warn(`${NS} Music start failed:`, e));
      console.log(`${NS} Started base music: "${musicKey}"`);
    }

    console.log(`${NS} Mounted for game "${gameId}"`);
  }

  /** Unsubscribe all EventBus listeners, stop loops and music */
  public unmount(): void {
    // Unsubscribe all
    for (const id of this.subIds) {
      this.eventBus.off(id);
    }
    this.subIds = [];

    // Stop loops
    this.spinLoopHandle?.stop();
    this.spinLoopHandle = null;

    // Fade out music
    this.manager.stopMusic(500);

    this.mounted = false;
    this.gameId  = null;
    console.log(`${NS} Unmounted`);
  }

  // ── Private: Event wiring ────────────────────────────────────────────────

  private wireEvents(): void {
    const config = this.gameId ? this.resolver.get(this.gameId) : null;
    const spinLoopStopEvent = config?.spinLoopStopEvent ?? 'reels_stopped';

    // ── Spin start: button sound + looping reel spin + duck music ────────
    this.subIds.push(
      this.eventBus.on('game:spin:start', () => {
        this.sfx('spin:start');
        this.duck(); // duck music during spin

        // Start looping reel spin sfx
        const loopKey = this.resolveKey('spin:loop');
        if (loopKey) {
          this.spinLoopHandle?.stop(); // stop previous if any
          this.spinLoopHandle = this.manager.play(loopKey, {
            channel:  EngineAudio.Channel.SFX,
            loop:     true,
            priority: EngineAudio.Priority.HIGH,
          });
        }
      })
    );

    // ── All reels stopped: conditionally stop spin loop ──────────────────
    if (spinLoopStopEvent === 'reels_stopped') {
      this.subIds.push(
        this.eventBus.on('game:reels:stopped', () => {
          this.spinLoopHandle?.stop();
          this.spinLoopHandle = null;
        })
      );
    }

    // ── Spin complete: stop sfx + restore ducking ─────────────────────────
    this.subIds.push(
      this.eventBus.on('game:spin:complete', () => {
        // If configured to stop loop on spin_complete, do it here
        if (spinLoopStopEvent === 'spin_complete') {
          this.spinLoopHandle?.stop();
          this.spinLoopHandle = null;
        }
        this.sfx('spin:stop');
        this.unduck();
      })
    );

    // ── Individual reel stops ─────────────────────────────────────────────
    this.subIds.push(
      this.eventBus.on('game:reel:spin:stop', (payload) => {
        const idx    = (payload.reelIndex ?? 0) + 1; // 1-based
        const key    = `reel:stop:${idx}`;
        const sprite = this.resolveKey(key) ?? this.resolveKey('reel:stop:1');
        if (sprite) {
          this.manager.play(sprite, { channel: EngineAudio.Channel.SFX });
        }
      })
    );

    // ── Win events ────────────────────────────────────────────────────────
    this.subIds.push(
      this.eventBus.on('game:win', (payload) => {
        const type = payload?.winType ?? 'any';

        // Duck music when win sounds play
        this.duck();

        // Play anticipation/win sound — map type to engine event key
        const key    = `win:${type}`;
        const sprite = this.resolveKey(key)
          ?? this.resolveKey('win:any');
        if (sprite) {
          this.manager.play(sprite, {
            channel:  EngineAudio.Channel.SFX,
            priority: EngineAudio.Priority.HIGH,
          });
        }
      })
    );

    // ── Cascade (tumble) step ─────────────────────────────────────────────
    this.subIds.push(
      this.eventBus.on('game:cascade:step:start', () => {
        this.sfx('win:anticipation');
      })
    );

    // ── Feature: free spins start → crossfade to FS music ─────────────────
    this.subIds.push(
      this.eventBus.on('feature:start', (payload) => {
        if (payload?.featureType === 'freeSpins') {
          const config = this.resolver.get(this.gameId ?? '');
          const fsKey  = config?.musicFS ?? 'mx_freespins_background_sound_v2';
          this.manager.playMusic(fsKey, undefined, 500, 1000)
            .catch(() => {});
        }
      })
    );

    // ── Feature: end → back to base music ─────────────────────────────────
    this.subIds.push(
      this.eventBus.on('feature:end', () => {
        const config   = this.resolver.get(this.gameId ?? '');
        const baseKey  = config?.musicBase ?? 'mx_background_sound';
        this.manager.playMusic(baseKey, undefined, 500, 1000)
          .catch(() => {});
      })
    );

    // ── UI button press ───────────────────────────────────────────────────
    this.subIds.push(
      this.eventBus.on('ui:button:press', () => {
        this.sfx('ui:click');
      })
    );

    console.log(`${NS} Wired ${this.subIds.length} game event subscriptions`);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Play a sound by engine event key on the SFX channel */
  private sfx(event: string): void {
    const sprite = this.resolveKey(event);
    if (!sprite) {
      console.debug(`${NS} No sprite mapped for event "${event}" — skipping`);
      return;
    }
    this.manager.play(sprite, { channel: EngineAudio.Channel.SFX });
  }

  /** Resolve an engine event name to a sprite key for the current game */
  private resolveKey(event: string): string | null {
    if (!this.gameId) return null;
    return this.resolver.getSpriteKey(this.gameId, event);
  }

  /** Get the current ducking config */
  private getDuckingConfig(): ResolvedAudioConfig['ducking'] {
    const config = this.gameId ? this.resolver.get(this.gameId) : null;
    return config?.ducking ?? { enabled: true, duckVolume: 0.3, fadeMs: 200, restoreMs: 300 };
  }

  /** Duck the music channel volume (lower it while high-priority sounds play) */
  private duck(): void {
    const ducking = this.getDuckingConfig();
    if (!ducking.enabled || this.isDucked) return;

    this.isDucked = true;
    if (this.duckRestoreTimeout) {
      clearTimeout(this.duckRestoreTimeout);
      this.duckRestoreTimeout = null;
    }

    this.manager.duckChannel(EngineAudio.Channel.MUSIC, ducking.duckVolume, ducking.fadeMs);
    console.debug(`${NS} 🔉 Music ducked to ${ducking.duckVolume}`);
  }

  /** Restore music channel volume after ducking */
  private unduck(): void {
    const ducking = this.getDuckingConfig();
    if (!ducking.enabled || !this.isDucked) return;

    if (this.duckRestoreTimeout) clearTimeout(this.duckRestoreTimeout);

    this.duckRestoreTimeout = setTimeout(() => {
      this.manager.unduckChannel(EngineAudio.Channel.MUSIC, ducking.restoreMs);
      this.isDucked = false;
      this.duckRestoreTimeout = null;
      console.debug(`${NS} 🔊 Music restored from duck`);
    }, 100); // small delay to avoid immediate restore if another duck event fires
  }

  public isActive(): boolean { return this.mounted; }

  public destroy(): void {
    if (this.duckRestoreTimeout) clearTimeout(this.duckRestoreTimeout);
    this.unmount();
    AudioController.instance = null;
  }
}
