/**
 * EngineStateMachine - State machine for engine states
 */

export enum EngineState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  SPINNING = 'spinning',
  EVALUATING = 'evaluating',
  PRESENTING = 'presenting',
  FEATURE = 'feature',
  PAUSED = 'paused',
  ERROR = 'error',
  DESTROYED = 'destroyed',
}

export type StateTransition = {
  from: EngineState | EngineState[];
  to: EngineState;
  guard?: () => boolean;
};

const VALID_TRANSITIONS: StateTransition[] = [
  { from: EngineState.UNINITIALIZED, to: EngineState.INITIALIZING },
  { from: EngineState.INITIALIZING, to: EngineState.IDLE },
  { from: EngineState.INITIALIZING, to: EngineState.ERROR },
  { from: EngineState.IDLE, to: EngineState.SPINNING },
  { from: EngineState.IDLE, to: EngineState.FEATURE },
  { from: EngineState.IDLE, to: EngineState.PAUSED },
  { from: EngineState.IDLE, to: EngineState.DESTROYED },
  { from: EngineState.SPINNING, to: EngineState.EVALUATING },
  { from: EngineState.SPINNING, to: EngineState.PAUSED },
  { from: EngineState.SPINNING, to: EngineState.ERROR },
  { from: EngineState.EVALUATING, to: EngineState.PRESENTING },
  { from: EngineState.EVALUATING, to: EngineState.FEATURE },
  { from: EngineState.EVALUATING, to: EngineState.ERROR },
  { from: EngineState.PRESENTING, to: EngineState.IDLE },
  { from: EngineState.PRESENTING, to: EngineState.FEATURE },
  { from: EngineState.PRESENTING, to: EngineState.ERROR },
  { from: EngineState.FEATURE, to: EngineState.IDLE },
  { from: EngineState.FEATURE, to: EngineState.SPINNING },
  { from: EngineState.FEATURE, to: EngineState.ERROR },
  { from: EngineState.PAUSED, to: EngineState.IDLE },
  { from: EngineState.PAUSED, to: EngineState.SPINNING },
  { from: EngineState.PAUSED, to: EngineState.DESTROYED },
  { from: EngineState.ERROR, to: EngineState.IDLE },
  { from: EngineState.ERROR, to: EngineState.DESTROYED },
];

export type StateChangeCallback = (from: EngineState, to: EngineState) => void;

export class EngineStateMachine {
  private state: EngineState = EngineState.UNINITIALIZED;
  private listeners: StateChangeCallback[] = [];
  private stateHistory: Array<{ state: EngineState; timestamp: number }> = [];
  private maxHistorySize: number = 50;

  public getState(): EngineState {
    return this.state;
  }

  public getHistory(): Array<{ state: EngineState; timestamp: number }> {
    return [...this.stateHistory];
  }

  public canTransitionTo(targetState: EngineState): boolean {
    return VALID_TRANSITIONS.some((transition) => {
      const fromStates = Array.isArray(transition.from)
        ? transition.from
        : [transition.from];
      return (
        fromStates.includes(this.state) &&
        transition.to === targetState &&
        (transition.guard ? transition.guard() : true)
      );
    });
  }

  public transitionTo(targetState: EngineState): boolean {
    if (!this.canTransitionTo(targetState)) {
      console.warn(
        `[EngineStateMachine] Invalid transition from ${this.state} to ${targetState}`
      );
      return false;
    }

    const previousState = this.state;
    this.state = targetState;

    this.stateHistory.push({ state: targetState, timestamp: Date.now() });
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    this.notifyListeners(previousState, targetState);
    return true;
  }

  public forceState(state: EngineState): void {
    const previousState = this.state;
    this.state = state;
    this.notifyListeners(previousState, state);
  }

  public addListener(callback: StateChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(from: EngineState, to: EngineState): void {
    for (const listener of this.listeners) {
      try {
        listener(from, to);
      } catch (error) {
        console.error('[EngineStateMachine] Listener error:', error);
      }
    }
  }

  public isSpinning(): boolean {
    return (
      this.state === EngineState.SPINNING ||
      this.state === EngineState.EVALUATING ||
      this.state === EngineState.PRESENTING
    );
  }

  public isIdle(): boolean {
    return this.state === EngineState.IDLE;
  }

  public isInFeature(): boolean {
    return this.state === EngineState.FEATURE;
  }

  public isPaused(): boolean {
    return this.state === EngineState.PAUSED;
  }

  public hasError(): boolean {
    return this.state === EngineState.ERROR;
  }

  public reset(): void {
    this.state = EngineState.UNINITIALIZED;
    this.stateHistory = [];
  }
}

export default EngineStateMachine;
