/**
 * SymbolCompositionRenderer - Assembles and manages all visual layers of a symbol.
 *
 * This is the core class that replaces hardcoded rendering logic.
 * Everything is driven by SymbolCompositionConfig.
 */

import { Container, Graphics } from 'pixi.js';
import type {
  SymbolCompositionConfig,
  SymbolLifecycleState,
} from '../config/SymbolCompositionTypes';
import { DEFAULT_HIGHLIGHT } from '../config/SymbolCompositionTypes';
import { SymbolLayerRenderer } from './SymbolLayerRenderer';
import { TweenFactory } from '../../../../runtime/animation/TweenFactory';
import type { TweenHandle, TweenOptions } from '../../../../runtime/animation/TweenTypes';

export class SymbolCompositionRenderer {
  public readonly container: Container;

  private config: SymbolCompositionConfig;
  private layers: SymbolLayerRenderer[] = [];
  private currentState: SymbolLifecycleState = 'idle';
  private symbolSize: number;

  // Highlight
  private highlightGraphics: Graphics;
  private highlightTween: TweenHandle | null = null;
  private isHighlighted: boolean = false;

  constructor(config: SymbolCompositionConfig, symbolSize: number) {
    this.config = config;
    this.symbolSize = config.width ?? symbolSize;

    this.container = new Container();
    this.container.label = `SymbolComposition_${config.symbolId}`;
    this.container.sortableChildren = true;

    // Create layers sorted by zIndex
    const sortedLayerConfigs = [...config.layers].sort((a, b) => a.zIndex - b.zIndex);
    for (const layerConfig of sortedLayerConfigs) {
      const renderer = new SymbolLayerRenderer(layerConfig, this.symbolSize);
      this.layers.push(renderer);
      this.container.addChild(renderer.container);
    }

    // Highlight overlay (always on top)
    this.highlightGraphics = new Graphics();
    this.highlightGraphics.zIndex = 9999;
    this.highlightGraphics.visible = false;
    this.container.addChild(this.highlightGraphics);
  }

  // ── State management ──────────────────────────────────────────────────

  public setState(state: SymbolLifecycleState): void {
    const force = this.currentState === state;
    this.currentState = state;

    for (const layer of this.layers) {
      layer.applyState(state, force);
    }

    // For win / big_win states, auto-show a glow highlight around the symbol
    if (state === 'win' || state === 'big_win') {
      this.showWinGlow(state === 'big_win');
    } else {
      this.hideWinGlow();
    }
  }

  /**
   * Show a pulsing glow border around the whole symbol during win states.
   * This is independent of payline highlighting.
   */
  private winGlowGraphics: Graphics | null = null;
  private winGlowTween: TweenHandle | null = null;

  private showWinGlow(isBigWin: boolean): void {
    if (!this.winGlowGraphics) {
      this.winGlowGraphics = new Graphics();
      this.winGlowGraphics.zIndex = 9998;
      this.container.addChild(this.winGlowGraphics);
    }

    const half = this.symbolSize / 2;
    const pad = 4;
    const color = isBigWin ? 0xffa500 : 0x9a3cff;
    const glowAlpha = isBigWin ? 0.5 : 0.35;

    this.winGlowGraphics.clear();
    // Outer glow ring
    this.winGlowGraphics.roundRect(
      -half - pad, -half - pad,
      this.symbolSize + pad * 2, this.symbolSize + pad * 2,
      12,
    );
    this.winGlowGraphics.fill({ color, alpha: glowAlpha * 0.3 });
    this.winGlowGraphics.stroke({ color, width: 3, alpha: glowAlpha });
    this.winGlowGraphics.visible = true;
    this.winGlowGraphics.alpha = 1;

    // Animate glow with alpha pulsing only — no scale change so border stays fixed
    this.winGlowTween?.kill();
    this.winGlowTween = TweenFactory.play(this.winGlowGraphics, {
      type: 'fadeIn',
      duration: 0.6,
      loop: true,
      yoyo: true,
    });
  }

  private hideWinGlow(): void {
    this.winGlowTween?.kill();
    this.winGlowTween = null;
    if (this.winGlowGraphics) {
      this.winGlowGraphics.clear();
      this.winGlowGraphics.visible = false;
      this.winGlowGraphics.scale.set(1);
    }
  }

  public getState(): SymbolLifecycleState {
    return this.currentState;
  }

  // ── Highlight ─────────────────────────────────────────────────────────

  public highlight(color?: number): void {
    if (this.isHighlighted) return;
    this.isHighlighted = true;

    const hl = { ...DEFAULT_HIGHLIGHT, ...this.config.highlight };
    const c = color ?? hl.color;

    const half = this.symbolSize / 2;
    this.highlightGraphics.clear();
    this.highlightGraphics.roundRect(
      -half - hl.padding, -half - hl.padding,
      this.symbolSize + hl.padding * 2,
      this.symbolSize + hl.padding * 2,
      hl.cornerRadius,
    );
    this.highlightGraphics.fill({ color: c, alpha: hl.alpha });
    this.highlightGraphics.stroke({ color: c, width: 3 });
    this.highlightGraphics.visible = true;

    // Optional tween on highlight
    if (hl.tween) {
      this.highlightTween = TweenFactory.play(this.highlightGraphics, hl.tween as TweenOptions);
    }
  }

  public unhighlight(): void {
    if (!this.isHighlighted) return;
    this.isHighlighted = false;

    this.highlightTween?.kill();
    this.highlightTween = null;
    this.highlightGraphics.clear();
    this.highlightGraphics.visible = false;
  }

  // ── Accessors ─────────────────────────────────────────────────────────

  public getConfig(): SymbolCompositionConfig {
    return this.config;
  }

  public getLayer(id: string): SymbolLayerRenderer | undefined {
    return this.layers.find((l) => l.config.id === id);
  }

  public getLayers(): readonly SymbolLayerRenderer[] {
    return this.layers;
  }

  // ── Reset / Destroy ───────────────────────────────────────────────────

  public reset(): void {
    this.unhighlight();
    this.hideWinGlow();
    for (const layer of this.layers) {
      layer.reset();
    }
    this.currentState = 'idle';
  }

  public destroy(): void {
    this.unhighlight();
    this.hideWinGlow();
    if (this.winGlowGraphics) {
      this.winGlowGraphics.destroy();
      this.winGlowGraphics = null;
    }
    for (const layer of this.layers) {
      layer.destroy();
    }
    this.layers = [];
    this.highlightGraphics.destroy();
    this.container.destroy({ children: true });
  }
}
