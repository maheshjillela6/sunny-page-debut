/**
 * StageComposer - Composes stage from configuration
 */

import { StageManager } from './StageManager';
import { StageRoot, StageLayer } from './StageRoot';

export interface StageComposition {
  layers: {
    type: StageLayer;
    visible: boolean;
    alpha: number;
  }[];
}

/**
 * Composes and configures stage from data.
 */
export class StageComposer {
  private stageManager: StageManager;

  constructor(stageManager: StageManager) {
    this.stageManager = stageManager;
  }

  /** Apply a composition to the stage */
  public apply(composition: StageComposition): void {
    const root = this.stageManager.getStageRoot();

    for (const layerConfig of composition.layers) {
      const layer = root.getLayer(layerConfig.type);
      layer.visible = layerConfig.visible;
      layer.alpha = layerConfig.alpha;
    }
  }

  /** Create default composition */
  public createDefault(): StageComposition {
    return {
      layers: [
        { type: StageLayer.BACKGROUND, visible: true, alpha: 1 },
        { type: StageLayer.DECOR_BACK, visible: true, alpha: 1 },
        { type: StageLayer.TITLE, visible: true, alpha: 1 },
        { type: StageLayer.SCREEN, visible: true, alpha: 1 },
        { type: StageLayer.WIN, visible: true, alpha: 1 },
        { type: StageLayer.FEATURE, visible: true, alpha: 1 },
        { type: StageLayer.PRESENTATION, visible: true, alpha: 1 },
        { type: StageLayer.TRANSITION, visible: false, alpha: 1 },
        { type: StageLayer.TOAST, visible: true, alpha: 1 },
        { type: StageLayer.OVERLAY, visible: false, alpha: 1 },
        { type: StageLayer.HUD, visible: true, alpha: 1 },
        { type: StageLayer.DEBUG, visible: false, alpha: 1 },
      ],
    };
  }

  /** Create feature mode composition */
  public createFeatureMode(): StageComposition {
    return {
      layers: [
        { type: StageLayer.BACKGROUND, visible: true, alpha: 1 },
        { type: StageLayer.DECOR_BACK, visible: true, alpha: 1 },
        { type: StageLayer.TITLE, visible: false, alpha: 1 },
        { type: StageLayer.SCREEN, visible: true, alpha: 1 },
        { type: StageLayer.WIN, visible: true, alpha: 1 },
        { type: StageLayer.FEATURE, visible: true, alpha: 1 },
        { type: StageLayer.PRESENTATION, visible: true, alpha: 1 },
        { type: StageLayer.TRANSITION, visible: false, alpha: 1 },
        { type: StageLayer.TOAST, visible: true, alpha: 1 },
        { type: StageLayer.OVERLAY, visible: false, alpha: 1 },
        { type: StageLayer.HUD, visible: true, alpha: 1 },
        { type: StageLayer.DEBUG, visible: false, alpha: 1 },
      ],
    };
  }
}
