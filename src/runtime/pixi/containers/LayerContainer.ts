/**
 * LayerContainer - Container representing a z-index layer
 */

import { BaseContainer, ContainerConfig } from './BaseContainer';

export interface LayerConfig extends ContainerConfig {
  zIndex?: number;
  sortableChildren?: boolean;
}

/**
 * Container for a specific z-layer in the rendering hierarchy.
 */
export class LayerContainer extends BaseContainer {
  private layerIndex: number;

  constructor(config: LayerConfig = {}) {
    super(config);
    this.layerIndex = config.zIndex ?? 0;
    this.sortableChildren = config.sortableChildren ?? false;
    this.label = config.name || `Layer_${this.layerIndex}`;
  }

  /** Get layer index */
  public getLayerIndex(): number {
    return this.layerIndex;
  }

  /** Set layer index */
  public setLayerIndex(index: number): void {
    this.layerIndex = index;
    this.zIndex = index;
  }

  /** Sort children by zIndex */
  public sortByZIndex(): void {
    this.sortChildren();
  }
}
