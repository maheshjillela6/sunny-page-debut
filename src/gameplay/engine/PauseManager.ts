/**
 * PauseManager - Handles game pause/resume states
 */

import { EventBus } from '@/platform/events/EventBus';
import { GameClock } from './GameClock';
import { Scheduler } from './Scheduler';

export type PauseReason = 'user' | 'blur' | 'modal' | 'network' | 'error';

export interface PauseState {
  isPaused: boolean;
  reason: PauseReason | null;
  pausedAt: number;
  duration: number;
}

export class PauseManager {
  private static instance: PauseManager | null = null;

  private eventBus: EventBus;
  private clock: GameClock;
  private scheduler: Scheduler;
  private state: PauseState;
  private pauseStack: PauseReason[] = [];

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.clock = GameClock.getInstance();
    this.scheduler = Scheduler.getInstance();
    
    this.state = {
      isPaused: false,
      reason: null,
      pausedAt: 0,
      duration: 0,
    };

    this.setupEventListeners();
  }

  public static getInstance(): PauseManager {
    if (!PauseManager.instance) {
      PauseManager.instance = new PauseManager();
    }
    return PauseManager.instance;
  }

  private setupEventListeners(): void {
    // Auto-pause on window blur
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => this.pause('blur'));
      window.addEventListener('focus', () => this.resume('blur'));
    }

    // Pause on modal open
    this.eventBus.on('ui:modal:open', () => {
      this.pause('modal');
    });

    this.eventBus.on('ui:modal:close', () => {
      this.resume('modal');
    });
  }

  public pause(reason: PauseReason = 'user'): void {
    // Add to pause stack
    if (!this.pauseStack.includes(reason)) {
      this.pauseStack.push(reason);
    }

    if (this.state.isPaused) return;

    this.state.isPaused = true;
    this.state.reason = reason;
    this.state.pausedAt = Date.now();

    this.clock.pause();
    this.scheduler.pause();

    this.eventBus.emit('engine:pause', { reason });
    console.log(`[PauseManager] Game paused: ${reason}`);
  }

  public resume(reason?: PauseReason): void {
    // Remove from pause stack
    if (reason) {
      const index = this.pauseStack.indexOf(reason);
      if (index > -1) {
        this.pauseStack.splice(index, 1);
      }
    } else {
      this.pauseStack = [];
    }

    // Only resume if no other pause reasons remain
    if (this.pauseStack.length > 0) {
      return;
    }

    if (!this.state.isPaused) return;

    this.state.duration = Date.now() - this.state.pausedAt;
    this.state.isPaused = false;
    this.state.reason = null;

    this.clock.resume();
    this.scheduler.resume();

    this.eventBus.emit('engine:resume', { pausedDuration: this.state.duration });
    console.log(`[PauseManager] Game resumed after ${this.state.duration}ms`);
  }

  public toggle(): void {
    if (this.state.isPaused) {
      this.resume();
    } else {
      this.pause('user');
    }
  }

  public isPaused(): boolean {
    return this.state.isPaused;
  }

  public getState(): PauseState {
    return { ...this.state };
  }

  public getPauseStack(): PauseReason[] {
    return [...this.pauseStack];
  }

  public destroy(): void {
    PauseManager.instance = null;
  }
}

export default PauseManager;
