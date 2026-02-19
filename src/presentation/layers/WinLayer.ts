/**
 * WinLayer - Layer for win presentations and highlights.
 * Data-driven styling via /public/game-configs/games/<id>/layers/win.layer.json
 * Win animation driven via /public/game-configs/games/<id>/layers/presentation.layer.json
 */

import { Container, Text, TextStyle } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { vw, vh } from '../../runtime/pixi/core/VirtualDims';
import { PixiFactory } from '../../runtime/pixi/factory/PixiFactory';
import {
  LayerConfigManager,
  parsePixiColor,
  type WinLayerConfig,
  type PresentationLayerConfig,
} from './config/LayerConfigManager';
import { playWinAnimation, type WinAnimationConfig } from './win/WinAnimations';

export interface WinHighlight {
  positions: { row: number; col: number }[];
  color: number;
}

export class WinLayer extends LayerContainer {
  private highlightContainer: Container;
  private winTextContainer: Container;
  private particleContainer: Container;
  private highlights: any[] = [];
  private factory: PixiFactory;

  private cfg: WinLayerConfig = {};
  private presentationCfg: PresentationLayerConfig = {};
  private cfgManager = LayerConfigManager.getInstance();

  constructor() {
    super({
      name: 'WinLayer',
      zIndex: StageLayer.WIN,
    });

    this.factory = PixiFactory.getInstance();

    this.highlightContainer = this.factory.createContainer({ label: 'HighlightContainer' });
    this.addChild(this.highlightContainer);

    this.particleContainer = this.factory.createContainer({ label: 'ParticleContainer' });
    this.addChild(this.particleContainer);

    this.winTextContainer = this.factory.createContainer({ label: 'WinTextContainer' });
    this.addChild(this.winTextContainer);

    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      [this.cfg, this.presentationCfg] = await Promise.all([
        this.cfgManager.getWinConfig(),
        this.cfgManager.getPresentationConfig(),
      ]);
    } catch (e) {
      console.error('[WinLayer] Failed to load configs:', e);
      this.cfg = {};
      this.presentationCfg = {};
    }
  }

  // ── Win animation ──────────────────────────────────────────────────────────

  private getActiveWinAnimation(): WinAnimationConfig | null {
    const block = this.presentationCfg.winAnimation;
    if (!block?.animations?.length) return null;
    return block.animations.find((a) => a.enabled) ?? null;
  }

  private spawnWinAnimation(cx: number, cy: number): void {
    const animCfg = this.getActiveWinAnimation();
    if (!animCfg) return;
    playWinAnimation(this.particleContainer, cx, cy, animCfg, vh());
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public showHighlights(
    highlights: WinHighlight[],
    cellWidth: number,
    cellHeight: number,
    gridOffsetX: number,
    gridOffsetY: number
  ): void {
    this.clearHighlights();

    const h = this.cfg.highlight ?? {};
    const padGlow = h.cellPaddingGlow ?? 5;
    const padBorder = h.cellPaddingBorder ?? 2;
    const glowAlpha = h.glowAlpha ?? 0.3;
    const borderWidth = h.borderWidth ?? 3;
    const radiusGlow = h.radiusGlow ?? 14;
    const radiusBorder = h.radiusBorder ?? 12;

    for (const highlight of highlights) {
      for (const pos of highlight.positions) {
        const x = gridOffsetX + pos.col * (cellWidth + 8);
        const y = gridOffsetY + pos.row * (cellHeight + 8);

        const glow = this.factory.createRect(x - padGlow, y - padGlow, cellWidth + padGlow * 2, cellHeight + padGlow * 2, {
          fill: highlight.color,
          fillAlpha: glowAlpha,
          radius: radiusGlow,
        });
        this.highlightContainer.addChild(glow);
        this.highlights.push(glow);

        const border = this.factory.createRect(x - padBorder, y - padBorder, cellWidth + padBorder * 2, cellHeight + padBorder * 2, {
          stroke: highlight.color,
          strokeWidth: borderWidth,
          radius: radiusBorder,
        });
        this.highlightContainer.addChild(border);
        this.highlights.push(border);
      }
    }
  }

  public showWinAmount(amount: number, x?: number, y?: number): void {
    this.clearWinText();
    this.clearParticles();

    const posX = x ?? vw() / 2;
    const posY = y ?? vh() / 2;

    this.spawnWinAnimation(posX, posY);

    const textCfg = this.cfg.winText?.amountText ?? {};
    const style = new TextStyle({
      fontFamily: textCfg.fontFamily ?? 'Arial',
      fontSize: textCfg.fontSize ?? 42,
      fontWeight: (textCfg.fontWeight as any) ?? '900',
      fill: parsePixiColor(textCfg.fill, 0xffffff),
      stroke: { color: 0x000000, width: 6 } as any,
      dropShadow: {
        color: 0x000000,
        alpha: 0.55,
        blur: 6,
        distance: 0,
        angle: 0,
      },
    });

    const text = new Text({ text: `$${amount.toFixed(2)}`, style });
    text.anchor.set(0.5);
    text.x = posX;
    text.y = posY;
    this.winTextContainer.addChild(text);
  }

  public showLineWin(amount: number, lineNumber: number, totalLines: number, posX?: number, posY?: number): void {
    this.clearWinText();
    this.clearParticles();

    const cx = posX ?? vw() / 2;
    const cy = posY ?? vh() / 2;

    this.spawnWinAnimation(cx, cy);

    const labelCfg = this.cfg.winText?.lineLabelText ?? {};
    const labelStyle = new TextStyle({
      fontFamily: labelCfg.fontFamily ?? 'Arial',
      fontSize: labelCfg.fontSize ?? 14,
      fill: parsePixiColor(labelCfg.fill, 0xffffff),
      dropShadow: {
        color: 0x000000,
        alpha: 0.5,
        blur: 4,
        distance: 0,
        angle: 0,
      },
    });

    const label = new Text({ text: `LINE ${lineNumber} of ${totalLines}`, style: labelStyle });
    label.anchor.set(0.5);
    label.x = cx;
    label.y = cy - 22;
    this.winTextContainer.addChild(label);

    const amountCfg = this.cfg.winText?.lineAmountText ?? {};
    const amountStyle = new TextStyle({
      fontFamily: amountCfg.fontFamily ?? 'Arial',
      fontSize: amountCfg.fontSize ?? 34,
      fontWeight: (amountCfg.fontWeight as any) ?? '900',
      fill: parsePixiColor(amountCfg.fill, 0xffffff),
      stroke: { color: 0x000000, width: 6 } as any,
      dropShadow: {
        color: 0x000000,
        alpha: 0.55,
        blur: 6,
        distance: 0,
        angle: 0,
      },
    });

    const text = new Text({ text: `$${amount.toFixed(2)}`, style: amountStyle });
    text.anchor.set(0.5);
    text.x = cx;
    text.y = cy + 10;
    this.winTextContainer.addChild(text);
  }

  public clearHighlights(): void {
    for (const highlight of this.highlights) {
      this.highlightContainer.removeChild(highlight);
      highlight.destroy();
    }
    this.highlights = [];
  }

  public clearWinText(): void {
    this.winTextContainer.removeChildren();
  }

  public clearParticles(): void {
    this.particleContainer.removeChildren();
  }

  public pulseHighlights(): void {
    // Animation handled externally via ticker
  }

  public clear(): void {
    this.clearHighlights();
    this.clearWinText();
    this.clearParticles();
  }
}
