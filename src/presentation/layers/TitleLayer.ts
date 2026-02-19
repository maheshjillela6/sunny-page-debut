/**
 * TitleLayer - Layer for game title and logo with enhanced visuals
 * Data-driven via /public/game-configs/games/<id>/layers/title.layer.json
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { vw } from '../../runtime/pixi/core/VirtualDims';
import { PixiFactory } from '../../runtime/pixi/factory/PixiFactory';
import { EventBus } from '../../platform/events/EventBus';
import {
  LayerConfigManager,
  parsePixiColor,
  type TitleLayerConfig,
} from './config/LayerConfigManager';

export class TitleLayer extends LayerContainer {
  private titleText: Text | null = null;
  private titleBg: Graphics | null = null;
  private logoContainer: Container;
  private factory: PixiFactory;

  private cfg: TitleLayerConfig = {};
  private cfgManager = LayerConfigManager.getInstance();

  constructor() {
    super({
      name: 'TitleLayer',
      zIndex: StageLayer.TITLE,
    });

    this.factory = PixiFactory.getInstance();
    this.logoContainer = this.factory.createContainer({ label: 'Logo' });
    this.addChild(this.logoContainer);

    // Rebuild on breakpoint change
    EventBus.getInstance().on('viewport:breakpoint:changed', () => this.rebuild());

    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      this.cfg = await this.cfgManager.getTitleConfig();
    } catch (e) {
      console.error('[TitleLayer] Failed to load title layer config:', e);
      this.cfg = {};
    }
    this.rebuild();
  }

  private rebuild(): void {
    // Clear existing
    while (this.logoContainer.children[0]) {
      const child = this.logoContainer.children[0];
      this.logoContainer.removeChild(child);
      child.destroy({ children: true });
    }
    if (this.titleBg) {
      this.removeChild(this.titleBg);
      this.titleBg.destroy();
      this.titleBg = null;
    }
    if (this.titleText) {
      this.removeChild(this.titleText);
      this.titleText.destroy();
      this.titleText = null;
    }

    this.createLogo();
    this.createTitle();
  }

  private createLogo(): void {
    const l = this.cfg.logo ?? {};
    this.logoContainer.x = l.x ?? 70;
    this.logoContainer.y = l.y ?? 40;

    const bgFill = parsePixiColor(l.bgFill, 0x3b82f6);
    const bgRadius = l.bgRadius ?? 25;

    const logoBg = this.factory.createCircle(0, 0, bgRadius, {
      fill: bgFill,
      fillAlpha: l.bgFillAlpha ?? 0.2,
    });
    this.logoContainer.addChild(logoBg);

    const logoRing = this.factory.createCircle(0, 0, l.ringRadius ?? 25, {
      stroke: parsePixiColor(l.ringStroke, 0x3b82f6),
      strokeWidth: l.ringStrokeWidth ?? 2,
    });
    this.logoContainer.addChild(logoRing);

    const hexRadius = l.hexRadius ?? 15;
    const hexPoints: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 90) * Math.PI / 180;
      hexPoints.push({
        x: Math.cos(angle) * hexRadius,
        y: Math.sin(angle) * hexRadius,
      });
    }

    const hexagon = this.factory.createPolygon(hexPoints, {
      fill: parsePixiColor(l.hexFill, 0x3b82f6),
      fillAlpha: l.hexFillAlpha ?? 0.8,
    });
    this.logoContainer.addChild(hexagon);
  }

  private createTitle(): void {
    const tb = this.cfg.titleBar ?? {};
    const tbWidth = tb.width ?? 400;
    const tbHeight = tb.height ?? 50;
    const tbY = tb.y ?? 15;

    this.titleBg = this.factory.createRect(vw() / 2 - tbWidth / 2, tbY, tbWidth, tbHeight, {
      fill: parsePixiColor(tb.fill, 0x1a1f2e),
      fillAlpha: tb.fillAlpha ?? 0.8,
      stroke: parsePixiColor(tb.stroke, 0x3b82f6),
      strokeWidth: tb.strokeWidth ?? 2,
      strokeAlpha: tb.strokeAlpha ?? 0.5,
      radius: tb.radius ?? 25,
    });
    this.addChild(this.titleBg);

    const tt = this.cfg.titleText ?? {};
    const style = new TextStyle({
      fontFamily: tt.fontFamily ?? 'Arial',
      fontSize: tt.fontSize ?? 28,
      fontWeight: (tt.fontWeight as any) ?? 'bold',
      fill: parsePixiColor(tt.fill, 0xffffff),
      letterSpacing: tt.letterSpacing ?? 4,
    });

    this.titleText = new Text({ text: tt.defaultText ?? 'SLOT ENGINE', style });
    this.titleText.anchor.set(0.5, 0.5);
    this.titleText.x = vw() / 2;
    this.titleText.y = tbY + tbHeight / 2;
    this.addChild(this.titleText);
  }

  public setTitle(title: string): void {
    if (this.titleText) {
      this.titleText.text = title;
    }
  }
}
