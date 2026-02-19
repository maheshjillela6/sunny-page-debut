/**
 * LayerRegistry - Registry for layer management
 */

import { Container } from 'pixi.js';
import { StageLayer } from './StageRoot';
import { LayerContainer } from '../containers/LayerContainer';

export interface LayerInfo {
  type: StageLayer;
  name: string;
  container: LayerContainer;
  childCount: number;
  visible: boolean;
}

/**
 * Registry tracking all layers and their contents.
 */
export class LayerRegistry {
  private layers: Map<StageLayer, LayerContainer> = new Map();

  /** Register a layer */
  public register(type: StageLayer, container: LayerContainer): void {
    this.layers.set(type, container);
  }

  /** Get a layer */
  public get(type: StageLayer): LayerContainer | undefined {
    return this.layers.get(type);
  }

  /** Get layer info */
  public getInfo(type: StageLayer): LayerInfo | undefined {
    const container = this.layers.get(type);
    if (!container) return undefined;

    return {
      type,
      name: StageLayer[type],
      container,
      childCount: container.children.length,
      visible: container.visible,
    };
  }

  /** Get all layer info */
  public getAllInfo(): LayerInfo[] {
    return Array.from(this.layers.entries()).map(([type, container]) => ({
      type,
      name: StageLayer[type],
      container,
      childCount: container.children.length,
      visible: container.visible,
    }));
  }

  /** Clear registry */
  public clear(): void {
    this.layers.clear();
  }
}
