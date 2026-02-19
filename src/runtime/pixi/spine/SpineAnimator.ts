/**
 * SpineAnimator - Manages spine animation playback and state transitions
 */

import { EventBus } from '@/platform/events/EventBus';
import { ConfigManager } from '@/content/ConfigManager';
import { SpineContainerBase, SpineSymbolContainer } from './SpineFactory';

export interface SpineAnimationState {
  name: string;
  loop: boolean;
  timeScale: number;
  mixDuration: number;
  startTime?: number;
  endTime?: number;
}

export interface SpineTrackEntry {
  trackIndex: number;
  animation: SpineAnimationState;
  isComplete: boolean;
  onComplete?: () => void;
}

/**
 * SpineAnimator manages animation state machine for spine objects
 */
export class SpineAnimator {
  private container: SpineContainerBase;
  private eventBus: EventBus;
  private configManager: ConfigManager;
  
  private currentTrack: SpineTrackEntry | null = null;
  private queuedAnimations: SpineAnimationState[] = [];
  private defaultMixDuration: number = 0.2;
  private paused: boolean = false;
  private elapsedTime: number = 0;

  constructor(container: SpineContainerBase) {
    this.container = container;
    this.eventBus = EventBus.getInstance();
    this.configManager = ConfigManager.getInstance();
    
    this.loadConfig();
  }

  private loadConfig(): void {
    const animConfig = this.configManager.getValue<any>('animation.spine', {});
    this.defaultMixDuration = animConfig.defaultMixDuration ?? 0.2;
  }

  /**
   * Play an animation immediately
   */
  public play(
    animationName: string,
    loop: boolean = false,
    onComplete?: () => void
  ): void {
    const state: SpineAnimationState = {
      name: animationName,
      loop,
      timeScale: 1,
      mixDuration: this.defaultMixDuration,
    };

    this.currentTrack = {
      trackIndex: 0,
      animation: state,
      isComplete: false,
      onComplete,
    };

    this.container.play(animationName, loop, () => {
      if (this.currentTrack) {
        this.currentTrack.isComplete = true;
        this.currentTrack.onComplete?.();
        this.processQueue();
      }
    });
  }

  /**
   * Queue an animation to play after current
   */
  public queue(animationName: string, loop: boolean = false): void {
    this.queuedAnimations.push({
      name: animationName,
      loop,
      timeScale: 1,
      mixDuration: this.defaultMixDuration,
    });
  }

  /**
   * Process queued animations
   */
  private processQueue(): void {
    if (this.queuedAnimations.length === 0) return;

    const next = this.queuedAnimations.shift()!;
    this.play(next.name, next.loop);
  }

  /**
   * Clear animation queue
   */
  public clearQueue(): void {
    this.queuedAnimations = [];
  }

  /**
   * Stop current animation
   */
  public stop(): void {
    this.container.stop();
    this.currentTrack = null;
  }

  /**
   * Pause animation
   */
  public pause(): void {
    this.paused = true;
    this.container.setTimeScale(0);
  }

  /**
   * Resume animation
   */
  public resume(): void {
    this.paused = false;
    this.container.setTimeScale(this.currentTrack?.animation.timeScale ?? 1);
  }

  /**
   * Set animation time scale
   */
  public setTimeScale(scale: number): void {
    if (this.currentTrack) {
      this.currentTrack.animation.timeScale = scale;
    }
    if (!this.paused) {
      this.container.setTimeScale(scale);
    }
  }

  /**
   * Check if animation is playing
   */
  public isPlaying(): boolean {
    return this.container.getIsPlaying();
  }

  /**
   * Check if paused
   */
  public isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get current animation name
   */
  public getCurrentAnimation(): string {
    return this.currentTrack?.animation.name ?? '';
  }

  /**
   * Update animator (for manual time tracking)
   */
  public update(deltaTime: number): void {
    if (this.paused) return;
    this.elapsedTime += deltaTime;
  }

  /**
   * Reset animator
   */
  public reset(): void {
    this.stop();
    this.clearQueue();
    this.paused = false;
    this.elapsedTime = 0;
  }

  public destroy(): void {
    this.reset();
  }
}

/**
 * SpineSymbolAnimator - Specialized animator for symbol animations
 */
export class SpineSymbolAnimator extends SpineAnimator {
  private symbolContainer: SpineSymbolContainer;
  private symbolId: string;

  constructor(container: SpineSymbolContainer, symbolId: string) {
    super(container);
    this.symbolContainer = container;
    this.symbolId = symbolId;
  }

  /**
   * Play idle animation
   */
  public playIdle(): void {
    this.symbolContainer.playIdle(true);
  }

  /**
   * Play land animation then idle
   */
  public playLandThenIdle(onLandComplete?: () => void): void {
    this.symbolContainer.playLand(() => {
      onLandComplete?.();
      this.playIdle();
    });
  }

  /**
   * Play win animation based on win tier
   */
  public playWin(winTier: 'low' | 'high', onComplete?: () => void): void {
    if (winTier === 'high') {
      this.symbolContainer.playHighWin(onComplete);
    } else {
      this.symbolContainer.playLowWin(onComplete);
    }
  }

  /**
   * Play anticipation animation
   */
  public playAnticipation(): void {
    this.symbolContainer.playAnticipation(true);
  }

  public getSymbolId(): string {
    return this.symbolId;
  }
}

export default SpineAnimator;
