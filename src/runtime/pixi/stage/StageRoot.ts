/**
 * StageRoot - Root container for the game stage
 * Manages the main stage hierarchy.
 */

import { Container } from 'pixi.js';
import { BaseContainer } from '../containers/BaseContainer';
import { LayerContainer } from '../containers/LayerContainer';

export enum StageLayer {
  BACKGROUND = 0,
  DECOR_BACK = 100,
  TITLE = 200,
  SCREEN = 300,
  WIN = 400,
  FEATURE = 500,
  PRESENTATION = 600,
  TRANSITION = 700,
  TOAST = 800,
  OVERLAY = 900,
  HUD = 950,
  DEBUG = 1000,
}

/**
 * Root container managing all game layers.
 */
export class StageRoot extends BaseContainer {
  private layers: Map<StageLayer, LayerContainer> = new Map();

  constructor() {
    super({ name: 'StageRoot' });
    this.sortableChildren = true;
    this.initializeLayers();
  }

  /** Initialize all stage layers */
  private initializeLayers(): void {
    const layerOrder = [
      StageLayer.BACKGROUND,
      StageLayer.DECOR_BACK,
      StageLayer.TITLE,
      StageLayer.SCREEN,
      StageLayer.WIN,
      StageLayer.FEATURE,
      StageLayer.PRESENTATION,
      StageLayer.TRANSITION,
      StageLayer.TOAST,
      StageLayer.OVERLAY,
      StageLayer.HUD,
      StageLayer.DEBUG,
    ];

    for (const layerType of layerOrder) {
      const layer = new LayerContainer({
        name: StageLayer[layerType],
        zIndex: layerType,
      });
      layer.setLayerIndex(layerType);
      this.layers.set(layerType, layer);
      this.addChild(layer);
    }

    this.sortChildren();
  }

  /** Get a layer by type */
  public getLayer(type: StageLayer): LayerContainer {
    const layer = this.layers.get(type);
    if (!layer) {
      throw new Error(`[StageRoot] Layer not found: ${StageLayer[type]}`);
    }
    return layer;
  }

  /** Add content to a layer */
  public addToLayer(type: StageLayer, child: Container): void {
    const layer = this.getLayer(type);
    layer.addChild(child);
  }

  /** Remove content from a layer */
  public removeFromLayer(type: StageLayer, child: Container): void {
    const layer = this.getLayer(type);
    layer.removeChild(child);
  }

  /** Clear a layer */
  public clearLayer(type: StageLayer): void {
    const layer = this.getLayer(type);
    layer.removeChildren();
  }

  /** Clear all layers */
  public clearAllLayers(): void {
    for (const layer of this.layers.values()) {
      layer.removeChildren();
    }
  }

  /** Show a layer */
  public showLayer(type: StageLayer): void {
    const layer = this.getLayer(type);
    layer.visible = true;
  }

  /** Hide a layer */
  public hideLayer(type: StageLayer): void {
    const layer = this.getLayer(type);
    layer.visible = false;
  }

  /** Get all layers */
  public getAllLayers(): Map<StageLayer, LayerContainer> {
    return new Map(this.layers);
  }

  /** Destroy stage root */
  public override destroy(): void {
    this.layers.clear();
    super.destroy();
  }
}
