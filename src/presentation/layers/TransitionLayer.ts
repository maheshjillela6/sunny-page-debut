/**
 * TransitionLayer - Layer for screen transitions
 * Data-driven via /public/game-configs/games/<id>/layers/transition.layer.json
 */

import { Graphics } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';
import { TweenFactory } from '../../runtime/animation/TweenFactory';
import {
  LayerConfigManager,
  parsePixiColor,
  type TransitionLayerConfig,
} from './config/LayerConfigManager';

export class TransitionLayer extends LayerContainer {
  private fadeGraphics: Graphics;
  private isFading: boolean = false;

  private cfg: TransitionLayerConfig = {};
  private cfgManager = LayerConfigManager.getInstance();

  constructor() {
    super({
      name: 'TransitionLayer',
      zIndex: StageLayer.TRANSITION,
    });

    this.fadeGraphics = new Graphics();
    this.addChild(this.fadeGraphics);

    this.visible = false;
    this.alpha = 0;

    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      this.cfg = await this.cfgManager.getTransitionConfig();
    } catch (e) {
      console.error('[TransitionLayer] Failed to load transition layer config:', e);
      this.cfg = {};
    }
    this.rebuildGraphics();
  }

  private rebuildGraphics(): void {
    this.fadeGraphics.clear();
    const color = parsePixiColor(this.cfg.fadeColor, 0x000000);
    this.fadeGraphics.rect(0, 0, vw(), vh());
    this.fadeGraphics.fill({ color });
  }

  public async fadeIn(duration?: number): Promise<void> {
    if (this.isFading) return;
    this.isFading = true;
    this.visible = true;
    this.rebuildGraphics();

    const dur = (duration ?? this.cfg.defaultFadeInMs ?? 300) / 1000;

    return new Promise((resolve) => {
      TweenFactory.to(this, {
        alpha: 1,
        duration: dur,
        onComplete: () => {
          this.isFading = false;
          resolve();
        },
      });
    });
  }

  public async fadeOut(duration?: number): Promise<void> {
    if (this.isFading) return;
    this.isFading = true;

    const dur = (duration ?? this.cfg.defaultFadeOutMs ?? 300) / 1000;

    return new Promise((resolve) => {
      TweenFactory.to(this, {
        alpha: 0,
        duration: dur,
        onComplete: () => {
          this.visible = false;
          this.isFading = false;
          resolve();
        },
      });
    });
  }
}
