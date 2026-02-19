/**
 * ScreenLayer - Main layer for game screens
 */

import { Container } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';

export class ScreenLayer extends LayerContainer {
  private currentScreen: Container | null = null;

  constructor() {
    super({
      name: 'ScreenLayer',
      zIndex: StageLayer.SCREEN,
    });
  }

  public setScreen(screen: Container): void {
    if (this.currentScreen) {
      this.removeChild(this.currentScreen);
    }
    this.currentScreen = screen;
    this.addChild(screen);
  }

  public clearScreen(): void {
    if (this.currentScreen) {
      this.removeChild(this.currentScreen);
      this.currentScreen = null;
    }
  }

  public getCurrentScreen(): Container | null {
    return this.currentScreen;
  }
}
