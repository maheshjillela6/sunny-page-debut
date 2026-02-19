/**
 * ConfigurableSymbolView - Pluggable, config-driven symbol visual representation.
 *
 * Replaces hardcoded rendering logic with composition-based rendering.
 * When a SymbolCompositionConfig exists for a symbol, all visuals and
 * state-based animations are driven purely by configuration.
 * Falls back to the legacy SymbolView behavior when no config is present.
 */

import { Container, Graphics } from 'pixi.js';
import { Poolable } from '../../../runtime/pixi/pooling/ObjectPool';
import { SymbolCompositionRenderer } from './renderers/SymbolCompositionRenderer';
import { SymbolRendererFactory } from './renderers/SymbolRendererFactory';
import { DefaultAssets } from '../../../runtime/pixi/assets/DefaultAssets';
import type { SymbolLifecycleState } from './config/SymbolCompositionTypes';

/**
 * Backward-compatible type alias so existing code that imports SymbolState
 * from the old SymbolView can continue to work.
 */
export type ConfigurableSymbolState = SymbolLifecycleState;

export class ConfigurableSymbolView extends Container implements Poolable {
  private symbolId: string = '';
  private size: number;
  private compositionRenderer: SymbolCompositionRenderer | null = null;
  private rendererFactory: SymbolRendererFactory;
  private currentState: SymbolLifecycleState = 'idle';

  constructor(size: number = 120) {
    super();
    this.label = 'ConfigurableSymbolView';
    this.size = size;
    this.rendererFactory = SymbolRendererFactory.getInstance();
  }

  // ── Symbol setup ──────────────────────────────────────────────────────

  public setSymbolId(id: string): void {
    if (this.symbolId === id) return;
    this.symbolId = id;
    this.clearComposition();

    const renderer = this.rendererFactory.createRenderer(id, this.size);
    if (renderer) {
      this.compositionRenderer = renderer;
      this.addChild(renderer.container);
    } else {
      // No composition config — create a visible fallback graphic
      this.createFallbackGraphic(id);
    }

    // Force state re-apply since composition was just recreated
    this.currentState = '' as SymbolLifecycleState;
    this.setState('idle', true);
  }

  private createFallbackGraphic(id: string): void {
    // Use the rich DefaultAssets fallback (colored bg + gradient highlight + text label)
    const defaultAssets = DefaultAssets.getInstance();
    const fallback = defaultAssets.createSymbol(id, this.size);
    // DefaultAssets draws from (0,0) top-left; offset so it's centered at anchor (0.5, 0.5)
    fallback.x = -this.size / 2;
    fallback.y = -this.size / 2;
    this.addChild(fallback);
  }

  public getSymbolId(): string {
    return this.symbolId;
  }

  // ── State management ──────────────────────────────────────────────────

  public setState(state: SymbolLifecycleState, force: boolean = false): void {
    if (this.currentState === state && !force) return;
    this.currentState = state;
    this.compositionRenderer?.setState(state);
  }

  public getState(): SymbolLifecycleState {
    return this.currentState;
  }

  // ── Random symbol (backward compat with SymbolView) ────────────────────

  public setRandomSymbol(): void {
    const symbols = ['A', 'B', 'C', 'D', 'E', 'F'];
    const randomId = symbols[Math.floor(Math.random() * symbols.length)];
    this.setSymbolId(randomId);
  }

  // ── Win / Land convenience methods ────────────────────────────────────

  public playWin(tier: 'low' | 'high' = 'low', onComplete?: () => void): void {
    this.setState(tier === 'high' ? 'big_win' : 'win');
    // Completion callback via tween or spine is handled internally
    if (onComplete) {
      // Fallback timeout for when animation system doesn't fire completion
      setTimeout(onComplete, 800);
    }
  }

  public playLand(onComplete?: () => void): void {
    this.setState('landing');
    if (onComplete) setTimeout(onComplete, 300);
  }

  // ── Highlight ─────────────────────────────────────────────────────────

  public highlight(color?: number): void {
    this.compositionRenderer?.highlight(color);
  }

  public unhighlight(): void {
    this.compositionRenderer?.unhighlight();
  }

  // ── Pulse (backward compat) ───────────────────────────────────────────

  public pulse(): void {
    this.scale.set(1.05);
  }

  public unpulse(): void {
    this.scale.set(1);
  }

  // ── Layer access ──────────────────────────────────────────────────────

  public getCompositionRenderer(): SymbolCompositionRenderer | null {
    return this.compositionRenderer;
  }

  public hasComposition(): boolean {
    return this.compositionRenderer !== null;
  }

  // ── Pooling ───────────────────────────────────────────────────────────

  public reset(): void {
    this.clearComposition();
    this.symbolId = '';
    this.currentState = 'idle';
    this.scale.set(1);
    this.alpha = 1;
    this.x = 0;
    this.y = 0;
    this.rotation = 0;
    this.visible = true;
    if (this.parent) this.parent.removeChild(this);
  }

  private clearComposition(): void {
    if (this.compositionRenderer) {
      this.removeChild(this.compositionRenderer.container);
      this.compositionRenderer.destroy();
      this.compositionRenderer = null;
    }
  }

  public override destroy(): void {
    this.clearComposition();
    super.destroy({ children: true });
  }
}
