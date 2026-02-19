/**
 * DebugLayer - Layer for debug information with enhanced visuals
 * Data-driven via /public/game-configs/games/<id>/layers/debug.layer.json
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../../runtime/pixi/core/PixiRuntime';
import { PixiFactory } from '../../runtime/pixi/factory/PixiFactory';
import {
  LayerConfigManager,
  parsePixiColor,
  type DebugLayerConfig,
} from './config/LayerConfigManager';

export class DebugLayer extends LayerContainer {
  private fpsText: Text;
  private memText: Text;
  private stateText: Text;
  private infoContainer: Container;
  private statsBackground: Graphics;
  private gridOverlay: Graphics;
  private factory: PixiFactory;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;

  private cfg: DebugLayerConfig = {};
  private cfgManager = LayerConfigManager.getInstance();

  constructor() {
    super({
      name: 'DebugLayer',
      zIndex: StageLayer.DEBUG,
    });

    this.visible = false;
    this.factory = PixiFactory.getInstance();

    // Placeholders – will be rebuilt once config arrives
    this.statsBackground = new Graphics();
    this.addChild(this.statsBackground);

    this.fpsText = new Text({ text: 'FPS: --', style: this.defaultTextStyle(0x00ff00) });
    this.addChild(this.fpsText);

    this.memText = new Text({ text: 'MEM: --', style: this.defaultTextStyle(0x00ffff) });
    this.addChild(this.memText);

    this.stateText = new Text({ text: 'STATE: IDLE', style: this.defaultTextStyle(0xffff00) });
    this.addChild(this.stateText);

    this.infoContainer = new Container();
    this.infoContainer.x = 10;
    this.infoContainer.y = 150;
    this.addChild(this.infoContainer);

    this.gridOverlay = new Graphics();
    this.gridOverlay.visible = false;
    this.addChild(this.gridOverlay);

    void this.loadConfig();
  }

  private defaultTextStyle(fill: number): TextStyle {
    return new TextStyle({ fontFamily: 'monospace', fontSize: 12, fill });
  }

  private async loadConfig(): Promise<void> {
    try {
      this.cfg = await this.cfgManager.getDebugConfig();
    } catch (e) {
      console.error('[DebugLayer] Failed to load debug layer config:', e);
      this.cfg = {};
    }
    this.rebuild();
  }

  private rebuild(): void {
    const p = this.cfg.panel ?? {};
    const px = p.x ?? 5;
    const py = p.y ?? 65;
    const pw = p.width ?? 150;
    const ph = p.height ?? 75;

    // Stats background
    this.statsBackground.clear();
    this.statsBackground.roundRect(px, py, pw, ph, p.radius ?? 8);
    this.statsBackground.fill({ color: parsePixiColor(p.fill, 0x000000), alpha: p.fillAlpha ?? 0.75 });

    // FPS
    const fpsCfg = this.cfg.fpsText ?? {};
    this.fpsText.style = new TextStyle({
      fontFamily: fpsCfg.fontFamily ?? 'monospace',
      fontSize: fpsCfg.fontSize ?? 12,
      fill: parsePixiColor(fpsCfg.fill, 0x00ff00),
    });
    this.fpsText.x = px + 10;
    this.fpsText.y = py + 10;

    // MEM
    const memCfg = this.cfg.memText ?? {};
    this.memText.style = new TextStyle({
      fontFamily: memCfg.fontFamily ?? 'monospace',
      fontSize: memCfg.fontSize ?? 12,
      fill: parsePixiColor(memCfg.fill, 0x00ffff),
    });
    this.memText.x = px + 10;
    this.memText.y = py + 28;

    // STATE
    const stateCfg = this.cfg.stateText ?? {};
    this.stateText.style = new TextStyle({
      fontFamily: stateCfg.fontFamily ?? 'monospace',
      fontSize: stateCfg.fontSize ?? 12,
      fill: parsePixiColor(stateCfg.fill, 0xffff00),
    });
    this.stateText.x = px + 10;
    this.stateText.y = py + 46;

    // Grid overlay
    this.rebuildGridOverlay();
  }

  private rebuildGridOverlay(): void {
    this.gridOverlay.clear();

    const g = this.cfg.grid ?? {};
    const gridSize = g.size ?? 50;
    const gridColor = parsePixiColor(g.color, 0x00ff00);
    const gridAlpha = g.alpha ?? 0.15;

    for (let x = 0; x <= VIRTUAL_WIDTH; x += gridSize) {
      this.gridOverlay.moveTo(x, 0);
      this.gridOverlay.lineTo(x, VIRTUAL_HEIGHT);
    }
    for (let y = 0; y <= VIRTUAL_HEIGHT; y += gridSize) {
      this.gridOverlay.moveTo(0, y);
      this.gridOverlay.lineTo(VIRTUAL_WIDTH, y);
    }
    this.gridOverlay.stroke({ color: gridColor, alpha: gridAlpha, width: 1 });

    const chColor = parsePixiColor(g.crosshairColor, 0xff0000);
    const chAlpha = g.crosshairAlpha ?? 0.5;
    const chSize = g.crosshairSize ?? 20;

    this.gridOverlay.moveTo(VIRTUAL_WIDTH / 2 - chSize, VIRTUAL_HEIGHT / 2);
    this.gridOverlay.lineTo(VIRTUAL_WIDTH / 2 + chSize, VIRTUAL_HEIGHT / 2);
    this.gridOverlay.moveTo(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - chSize);
    this.gridOverlay.lineTo(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + chSize);
    this.gridOverlay.stroke({ color: chColor, alpha: chAlpha, width: 2 });
  }

  public update(deltaTime?: number): void {
    this.frameCount++;
    const now = performance.now();

    if (now - this.lastFpsUpdate > 1000) {
      const fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
      this.fpsText.text = `FPS: ${fps}`;
      this.frameCount = 0;
      this.lastFpsUpdate = now;

      if ((performance as any).memory) {
        const mb = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
        this.memText.text = `MEM: ${mb}MB`;
      }
    }
  }

  public updateFPS(fps: number): void {
    this.fpsText.text = `FPS: ${Math.round(fps)}`;
  }

  public setState(state: string): void {
    this.stateText.text = `STATE: ${state.toUpperCase()}`;
  }

  public showGridOverlay(
    cols: number,
    rows: number,
    cellWidth: number,
    cellHeight: number,
    offsetX: number,
    offsetY: number
  ): void {
    this.gridOverlay.visible = true;
  }

  public clearGridOverlay(): void {
    this.gridOverlay.visible = false;
  }

  public toggleGrid(): void {
    this.gridOverlay.visible = !this.gridOverlay.visible;
  }

  public toggle(): void {
    this.visible = !this.visible;
  }
}
