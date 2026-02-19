/**
 * PixiHudElement - A single HUD element rendered in PixiJS.
 *
 * Rendering priority:
 *   1. If a `pixiSprite` key is defined in config AND the texture exists → render Sprite
 *   2. If sprite key is defined but texture not found → fallback to Graphics shape
 *   3. If no sprite key is defined → don't render (element skipped)
 *
 * For "icon" layout mode, all elements use Graphics shapes (no sprites expected).
 * For "image"/"hybrid" modes, sprites are attempted first.
 */

import { Container, Graphics, Sprite, Text, TextStyle, Texture, Assets } from 'pixi.js';
import type { ResolvedHudElement, HudLayoutMode } from '../../ui/hud/types/HudLayoutTypes';

export class PixiHudElement extends Container {
  private config: ResolvedHudElement;
  private mode: HudLayoutMode;
  private bg: Graphics;
  private sprite: Sprite | null = null;
  private labelText: Text | null = null;
  private valueText: Text | null = null;
  private _onClick: (() => void) | null = null;

  constructor(config: ResolvedHudElement, mode: HudLayoutMode) {
    super();
    this.config = config;
    this.mode = mode;
    this.label = `hud-${config.id}`;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.interactive = false;
    this.cursor = 'default';

    this.build();
    this.applyTransforms();
  }

  /** Apply scale, rotation, and anchor from config */
  private applyTransforms(): void {
    const s = this.config.style;
    const w = s.width ?? 80;
    const h = s.height ?? 40;

    // Anchor / pivot (0–1 range mapped to pixel dimensions)
    const ax = s.anchorX ?? 0;
    const ay = s.anchorY ?? 0;
    this.pivot.set(w * ax, h * ay);

    // Scale
    const sx = s.scaleX ?? s.scale ?? 1;
    const sy = s.scaleY ?? s.scale ?? 1;
    this.scale.set(sx, sy);

    // Rotation (degrees → radians)
    if (s.rotation) {
      this.rotation = (s.rotation * Math.PI) / 180;
    }
  }

  /** Build the element visuals */
  private build(): void {
    const s = this.config.style;
    const w = s.width ?? 80;
    const h = s.height ?? 40;

    // Draw background Graphics shape
    this.drawBackground(w, h);

    // Try to load sprite
    if (this.shouldAttemptSprite()) {
      this.tryLoadSprite(w, h);
    }

    // Add label text if present
    if (this.config.label) {
      this.addLabel(w, h);
    }
  }

  /** Determine if we should attempt to render a sprite */
  private shouldAttemptSprite(): boolean {
    // Only attempt sprite if the config explicitly provides a pixiSprite key
    if (!this.config.pixiSprite) return false;
    // In icon mode, we still allow sprites if explicitly configured
    return true;
  }

  /** Draw the Graphics fallback / background */
  private drawBackground(w: number, h: number): void {
    const s = this.config.style;
    const radius = s.borderRadius ?? 8;
    const glowColor = this.parseColor(s.glowColor);

    this.bg.clear();

    // Background fill
    this.bg.roundRect(0, 0, w, h, Math.min(radius, w / 2));
    this.bg.fill({ color: 0x1a1a2e, alpha: s.opacity ?? 0.9 });

    // Border
    this.bg.roundRect(0, 0, w, h, Math.min(radius, w / 2));
    this.bg.stroke({ color: glowColor ?? 0x444466, width: 1, alpha: 0.6 });
  }

  /** Try to load and display a sprite texture */
  private async tryLoadSprite(w: number, h: number): Promise<void> {
    const spriteKey = this.config.pixiSprite!;
    try {
      // Check if texture is already in cache
      let texture: Texture | null = null;
      try {
        texture = Texture.from(spriteKey);
      } catch {
        // Try loading from assets
        try {
          texture = await Assets.load(spriteKey);
        } catch {
          texture = null;
        }
      }

      if (texture && texture !== Texture.EMPTY) {
        this.sprite = new Sprite(texture);
        const iconSize = this.config.style.iconSize ?? Math.min(w, h) * 0.6;
        this.sprite.width = iconSize;
        this.sprite.height = iconSize;
        this.sprite.anchor.set(0.5);
        this.sprite.position.set(w / 2, h / 2);
        this.addChild(this.sprite);
        console.log(`[PixiHudElement] Sprite loaded for "${this.config.id}": ${spriteKey}`);
      } else {
        console.warn(`[PixiHudElement] Sprite texture not found for "${this.config.id}": ${spriteKey}, using Graphics fallback`);
        this.drawIconFallback(w, h);
      }
    } catch {
      console.warn(`[PixiHudElement] Failed to load sprite for "${this.config.id}": ${spriteKey}, using Graphics fallback`);
      this.drawIconFallback(w, h);
    }
  }

  /** Draw a simple icon shape as fallback when sprite is not available */
  private drawIconFallback(w: number, h: number): void {
    const iconG = new Graphics();
    const iconSize = this.config.style.iconSize ?? Math.min(w, h) * 0.4;
    const cx = w / 2;
    const cy = h / 2;
    const glowColor = this.parseColor(this.config.style.glowColor) ?? 0x8b5cf6;

    switch (this.config.id) {
      case 'spinButton':
        // Play triangle
        iconG.moveTo(cx - iconSize * 0.3, cy - iconSize * 0.4);
        iconG.lineTo(cx + iconSize * 0.4, cy);
        iconG.lineTo(cx - iconSize * 0.3, cy + iconSize * 0.4);
        iconG.closePath();
        iconG.fill({ color: 0xffffff });
        break;
      case 'balance':
      case 'bet':
      case 'win':
        // Coin circle
        iconG.circle(cx - w * 0.3, cy, iconSize * 0.3);
        iconG.fill({ color: glowColor, alpha: 0.8 });
        break;
      case 'exit':
        // Arrow left
        iconG.moveTo(cx + iconSize * 0.3, cy - iconSize * 0.3);
        iconG.lineTo(cx - iconSize * 0.3, cy);
        iconG.lineTo(cx + iconSize * 0.3, cy + iconSize * 0.3);
        iconG.stroke({ color: 0xffffff, width: 2 });
        break;
      case 'autoplay':
        // Circular arrow
        iconG.arc(cx, cy, iconSize * 0.3, 0, Math.PI * 1.5);
        iconG.stroke({ color: 0xffffff, width: 2 });
        break;
      case 'turbo':
        // Lightning bolt
        iconG.moveTo(cx, cy - iconSize * 0.4);
        iconG.lineTo(cx - iconSize * 0.15, cy);
        iconG.lineTo(cx + iconSize * 0.05, cy);
        iconG.lineTo(cx, cy + iconSize * 0.4);
        iconG.lineTo(cx + iconSize * 0.15, cy);
        iconG.lineTo(cx - iconSize * 0.05, cy);
        iconG.closePath();
        iconG.fill({ color: 0xfbbf24 });
        break;
      case 'menu':
        // Hamburger lines
        for (let i = -1; i <= 1; i++) {
          iconG.rect(cx - iconSize * 0.3, cy + i * iconSize * 0.25 - 1, iconSize * 0.6, 2);
        }
        iconG.fill({ color: 0xffffff });
        break;
      case 'jackpotMeter': {
        // Crown icon
        const crownW = iconSize * 0.6;
        const crownH = iconSize * 0.4;
        iconG.moveTo(cx - crownW, cy + crownH);
        iconG.lineTo(cx - crownW, cy - crownH * 0.5);
        iconG.lineTo(cx - crownW * 0.5, cy);
        iconG.lineTo(cx, cy - crownH);
        iconG.lineTo(cx + crownW * 0.5, cy);
        iconG.lineTo(cx + crownW, cy - crownH * 0.5);
        iconG.lineTo(cx + crownW, cy + crownH);
        iconG.closePath();
        iconG.fill({ color: 0xffd700 });
        // Progress bar background
        const barY = cy + crownH + 4;
        const barW = w * 0.7;
        const barH = 4;
        iconG.rect(cx - barW / 2, barY, barW, barH);
        iconG.fill({ color: 0x333333, alpha: 0.6 });
        // Progress bar fill (default 60%)
        iconG.rect(cx - barW / 2, barY, barW * 0.6, barH);
        iconG.fill({ color: 0xffd700, alpha: 0.9 });
        break;
      }
      case 'buyBonus': {
        // Shopping bag / gift box icon
        const boxS = iconSize * 0.35;
        iconG.rect(cx - boxS, cy - boxS, boxS * 2, boxS * 2);
        iconG.fill({ color: 0x22c55e, alpha: 0.9 });
        // Ribbon cross
        iconG.rect(cx - 1.5, cy - boxS, 3, boxS * 2);
        iconG.fill({ color: 0xffffff, alpha: 0.8 });
        iconG.rect(cx - boxS, cy - 1.5, boxS * 2, 3);
        iconG.fill({ color: 0xffffff, alpha: 0.8 });
        break;
      }
      default:
        // Generic dot
        iconG.circle(cx, cy, iconSize * 0.2);
        iconG.fill({ color: glowColor ?? 0x888888 });
        break;
    }

    this.addChild(iconG);
  }

  /** Add label text */
  private addLabel(w: number, h: number): void {
    const s = this.config.style;
    const style = new TextStyle({
      fontSize: s.labelFontSize ?? s.fontSize ?? 12,
      fontWeight: (s.fontWeight as any) ?? 'normal',
      fill: 0xcccccc,
      fontFamily: 'Arial, sans-serif',
    });
    this.labelText = new Text({ text: this.config.label!, style });
    this.labelText.anchor.set(0.5);
    this.labelText.position.set(w / 2, h - (s.labelFontSize ?? 10));
    this.addChild(this.labelText);
  }

  /** Set a dynamic value (e.g. balance amount) */
  public setValue(text: string): void {
    const s = this.config.style;
    const w = s.width ?? 80;
    const h = s.height ?? 40;

    if (!this.valueText) {
      const style = new TextStyle({
        fontSize: s.fontSize ?? 16,
        fontWeight: 'bold',
        fill: 0xffffff,
        fontFamily: 'Arial, sans-serif',
      });
      this.valueText = new Text({ text, style });
      this.valueText.anchor.set(0.5);
      this.valueText.position.set(w / 2, h / 2);
      this.addChild(this.valueText);
    } else {
      this.valueText.text = text;
    }
  }

  /** Set active/highlighted state */
  public setActive(active: boolean): void {
    const s = this.config.style;
    const w = s.width ?? 80;
    const h = s.height ?? 40;
    const radius = s.borderRadius ?? 8;
    const glowColor = this.parseColor(s.glowColor) ?? 0x8b5cf6;

    this.bg.clear();
    this.bg.roundRect(0, 0, w, h, Math.min(radius, w / 2));
    this.bg.fill({ color: active ? 0x2a1a4e : 0x1a1a2e, alpha: s.opacity ?? 0.9 });
    this.bg.roundRect(0, 0, w, h, Math.min(radius, w / 2));
    this.bg.stroke({ color: active ? glowColor : 0x444466, width: active ? 2 : 1, alpha: active ? 1 : 0.6 });
  }

  /** Set disabled state */
  public setDisabled(disabled: boolean): void {
    this.alpha = disabled ? 0.5 : 1;
    this.interactive = !disabled;
  }

  /** Register click handler */
  public setOnClick(handler: () => void): void {
    this._onClick = handler;
    this.interactive = true;
    this.cursor = 'pointer';
    this.on('pointerdown', () => {
      if (this._onClick) this._onClick();
    });
  }

  /** Parse a CSS color string to a number */
  private parseColor(color?: string): number | null {
    if (!color) return null;
    if (color.startsWith('#')) {
      return parseInt(color.slice(1), 16);
    }
    if (color === 'primary') return 0x8b5cf6;
    if (color === 'accent') return 0x06b6d4;
    return null;
  }

  /** Update element size (for responsive) */
  public resize(w: number, h: number): void {
    this.drawBackground(w, h);
    if (this.sprite) {
      const iconSize = this.config.style.iconSize ?? Math.min(w, h) * 0.6;
      this.sprite.width = iconSize;
      this.sprite.height = iconSize;
      this.sprite.position.set(w / 2, h / 2);
    }
    if (this.labelText) {
      this.labelText.position.set(w / 2, h - (this.config.style.labelFontSize ?? 10));
    }
    if (this.valueText) {
      this.valueText.position.set(w / 2, h / 2);
    }
  }

  public getConfig(): ResolvedHudElement {
    return this.config;
  }
}
