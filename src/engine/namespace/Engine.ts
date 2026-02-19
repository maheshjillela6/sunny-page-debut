/**
 * Engine — Global Namespace Barrel
 *
 * Single import point for all engine audio subsystems.
 *
 * Usage:
 *   import { Engine } from '@/engine/namespace/Engine';
 *
 *   Engine.Audio.Manager.getInstance().play('sx_spin_start');
 *   Engine.Audio.Controller.getInstance().mount('dragon-fortune');
 *   Engine.Audio.ConfigResolver.getInstance().resolve('dragon-fortune');
 */

export { EngineAudio, AUDIO_ENGINE_DEFAULTS } from '../audio/types/AudioTypes';
export { AudioManager }                       from '../audio/AudioManager';
export { AudioSpriteLoader }                  from '../audio/AudioSpriteLoader';
export { AudioChannel }                       from '../audio/AudioChannel';
export { AudioEventBus }                      from '../audio/AudioEventBus';
export { AudioController }                    from '../audio/AudioController';
export { AudioConfigResolver }                from '../audio/AudioConfigResolver';

/**
 * Engine namespace object — namespaced access to all audio subsystems.
 *
 * Engine.Audio.Manager        → AudioManager (playback, volume, mute)
 * Engine.Audio.Controller     → AudioController (EventBus → AudioManager wiring)
 * Engine.Audio.ConfigResolver → AudioConfigResolver (per-game sprite key resolution)
 * Engine.Audio.Loader         → AudioSpriteLoader (sprite pack loading)
 * Engine.Audio.Events         → AudioEventBus (typed audio lifecycle events)
 * Engine.Audio.Channel        → Channel enum
 * Engine.Audio.SpritePack     → SpritePack enum
 * Engine.Audio.Priority       → Priority enum
 */

import { AudioManager }        from '../audio/AudioManager';
import { AudioSpriteLoader }   from '../audio/AudioSpriteLoader';
import { AudioEventBus }       from '../audio/AudioEventBus';
import { AudioController }     from '../audio/AudioController';
import { AudioConfigResolver } from '../audio/AudioConfigResolver';
import { EngineAudio }         from '../audio/types/AudioTypes';

export const Engine = {
  Audio: {
    Manager:        AudioManager,
    Controller:     AudioController,
    ConfigResolver: AudioConfigResolver,
    Loader:         AudioSpriteLoader,
    Events:         AudioEventBus,
    Channel:        EngineAudio.Channel,
    SpritePack:     EngineAudio.SpritePack,
    Priority:       EngineAudio.Priority,
  },
} as const;
