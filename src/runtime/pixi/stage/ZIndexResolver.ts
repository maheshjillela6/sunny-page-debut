/**
 * ZIndexResolver - Resolves z-index values
 */

import { StageLayer } from './StageRoot';

export interface ZIndexRange {
  base: number;
  max: number;
}

/**
 * Resolves z-index values within layers.
 */
export class ZIndexResolver {
  private layerRanges: Map<StageLayer, ZIndexRange> = new Map();

  constructor() {
    this.initializeRanges();
  }

  /** Initialize z-index ranges for layers */
  private initializeRanges(): void {
    // Each layer gets a range of 100 z-indices
    const layers = [
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
      StageLayer.DEBUG,
    ];

    for (const layer of layers) {
      this.layerRanges.set(layer, {
        base: layer,
        max: layer + 99,
      });
    }
  }

  /** Get z-index for element within a layer */
  public resolve(layer: StageLayer, offset: number = 0): number {
    const range = this.layerRanges.get(layer);
    if (!range) {
      console.warn(`[ZIndexResolver] Unknown layer: ${layer}`);
      return offset;
    }

    return Math.min(range.base + offset, range.max);
  }

  /** Get range for a layer */
  public getRange(layer: StageLayer): ZIndexRange | undefined {
    return this.layerRanges.get(layer);
  }

  /** Check if z-index is valid for layer */
  public isValidForLayer(layer: StageLayer, zIndex: number): boolean {
    const range = this.layerRanges.get(layer);
    if (!range) return false;
    return zIndex >= range.base && zIndex <= range.max;
  }
}
