/**
 * SlotEngine - Main slot engine facade
 */

import { EngineKernel } from './EngineKernel';
import { EngineStateMachine, EngineState } from './EngineStateMachine';
import { EngineModeManager, EngineMode } from './EngineMode';
import { EngineLifecycle } from './EngineLifecycle';
import { EngineGuards } from './EngineGuards';
import { EventBus } from '@/platform/events/EventBus';
import { GameController } from '@/gameplay/engine/GameController';

export class SlotEngine {
  private static instance: SlotEngine | null = null;

  private kernel: EngineKernel | null = null;
  private stateMachine: EngineStateMachine;
  private modeManager: EngineModeManager;
  private lifecycle: EngineLifecycle;
  private gameController: GameController | null = null;
  private eventBus: EventBus;

  private constructor() {
    this.stateMachine = new EngineStateMachine();
    this.modeManager = new EngineModeManager();
    this.lifecycle = new EngineLifecycle();
    this.eventBus = EventBus.getInstance();

    this.setupEventListeners();
  }

  public static getInstance(): SlotEngine {
    if (!SlotEngine.instance) {
      SlotEngine.instance = new SlotEngine();
    }
    return SlotEngine.instance;
  }

  public static destroyInstance(): void {
    if (SlotEngine.instance) {
      SlotEngine.instance.destroy();
      SlotEngine.instance = null;
    }
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:request', (payload) => {
      this.requestSpin(payload.bet, payload.lines);
    });

    this.stateMachine.addListener((from, to) => {
      console.log(`[SlotEngine] State: ${from} -> ${to}`);
    });
  }

  public async initialize(container: HTMLElement, gameId?: string): Promise<void> {
    if (this.stateMachine.getState() !== EngineState.UNINITIALIZED) {
      console.warn('[SlotEngine] Already initialized');
      return;
    }

    this.stateMachine.transitionTo(EngineState.INITIALIZING);

    try {
      await this.lifecycle.onInit();

      this.kernel = EngineKernel.getInstance();
      await this.kernel.initialize({
        containerId: container.id || 'game-container',
        gameId: gameId || 'neon-nights',
      });

      this.gameController = GameController.getInstance();

      this.stateMachine.transitionTo(EngineState.IDLE);
      this.lifecycle.onReady();

      this.eventBus.emit('engine:ready', { timestamp: Date.now() });
    } catch (error) {
      this.stateMachine.transitionTo(EngineState.ERROR);
      this.lifecycle.onError(error as Error);
      this.eventBus.emit('engine:error', {
        error: error as Error,
        context: 'initialization',
      });
      throw error;
    }
  }

  public requestSpin(bet: number, lines: number): void {
    if (!EngineGuards.canStartSpin(this.stateMachine.getState())) {
      console.warn('[SlotEngine] Cannot start spin in current state');
      return;
    }

    this.stateMachine.transitionTo(EngineState.SPINNING);

    this.eventBus.emit('game:spin:start', {
      bet,
    });
  }

  public stopSpin(): void {
    if (!EngineGuards.canStopSpin(this.stateMachine.getState())) {
      console.warn('[SlotEngine] Cannot stop spin in current state');
      return;
    }
  }

  public pause(): void {
    if (!EngineGuards.canPause(this.stateMachine.getState())) {
      return;
    }

    this.stateMachine.transitionTo(EngineState.PAUSED);
    this.lifecycle.onPause();
    this.eventBus.emit('engine:pause', { reason: 'user' });
  }

  public resume(): void {
    if (!EngineGuards.canResume(this.stateMachine.getState())) {
      return;
    }

    const pausedDuration = 0;
    this.stateMachine.transitionTo(EngineState.IDLE);
    this.lifecycle.onResume();
    this.eventBus.emit('engine:resume', { pausedDuration });
  }

  public setMode(mode: EngineMode): void {
    this.modeManager.setMode(mode);
  }

  public getMode(): EngineMode {
    return this.modeManager.getMode();
  }

  public getState(): EngineState {
    return this.stateMachine.getState();
  }

  public isSpinning(): boolean {
    return this.stateMachine.isSpinning();
  }

  public isIdle(): boolean {
    return this.stateMachine.isIdle();
  }

  public destroy(): void {
    if (!EngineGuards.canDestroy(this.stateMachine.getState())) {
      return;
    }

    this.stateMachine.transitionTo(EngineState.DESTROYED);
    this.lifecycle.onDestroy();

    if (this.kernel) {
      this.kernel.destroy();
      this.kernel = null;
    }

    this.eventBus.emit('engine:destroy', undefined);
  }

  private generateRoundId(): string {
    return `round_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default SlotEngine;
