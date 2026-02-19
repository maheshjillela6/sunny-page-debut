/**
 * BaseScreenComposer - Composes the base screen
 */

import { BaseScreen } from './BaseScreen';
import { ScreenComposer, ScreenConfig } from '../ScreenComposer';

export class BaseScreenComposer {
  private composer: ScreenComposer;
  private screen: BaseScreen | null = null;

  constructor() {
    this.composer = new ScreenComposer();
  }

  public compose(): BaseScreen {
    this.screen = new BaseScreen();
    
    const config: ScreenConfig = {
      id: 'BaseScreen',
      type: 'base',
    };

    this.composer.composeFromConfig(config, this.screen);
    return this.screen;
  }

  public getScreen(): BaseScreen | null {
    return this.screen;
  }
}
