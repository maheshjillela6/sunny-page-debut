/**
 * PresentationLayer - Layer for general presentations
 */

import { Container } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';

export class PresentationLayer extends LayerContainer {
  private presentationContainer: Container;

  constructor() {
    super({
      name: 'PresentationLayer',
      zIndex: StageLayer.PRESENTATION,
    });

    this.presentationContainer = new Container();
    this.presentationContainer.label = 'PresentationContainer';
    this.addChild(this.presentationContainer);
  }

  public getPresentationContainer(): Container {
    return this.presentationContainer;
  }

  public show(content: Container): void {
    this.presentationContainer.addChild(content);
    this.visible = true;
  }

  public hide(): void {
    this.presentationContainer.removeChildren();
    this.visible = false;
  }
}
