/**
 * ScreenComposer - Composes screens from configuration
 */

import { ScreenBase } from './ScreenBase';
import { ScreenManager } from './ScreenManager';

export interface ScreenConfig {
  id: string;
  type: string;
  layout?: unknown;
}

export class ScreenComposer {
  private screenManager: ScreenManager;

  constructor() {
    this.screenManager = ScreenManager.getInstance();
  }

  public composeFromConfig(config: ScreenConfig, screen: ScreenBase): void {
    this.screenManager.registerScreen(screen);
  }

  public activateScreen(screenId: string): void {
    this.screenManager.switchTo(screenId, false);
  }
}
