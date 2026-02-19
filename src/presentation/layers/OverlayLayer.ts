/**
 * OverlayLayer - Layer for modal overlays with enhanced visuals.
 * Now extends ConfigDrivenLayer for unified data-driven architecture.
 * Config: /public/game-configs/games/<id>/layers/overlay.layer.json
 */

import { Container, Graphics } from 'pixi.js';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';
import { parsePixiColor } from './config/LayerConfigManager';
import { ConfigDrivenLayer } from './base/ConfigDrivenLayer';
import { TweenFactory } from '../../runtime/animation/TweenFactory';
import type { GenericLayerConfig } from './config/GenericLayerSchema';

export class OverlayLayer extends ConfigDrivenLayer {
  private dimBackground: Graphics;
  private contentContainer: Container;
  private isAnimating: boolean = false;

  constructor() {
    super({
      layerName: 'OverlayLayer',
      stageLayer: StageLayer.OVERLAY,
      configFileName: 'overlay.layer.json',
    });

    this.dimBackground = new Graphics();
    this.addChild(this.dimBackground);

    this.contentContainer = this.factory.createContainer({ label: 'OverlayContent' });
    this.addChild(this.contentContainer);

    this.visible = false;

    // Re-draw dim background on breakpoint change
    this.eventBus.on('viewport:breakpoint:changed', () => {
      this.rebuildDimBackground(this.config);
    });
  }

  protected override onConfigLoaded(cfg: GenericLayerConfig): void {
    this.rebuildDimBackground(cfg);
  }

  private rebuildDimBackground(cfg: GenericLayerConfig): void {
    this.dimBackground.clear();
    const dimCfg = (cfg as any).dimBackground ?? {};
    const color = parsePixiColor(dimCfg.color, 0x000000);
    const alpha = dimCfg.alpha ?? 0.7;

    this.dimBackground.rect(0, 0, vw(), vh());
    this.dimBackground.fill({ color, alpha });
    this.dimBackground.eventMode = 'static';
  }

  public show(content?: Container): void {
    if (this.isAnimating) return;

    if (content) {
      this.contentContainer.addChild(content);
    }
    this.visible = true;
    this.alpha = 0;
    this.isAnimating = true;

    const animCfg = (this.config as any).animation ?? {};
    const duration = (animCfg.showDurationMs ?? 250) / 1000;
    const scaleFrom = animCfg.scaleFrom ?? 0.9;

    if (this.contentContainer.children.length > 0) {
      this.contentContainer.scale.set(scaleFrom);
      TweenFactory.to(this.contentContainer.scale, {
        x: 1,
        y: 1,
        duration: duration,
        ease: 'cubic.out',
      });
    }

    TweenFactory.to(this, {
      alpha: 1,
      duration: duration,
      ease: 'cubic.out',
      onComplete: () => {
        this.isAnimating = false;
      },
    });
  }

  public hide(): void {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const animCfg = (this.config as any).animation ?? {};
    const duration = (animCfg.hideDurationMs ?? 200) / 1000;

    TweenFactory.to(this, {
      alpha: 0,
      duration: duration,
      ease: 'cubic.out',
      onComplete: () => {
        this.visible = false;
        this.contentContainer.removeChildren();
        this.isAnimating = false;
      },
    });
  }

  public getContentContainer(): Container {
    return this.contentContainer;
  }

  public isVisible(): boolean {
    return this.visible;
  }
}
