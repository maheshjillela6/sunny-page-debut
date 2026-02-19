/**
 * DecorBackLayer - Layer for decorative background elements
 * Data-driven via /public/game-configs/games/<id>/layers/decorBack.layer.json
 */

import { Container, Graphics } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';
import { pixiFactory } from '../../runtime/pixi/factory/PixiFactory';
import { EventBus } from '../../platform/events/EventBus';
import {
  LayerConfigManager,
  parsePixiColor,
  type DecorBackLayerConfig,
} from './config/LayerConfigManager';

export class DecorBackLayer extends LayerContainer {
  private frameContainer: Container;
  private decorElements: Container;

  private cfg: DecorBackLayerConfig = {};
  private cfgManager = LayerConfigManager.getInstance();

  constructor() {
    super({
      name: 'DecorBackLayer',
      zIndex: StageLayer.DECOR_BACK,
    });

    this.frameContainer = pixiFactory.container({ label: 'Frame' });
    this.decorElements = pixiFactory.container({ label: 'Decor' });

    this.addChild(this.frameContainer);
    this.addChild(this.decorElements);

    EventBus.getInstance().on('viewport:breakpoint:changed', () => this.rebuild());

    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      this.cfg = await this.cfgManager.getDecorBackConfig();
    } catch (e) {
      console.error('[DecorBackLayer] Failed to load decorBack layer config:', e);
      this.cfg = {};
    }
    this.rebuild();
  }

  private rebuild(): void {
    this.clearContainer(this.frameContainer);
    this.clearContainer(this.decorElements);
    this.createFrame();
    this.createDecorElements();
  }

  private createFrame(): void {
    const outer = this.cfg.outerFrame ?? {};
    const outerMargin = outer.margin ?? 20;
    const outerFrame = pixiFactory.rect(outerMargin, outerMargin, vw() - outerMargin * 2, vh() - outerMargin * 2, {
      stroke: parsePixiColor(outer.stroke, 0x3b82f6),
      strokeWidth: outer.strokeWidth ?? 2,
      strokeAlpha: outer.strokeAlpha ?? 0.3,
      radius: outer.radius ?? 16,
    });
    this.frameContainer.addChild(outerFrame);

    const inner = this.cfg.innerFrame ?? {};
    const innerMargin = inner.margin ?? 40;
    const innerFrame = pixiFactory.rect(innerMargin, innerMargin, vw() - innerMargin * 2, vh() - innerMargin * 2, {
      stroke: parsePixiColor(inner.stroke, 0x8b5cf6),
      strokeWidth: inner.strokeWidth ?? 1,
      strokeAlpha: inner.strokeAlpha ?? 0.2,
      radius: inner.radius ?? 12,
    });
    this.frameContainer.addChild(innerFrame);

    // Corner accents
    const cornerOffset = outerMargin + 10;
    this.createCornerAccent(cornerOffset, cornerOffset);
    this.createCornerAccent(vw() - cornerOffset, cornerOffset);
    this.createCornerAccent(cornerOffset, vh() - cornerOffset);
    this.createCornerAccent(vw() - cornerOffset, vh() - cornerOffset);
  }

  private createCornerAccent(x: number, y: number): void {
    const ca = this.cfg.cornerAccent ?? {};

    const accent = pixiFactory.circle(x, y, ca.radius ?? 6, {
      fill: parsePixiColor(ca.fill, 0x3b82f6),
      fillAlpha: ca.fillAlpha ?? 0.5,
    });
    this.frameContainer.addChild(accent);

    const ring = pixiFactory.circle(x, y, ca.ringRadius ?? 10, {
      stroke: parsePixiColor(ca.ringStroke, 0x3b82f6),
      strokeWidth: ca.ringStrokeWidth ?? 1,
      strokeAlpha: ca.ringStrokeAlpha ?? 0.3,
    });
    this.frameContainer.addChild(ring);
  }

  private createDecorElements(): void {
    const sl = this.cfg.sideLines ?? {};

    // Left side lines
    const left = sl.left ?? {};
    const lCount = left.count ?? 5;
    const lStartY = left.startY ?? 100;
    const lSpacing = left.spacingY ?? 100;
    const lLength = left.length ?? 60;
    const lColor = parsePixiColor(left.color, 0x3b82f6);

    for (let i = 0; i < lCount; i++) {
      const ly = lStartY + i * lSpacing;
      const line = pixiFactory.line(0, ly, lLength, ly, {
        color: lColor,
        width: left.width ?? 1,
        alpha: (left.alphaStart ?? 0.2) - i * (left.alphaStep ?? 0.03),
      });
      this.decorElements.addChild(line);
    }

    // Right side lines
    const right = sl.right ?? {};
    const rCount = right.count ?? 5;
    const rStartY = right.startY ?? 100;
    const rSpacing = right.spacingY ?? 100;
    const rLength = right.length ?? 60;
    const rColor = parsePixiColor(right.color, 0x8b5cf6);

    for (let i = 0; i < rCount; i++) {
      const ry = rStartY + i * rSpacing;
      const line = pixiFactory.line(vw() - rLength, ry, vw(), ry, {
        color: rColor,
        width: right.width ?? 1,
        alpha: (right.alphaStart ?? 0.2) - i * (right.alphaStep ?? 0.03),
      });
      this.decorElements.addChild(line);
    }

    // Diamonds
    const dm = this.cfg.diamonds ?? {};
    const leftD = dm.left ?? {};
    const rightD = dm.right ?? {};

    this.createDiamond(
      leftD.x ?? 80,
      vh() / 2,
      leftD.size ?? 8,
      parsePixiColor(leftD.fill, 0x3b82f6),
      leftD.fillAlpha ?? 0.4,
      parsePixiColor(leftD.stroke, 0x3b82f6),
      leftD.strokeWidth ?? 1,
    );

    this.createDiamond(
      vw() + (rightD.x ?? -80),
      vh() / 2,
      rightD.size ?? 8,
      parsePixiColor(rightD.fill, 0x8b5cf6),
      rightD.fillAlpha ?? 0.4,
      parsePixiColor(rightD.stroke, 0x8b5cf6),
      rightD.strokeWidth ?? 1,
    );
  }

  private createDiamond(x: number, y: number, size: number, fill: number, fillAlpha: number, stroke: number, strokeWidth: number): void {
    const diamond = pixiFactory.polygon([
      { x: x, y: y - size },
      { x: x + size, y: y },
      { x: x, y: y + size },
      { x: x - size, y: y },
    ], {
      fill,
      fillAlpha,
      stroke,
      strokeWidth,
    });
    this.decorElements.addChild(diamond);
  }

  private clearContainer(container: Container): void {
    while (container.children[0]) {
      const child = container.children[0];
      container.removeChild(child);
      child.destroy({ children: true });
    }
  }
}
