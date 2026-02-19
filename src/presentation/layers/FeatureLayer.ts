/**
 * FeatureLayer - Layer for feature presentations.
 * Data-driven styling via /public/game-configs/games/<id>/layers/feature.layer.json
 */

import { Container, Text, TextStyle } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { vw } from '../../runtime/pixi/core/VirtualDims';
import { PixiFactory } from '../../runtime/pixi/factory/PixiFactory';
import {
  LayerConfigManager,
  parsePixiColor,
  type FeatureLayerConfig,
} from './config/LayerConfigManager';

export class FeatureLayer extends LayerContainer {
  private featureContainer: Container;
  private bannerContainer: Container;
  private counterContainer: Container;
  private factory: PixiFactory;

  private cfg: FeatureLayerConfig = {};
  private cfgManager = LayerConfigManager.getInstance();

  constructor() {
    super({
      name: 'FeatureLayer',
      zIndex: StageLayer.FEATURE,
    });

    this.factory = PixiFactory.getInstance();

    this.featureContainer = this.factory.createContainer({ label: 'FeatureContainer' });
    this.addChild(this.featureContainer);

    this.bannerContainer = this.factory.createContainer({ label: 'BannerContainer' });
    this.addChild(this.bannerContainer);

    this.counterContainer = this.factory.createContainer({ label: 'CounterContainer' });
    this.addChild(this.counterContainer);

    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      this.cfg = await this.cfgManager.getFeatureConfig();
    } catch (e) {
      console.error('[FeatureLayer] Failed to load feature layer config:', e);
      this.cfg = {};
    }
  }

  public getFeatureContainer(): Container {
    return this.featureContainer;
  }

  public showFeature(content: Container): void {
    this.featureContainer.addChild(content);
    this.visible = true;
  }

  public hideFeature(): void {
    this.featureContainer.removeChildren();
    this.visible = false;
  }

  public showBanner(text: string, color: number = 0x8b5cf6): void {
    this.bannerContainer.removeChildren();

    const b = this.cfg.banner ?? {};

    const bannerWidth = b.width ?? 400;
    const bannerHeight = b.height ?? 80;
    const bannerY = b.y ?? 80;

    const panel = b.panel ?? {};
    const border = b.border ?? {};
    const textCfg = b.text ?? {};

    const panelFill = parsePixiColor(panel.fill, 0x1a1f2e);
    const borderStroke = parsePixiColor(border.stroke, color);
    const textFill = parsePixiColor(textCfg.fill, borderStroke);

    const bg = this.factory.createRect(vw() / 2 - bannerWidth / 2, bannerY, bannerWidth, bannerHeight, {
      fill: panelFill,
      fillAlpha: panel.fillAlpha ?? 0.95,
      radius: panel.radius ?? 16,
    });
    this.bannerContainer.addChild(bg);

    const borderRect = this.factory.createRect(vw() / 2 - bannerWidth / 2, bannerY, bannerWidth, bannerHeight, {
      stroke: borderStroke,
      strokeWidth: border.strokeWidth ?? 3,
      radius: border.radius ?? 16,
    });
    this.bannerContainer.addChild(borderRect);

    const style = new TextStyle({
      fontFamily: textCfg.fontFamily ?? 'Arial',
      fontSize: textCfg.fontSize ?? 36,
      fontWeight: (textCfg.fontWeight as any) ?? 'bold',
      fill: textFill,
      letterSpacing: textCfg.letterSpacing ?? 2,
    });

    const bannerText = new Text({ text: text.toUpperCase(), style });
    bannerText.anchor.set(0.5);
    bannerText.x = vw() / 2;
    bannerText.y = bannerY + bannerHeight / 2;
    this.bannerContainer.addChild(bannerText);
  }

  public showCounter(current: number, total: number, label: string = 'FREE SPINS'): void {
    this.counterContainer.removeChildren();

    const c = this.cfg.counter ?? {};
    const counterX = c.x ?? (vw() - 120);
    const counterY = c.y ?? 100;

    const panel = c.panel ?? {};
    const border = c.border ?? {};

    const panelFill = parsePixiColor(panel.fill, 0x1a1f2e);
    const borderStroke = parsePixiColor(border.stroke, 0x8b5cf6);

    const bg = this.factory.createRect(counterX - 50, counterY - 35, 100, 70, {
      fill: panelFill,
      fillAlpha: panel.fillAlpha ?? 0.9,
      radius: panel.radius ?? 12,
    });
    this.counterContainer.addChild(bg);

    const borderRect = this.factory.createRect(counterX - 50, counterY - 35, 100, 70, {
      stroke: borderStroke,
      strokeWidth: border.strokeWidth ?? 2,
      radius: border.radius ?? 12,
    });
    this.counterContainer.addChild(borderRect);

    const labelCfg = c.labelText ?? {};
    const labelStyle = new TextStyle({
      fontFamily: labelCfg.fontFamily ?? 'Arial',
      fontSize: labelCfg.fontSize ?? 10,
      fill: parsePixiColor(labelCfg.fill, borderStroke),
    });

    const labelText = new Text({ text: label, style: labelStyle });
    labelText.anchor.set(0.5);
    labelText.x = counterX;
    labelText.y = counterY - 18;
    this.counterContainer.addChild(labelText);

    const valueCfg = c.valueText ?? {};
    const counterStyle = new TextStyle({
      fontFamily: valueCfg.fontFamily ?? 'Arial',
      fontSize: valueCfg.fontSize ?? 24,
      fontWeight: (valueCfg.fontWeight as any) ?? 'bold',
      fill: parsePixiColor(valueCfg.fill, 0xffffff),
    });

    const counterText = new Text({ text: `${current}/${total}`, style: counterStyle });
    counterText.anchor.set(0.5);
    counterText.x = counterX;
    counterText.y = counterY + 8;
    this.counterContainer.addChild(counterText);
  }

  public hideBanner(): void {
    this.bannerContainer.removeChildren();
  }

  public hideCounter(): void {
    this.counterContainer.removeChildren();
  }

  public clear(): void {
    this.hideFeature();
    this.hideBanner();
    this.hideCounter();
  }
}
