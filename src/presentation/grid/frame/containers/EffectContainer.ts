/**
 * EffectContainer - Renders visual effects (glow, shadow, particles) around the grid.
 * All visuals driven by EffectVariant config.
 */

import { Graphics } from 'pixi.js';
import { FrameSubContainer } from './FrameSubContainer';
import type { EffectVariant } from '../types/GridFrameConfig';
import type { GridConfig } from '@/presentation/grid/GridManager';

export class EffectContainer extends FrameSubContainer<EffectVariant> {
  private effectGraphics: Graphics = new Graphics();

  constructor() {
    super('FrameEffects');
    this.addChild(this.effectGraphics);
  }

  protected draw(gc: GridConfig): void {
    const v = this.getActiveVariant();
    if (!v) return;

    this.effectGraphics.clear();

    const gw = this.gridWidth(gc);
    const gh = this.gridHeight(gc);

    switch (v.type) {
      case 'glow':
        this.drawGlow(gw, gh, v);
        break;
      case 'shadow':
        this.drawShadow(gw, gh, v);
        break;
      case 'particles':
        // Particle system would need per-frame update; stub for config-driven setup
        break;
      case 'custom':
        break;
    }

    if (v.blendMode) (this.effectGraphics as any).blendMode = v.blendMode;
  }

  private drawGlow(w: number, h: number, v: EffectVariant): void {
    const spread = v.blur ?? 20;
    this.effectGraphics.roundRect(-spread, -spread, w + spread * 2, h + spread * 2, spread);
    this.effectGraphics.fill({
      color: this.color(v.color, 0x3b82f6),
      alpha: v.alpha ?? 0.15,
    });
  }

  private drawShadow(w: number, h: number, v: EffectVariant): void {
    const ox = v.offsetX ?? 4;
    const oy = v.offsetY ?? 4;
    this.effectGraphics.roundRect(ox, oy, w, h, 8);
    this.effectGraphics.fill({
      color: this.color(v.color, 0x000000),
      alpha: v.alpha ?? 0.3,
    });
  }
}
