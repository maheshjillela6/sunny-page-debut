/**
 * EngineGuards - Runtime validation guards for engine operations
 */

import { EngineState } from './EngineStateMachine';

export class EngineGuards {
  public static canStartSpin(state: EngineState): boolean {
    return state === EngineState.IDLE;
  }

  public static canStopSpin(state: EngineState): boolean {
    return state === EngineState.SPINNING;
  }

  public static canPause(state: EngineState): boolean {
    return state === EngineState.IDLE || state === EngineState.SPINNING;
  }

  public static canResume(state: EngineState): boolean {
    return state === EngineState.PAUSED;
  }

  public static canDestroy(state: EngineState): boolean {
    return state !== EngineState.DESTROYED;
  }

  public static canEnterFeature(state: EngineState): boolean {
    return state === EngineState.IDLE;
  }

  public static canExitFeature(state: EngineState): boolean {
    return state === EngineState.FEATURE;
  }

  public static isOperational(state: EngineState): boolean {
    return (
      state !== EngineState.UNINITIALIZED &&
      state !== EngineState.DESTROYED &&
      state !== EngineState.ERROR
    );
  }

  public static requireState(current: EngineState, required: EngineState): void {
    if (current !== required) {
      throw new Error(
        `[EngineGuards] Invalid state: expected ${required}, got ${current}`
      );
    }
  }

  public static requireOperational(state: EngineState): void {
    if (!EngineGuards.isOperational(state)) {
      throw new Error(
        `[EngineGuards] Engine is not operational: current state is ${state}`
      );
    }
  }
}

export default EngineGuards;
