/**
 * EngineMode - Engine operation modes
 */

export enum EngineMode {
  NORMAL = 'normal',
  TURBO = 'turbo',
  AUTO = 'auto',
  DEMO = 'demo',
  REPLAY = 'replay',
}

export interface EngineModeConfig {
  mode: EngineMode;
  speedMultiplier: number;
  skipAnimations: boolean;
  autoConfirm: boolean;
  allowInteraction: boolean;
}

const MODE_CONFIGS: Record<EngineMode, EngineModeConfig> = {
  [EngineMode.NORMAL]: {
    mode: EngineMode.NORMAL,
    speedMultiplier: 1,
    skipAnimations: false,
    autoConfirm: false,
    allowInteraction: true,
  },
  [EngineMode.TURBO]: {
    mode: EngineMode.TURBO,
    speedMultiplier: 2,
    skipAnimations: true,
    autoConfirm: true,
    allowInteraction: true,
  },
  [EngineMode.AUTO]: {
    mode: EngineMode.AUTO,
    speedMultiplier: 1.5,
    skipAnimations: false,
    autoConfirm: true,
    allowInteraction: true,
  },
  [EngineMode.DEMO]: {
    mode: EngineMode.DEMO,
    speedMultiplier: 1,
    skipAnimations: false,
    autoConfirm: false,
    allowInteraction: true,
  },
  [EngineMode.REPLAY]: {
    mode: EngineMode.REPLAY,
    speedMultiplier: 1,
    skipAnimations: false,
    autoConfirm: true,
    allowInteraction: false,
  },
};

export class EngineModeManager {
  private currentMode: EngineMode = EngineMode.NORMAL;
  private config: EngineModeConfig = MODE_CONFIGS[EngineMode.NORMAL];

  public getMode(): EngineMode {
    return this.currentMode;
  }

  public getConfig(): EngineModeConfig {
    return { ...this.config };
  }

  public setMode(mode: EngineMode): void {
    this.currentMode = mode;
    this.config = MODE_CONFIGS[mode];
    console.log(`[EngineModeManager] Mode changed to ${mode}`);
  }

  public getSpeedMultiplier(): number {
    return this.config.speedMultiplier;
  }

  public shouldSkipAnimations(): boolean {
    return this.config.skipAnimations;
  }

  public shouldAutoConfirm(): boolean {
    return this.config.autoConfirm;
  }

  public isInteractionAllowed(): boolean {
    return this.config.allowInteraction;
  }
}

export default EngineModeManager;
