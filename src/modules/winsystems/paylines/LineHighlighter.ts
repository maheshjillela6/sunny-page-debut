/**
 * LineHighlighter - Highlights winning paylines
 *
 * Position resolution uses deterministic layout math based on cell
 * dimensions and spacing, which is coordinate-system aligned with the
 * highlight overlay container placed at the grid origin.
 */

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { WinData } from '../../../platform/events/EventMap';

export interface LineHighlightConfig {
  lineColors: number[];
  lineWidth: number;
  glowStrength: number;
  animationDuration: number;
}

export class LineHighlighter {
  private container: Container;
  private lines: Graphics[] = [];
  private config: LineHighlightConfig;
  private cellWidth: number;
  private cellHeight: number;
  private spacing: number;
  private tweens: gsap.core.Tween[] = [];

  constructor(container: Container, cellWidth: number, cellHeight: number, spacing: number) {
    this.container = container;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.spacing = spacing;

    this.config = {
      lineColors: [
        0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff,
        0xff6b6b, 0x48dbfb, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x01a3a4,
        0xf368e0, 0xff9f43, 0xee5a24, 0x0abde3, 0x10ac84, 0xe55039,
        0x3dc1d3, 0xfc427b,
      ],
      lineWidth: 4,
      glowStrength: 1,
      animationDuration: 500,
    };
  }

  /** Deterministic position from layout math — aligned with highlight overlay */
  private resolvePosition(row: number, col: number): { x: number; y: number } {
    return {
      x: col * (this.cellWidth + this.spacing) + this.cellWidth / 2,
      y: row * (this.cellHeight + this.spacing) + this.cellHeight / 2,
    };
  }

  public highlight(wins: WinData[], debugStepIndex?: number): void {
    this.clear();

    for (const win of wins) {
      const lineGraphics = this.createLineGraphics(win, debugStepIndex);
      lineGraphics.alpha = 0;
      this.container.addChild(lineGraphics);
      this.lines.push(lineGraphics);

      // Smooth fade-in
      this.tweens.push(
        gsap.to(lineGraphics, { alpha: 1, duration: 0.25, ease: 'power2.out' })
      );
    }
  }

  private createLineGraphics(win: WinData, debugStepIndex?: number): Graphics {
    const graphics = new Graphics();
    const color = this.config.lineColors[Math.abs(win.lineId) % this.config.lineColors.length];

    // Additive blending helps the glow feel like light (bloom-ish) without filters
    (graphics as any).blendMode = 'add';

    // Sort positions by column (left to right) for a proper payline path
    const sorted = [...win.positions].sort((a, b) => a.col - b.col);
    if (sorted.length < 2) return graphics;

    const pts = sorted.map(pos => this.resolvePosition(pos.row, pos.col));

    const drawSmoothPath = (g: Graphics): void => {
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i];
        const n = pts[i + 1];
        const mx = (p.x + n.x) / 2;
        const my = (p.y + n.y) / 2;
        g.quadraticCurveTo(p.x, p.y, mx, my);
      }
      g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    };

    // --- Multi-pass glow for visibility ---
    // Far glow
    drawSmoothPath(graphics);
    graphics.stroke({
      color,
      width: this.config.lineWidth * 5,
      alpha: 0.15,
      cap: 'round',
      join: 'round',
    } as any);

    // Mid glow
    drawSmoothPath(graphics);
    graphics.stroke({
      color,
      width: this.config.lineWidth * 3,
      alpha: 0.30,
      cap: 'round',
      join: 'round',
    } as any);

    // Inner glow
    drawSmoothPath(graphics);
    graphics.stroke({
      color,
      width: this.config.lineWidth * 1.8,
      alpha: 0.50,
      cap: 'round',
      join: 'round',
    } as any);

    // Crisp core line
    drawSmoothPath(graphics);
    graphics.stroke({
      color: 0xffffff,
      width: this.config.lineWidth * 0.5,
      alpha: 0.9,
      cap: 'round',
      join: 'round',
    } as any);

    // Bright solid core
    drawSmoothPath(graphics);
    graphics.stroke({
      color,
      width: this.config.lineWidth,
      alpha: 1.0,
      cap: 'round',
      join: 'round',
    } as any);

    // Connection nodes
    for (const p of pts) {
      // outer bloom
      graphics.circle(p.x, p.y, 16);
      graphics.fill({ color, alpha: 0.12 });

      // mid bloom
      graphics.circle(p.x, p.y, 10);
      graphics.fill({ color, alpha: 0.25 });

      // bright core
      graphics.circle(p.x, p.y, 5);
      graphics.fill({ color, alpha: 0.9 });

      // white center dot
      graphics.circle(p.x, p.y, 2.5);
      graphics.fill({ color: 0xffffff, alpha: 0.8 });
    }

    return graphics;
  }

  public animateLine(lineIndex: number): void {
    const line = this.lines[lineIndex];
    if (!line) return;

    // Smooth looping pulse — keep alpha high for visibility
    this.tweens.push(
      gsap.to(line, {
        alpha: 0.7,
        duration: 0.75,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      })
    );
  }

  public clear(): void {
    for (const t of this.tweens) t.kill();
    this.tweens = [];

    for (const line of this.lines) {
      this.container.removeChild(line);
      line.destroy();
    }
    this.lines = [];
  }

  public setConfig(config: Partial<LineHighlightConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
