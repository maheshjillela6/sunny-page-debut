/**
 * ScreenLifecycle - Lifecycle hooks for screens
 */

export enum ScreenState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ACTIVE = 'active',
  PAUSED = 'paused',
  DESTROYED = 'destroyed',
}

export interface IScreenLifecycle {
  onInit(): void;
  onEnter(): void;
  onExit(): void;
  onPause(): void;
  onResume(): void;
  onUpdate(deltaTime: number): void;
  onDestroy(): void;
}
