/**
 * ScreenManager - Manages screen lifecycle and transitions
 */

import { ScreenBase } from './ScreenBase';
import { ScreenLayer } from '../layers/ScreenLayer';
import { TransitionLayer } from '../layers/TransitionLayer';
import { EventBus } from '../../platform/events/EventBus';

export class ScreenManager {
  private static instance: ScreenManager | null = null;

  private screens: Map<string, ScreenBase> = new Map();
  private currentScreen: ScreenBase | null = null;
  private screenLayer: ScreenLayer | null = null;
  private transitionLayer: TransitionLayer | null = null;
  private eventBus: EventBus;

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): ScreenManager {
    if (!ScreenManager.instance) {
      ScreenManager.instance = new ScreenManager();
    }
    return ScreenManager.instance;
  }

  public initialize(screenLayer: ScreenLayer, transitionLayer: TransitionLayer): void {
    this.screenLayer = screenLayer;
    this.transitionLayer = transitionLayer;
  }

  public registerScreen(screen: ScreenBase): void {
    const screenId = screen.getScreenId();
    if (this.screens.has(screenId)) {
      console.warn(`[ScreenManager] Screen ${screenId} already registered`);
      return;
    }
    this.screens.set(screenId, screen);
    screen.init();
  }

  public async switchTo(screenId: string, transition: boolean = true): Promise<void> {
    const nextScreen = this.screens.get(screenId);
    if (!nextScreen) {
      console.error(`[ScreenManager] Screen ${screenId} not found`);
      return;
    }

    if (!this.screenLayer) {
      console.error('[ScreenManager] Screen layer not set');
      return;
    }

    if (transition && this.transitionLayer) {
      await this.transitionLayer.fadeIn(200);
    }

    if (this.currentScreen) {
      this.currentScreen.exit();
      this.screenLayer.clearScreen();
    }

    this.currentScreen = nextScreen;
    this.screenLayer.setScreen(nextScreen);
    nextScreen.enter();

    if (transition && this.transitionLayer) {
      await this.transitionLayer.fadeOut(200);
    }
  }

  public getCurrentScreen(): ScreenBase | null {
    return this.currentScreen;
  }

  public getScreen(screenId: string): ScreenBase | undefined {
    return this.screens.get(screenId);
  }

  public update(deltaTime: number): void {
    if (this.currentScreen) {
      this.currentScreen.update(deltaTime);
    }
  }

  public destroy(): void {
    for (const screen of this.screens.values()) {
      screen.destroy();
    }
    this.screens.clear();
    this.currentScreen = null;
    ScreenManager.instance = null;
  }
}
