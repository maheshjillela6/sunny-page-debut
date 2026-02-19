/**
 * ScreenBase - Base class for all game screens
 */

import { Container } from 'pixi.js';
import { ScreenState, IScreenLifecycle } from './ScreenLifecycle';

export abstract class ScreenBase extends Container implements IScreenLifecycle {
  protected screenState: ScreenState = ScreenState.UNINITIALIZED;
  protected screenId: string;

  constructor(screenId: string) {
    super();
    this.screenId = screenId;
    this.label = screenId;
  }

  public getScreenId(): string {
    return this.screenId;
  }

  public getScreenState(): ScreenState {
    return this.screenState;
  }

  public init(): void {
    if (this.screenState !== ScreenState.UNINITIALIZED) return;
    this.screenState = ScreenState.INITIALIZING;
    this.onInit();
    this.screenState = ScreenState.READY;
  }

  public enter(): void {
    if (this.screenState !== ScreenState.READY && this.screenState !== ScreenState.PAUSED) return;
    this.onEnter();
    this.screenState = ScreenState.ACTIVE;
    this.visible = true;
  }

  public exit(): void {
    if (this.screenState !== ScreenState.ACTIVE) return;
    this.onExit();
    this.screenState = ScreenState.READY;
    this.visible = false;
  }

  public pause(): void {
    if (this.screenState !== ScreenState.ACTIVE) return;
    this.onPause();
    this.screenState = ScreenState.PAUSED;
  }

  public resume(): void {
    if (this.screenState !== ScreenState.PAUSED) return;
    this.onResume();
    this.screenState = ScreenState.ACTIVE;
  }

  public update(deltaTime: number): void {
    if (this.screenState === ScreenState.ACTIVE) {
      this.onUpdate(deltaTime);
    }
  }

  public override destroy(): void {
    this.onDestroy();
    this.screenState = ScreenState.DESTROYED;
    super.destroy({ children: true });
  }

  // Lifecycle hooks - override in subclasses
  public onInit(): void {}
  public onEnter(): void {}
  public onExit(): void {}
  public onPause(): void {}
  public onResume(): void {}
  public onUpdate(deltaTime: number): void {}
  public onDestroy(): void {}
}
