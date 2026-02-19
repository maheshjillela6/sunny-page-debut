/**
 * TimelineTypes - Type definitions for timeline system
 * Enhanced with CancellationToken for safe interruption
 */

/**
 * CancellationToken - Allows safe interruption of long-running operations
 * Used for turbo mode, skip, and timeline abort scenarios
 */
export interface CancellationToken {
  readonly isCancelled: boolean;
  onCancel(callback: () => void): void;
  throwIfCancelled(): void;
}

export class CancellationTokenImpl implements CancellationToken {
  private _isCancelled: boolean = false;
  private callbacks: Array<() => void> = [];

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  cancel(): void {
    if (this._isCancelled) return;
    this._isCancelled = true;
    
    // Execute all registered callbacks
    for (const callback of this.callbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[CancellationToken] Error in cancel callback:', error);
      }
    }
    this.callbacks = [];
  }

  onCancel(callback: () => void): void {
    if (this._isCancelled) {
      callback();
    } else {
      this.callbacks.push(callback);
    }
  }

  throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new Error('Operation was cancelled');
    }
  }
}

export interface TimelineAction {
  id: string;
  type: 'sequence' | 'parallel' | 'delay' | 'loop' | 'conditional' | 'callback';
  execute: (token?: CancellationToken) => Promise<void>; // Now supports cancellation
  duration?: number;
  priority?: number;
}

export interface TimelineState {
  isRunning: boolean;
  isPaused: boolean;
  isFailed: boolean; // Track error state
  currentActionIndex: number;
  elapsedTime: number;
  totalDuration: number;
  lastError?: Error; // Store last error for debugging
}

export interface TimelineConfig {
  loop: boolean;
  autoStart: boolean;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
  onError?: (error: Error) => void; // Error callback for boundary handling
}

export type ActionCallback = () => void | Promise<void>;

export interface ConditionalOptions {
  condition: () => boolean;
  onTrue: TimelineAction[];
  onFalse?: TimelineAction[];
}

export interface LoopOptions {
  count: number;
  actions: TimelineAction[];
  onIteration?: (index: number) => void;
}
