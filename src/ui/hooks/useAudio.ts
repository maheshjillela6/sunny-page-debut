/**
 * Engine.Audio — useAudio (React Hook)
 *
 * Namespace: EngineAudio
 * React bridge for the engine-level AudioManager.
 *
 * Replaces the previous standalone useAudio hook.
 * All volume/mute state is sourced from AudioManager — no duplicate state.
 *
 * Usage:
 *   const audio = useAudio();
 *   audio.play('sx_spin_start');
 *   audio.playMusic('mx_background_sound');
 *   audio.setChannelVolume(Engine.Audio.Channel.SFX, 0.8);
 *   audio.toggleMute();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioManager }   from '@/engine/audio/AudioManager';
import { AudioEventBus }  from '@/engine/audio/AudioEventBus';
import { EngineAudio }    from '@/engine/audio/types/AudioTypes';

export interface UseAudioReturn {
  // ── State ──────────────────────────────────────────────────────────────
  isReady:      boolean;
  isMuted:      boolean;
  masterVolume: number;
  musicVolume:  number;
  sfxVolume:    number;
  ambientVolume: number;
  uiVolume:     number;

  // ── Playback ───────────────────────────────────────────────────────────
  /** Play any sprite — auto-resolves pack (PRIMARY → SECONDARY) */
  play: (sprite: string, options?: EngineAudio.PlayOptions) => EngineAudio.SoundHandle | null;

  /** Play from an explicit pack */
  playFromPack: (
    pack:    EngineAudio.SpritePack,
    sprite:  string,
    options?: EngineAudio.PlayOptions
  ) => EngineAudio.SoundHandle | null;

  /** Crossfade to a new music track */
  playMusic: (sprite: string, pack?: EngineAudio.SpritePack, fadeOutMs?: number, fadeInMs?: number) => Promise<void>;

  /** Stop music with optional fade */
  stopMusic: (fadeMs?: number) => void;

  // ── Volume ──────────────────────────────────────────────────────────────
  setMasterVolume:  (value: number) => void;
  setChannelVolume: (channel: EngineAudio.Channel, value: number) => void;

  // ── Mute ───────────────────────────────────────────────────────────────
  mute:        () => void;
  unmute:      () => void;
  toggleMute:  () => void;

  // ── Stop ───────────────────────────────────────────────────────────────
  stopAll:     (fadeMs?: number) => void;
  stopChannel: (channel: EngineAudio.Channel, fadeMs?: number) => void;

  // ── Enum shortcuts (no extra import needed in components) ──────────────
  Channel:    typeof EngineAudio.Channel;
  SpritePack: typeof EngineAudio.SpritePack;
  Priority:   typeof EngineAudio.Priority;
}

export function useAudio(): UseAudioReturn {
  const manager  = useRef<AudioManager>(AudioManager.getInstance());
  const eventBus = useRef<AudioEventBus>(AudioEventBus.getInstance());

  const [isReady,       setIsReady]       = useState(() => manager.current.getState() === EngineAudio.ManagerState.READY);
  const [volumeState,   setVolumeState]   = useState<EngineAudio.VolumeState>(() => manager.current.getVolumeState());

  // ── Subscribe to audio events for reactive state ─────────────────────

  useEffect(() => {
    const bus = eventBus.current;

    const onReady = () => {
      setIsReady(true);
      setVolumeState(manager.current.getVolumeState());
    };

    const onMute = ({ muted }: EngineAudio.AudioMutePayload) => {
      setVolumeState((prev) => ({ ...prev, muted }));
    };

    const onVolume = () => {
      setVolumeState(manager.current.getVolumeState());
    };

    bus.on('audio:ready',         onReady);
    bus.on('audio:mute',          onMute);
    bus.on('audio:volume:change', onVolume);

    return () => {
      bus.off('audio:ready',         onReady);
      bus.off('audio:mute',          onMute);
      bus.off('audio:volume:change', onVolume);
    };
  }, []);

  // ── Stable callbacks ──────────────────────────────────────────────────

  const play = useCallback(
    (sprite: string, options?: EngineAudio.PlayOptions) =>
      manager.current.play(sprite, options),
    []
  );

  const playFromPack = useCallback(
    (pack: EngineAudio.SpritePack, sprite: string, options?: EngineAudio.PlayOptions) =>
      manager.current.playFromPack(pack, sprite, options),
    []
  );

  const playMusic = useCallback(
    (sprite: string, pack?: EngineAudio.SpritePack, fadeOutMs?: number, fadeInMs?: number) =>
      manager.current.playMusic(sprite, pack, fadeOutMs, fadeInMs),
    []
  );

  const stopMusic = useCallback(
    (fadeMs?: number) => manager.current.stopMusic(fadeMs),
    []
  );

  const setMasterVolume = useCallback((value: number) => {
    manager.current.setMasterVolume(value);
    setVolumeState(manager.current.getVolumeState());
  }, []);

  const setChannelVolume = useCallback((channel: EngineAudio.Channel, value: number) => {
    manager.current.setChannelVolume(channel, value);
    setVolumeState(manager.current.getVolumeState());
  }, []);

  const mute       = useCallback(() => manager.current.mute(),       []);
  const unmute     = useCallback(() => manager.current.unmute(),     []);
  const toggleMute = useCallback(() => manager.current.toggleMute(), []);

  const stopAll = useCallback(
    (fadeMs?: number) => manager.current.stopAll(fadeMs),
    []
  );

  const stopChannel = useCallback(
    (channel: EngineAudio.Channel, fadeMs?: number) =>
      manager.current.stopChannel(channel, fadeMs),
    []
  );

  return {
    isReady,
    isMuted:       volumeState.muted,
    masterVolume:  volumeState.master,
    musicVolume:   volumeState.music,
    sfxVolume:     volumeState.sfx,
    ambientVolume: volumeState.ambient,
    uiVolume:      volumeState.ui,

    play,
    playFromPack,
    playMusic,
    stopMusic,

    setMasterVolume,
    setChannelVolume,

    mute,
    unmute,
    toggleMute,

    stopAll,
    stopChannel,

    Channel:    EngineAudio.Channel,
    SpritePack: EngineAudio.SpritePack,
    Priority:   EngineAudio.Priority,
  };
}

export default useAudio;
