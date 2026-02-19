/**
 * WinParticles - lightweight procedural particle effects for win celebrations.
 *
 * No external particle lib: uses Pixi Graphics + GSAP tweens.
 */

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

export interface WinParticleBurstConfig {
  count: number;
  radiusMin: number;
  radiusMax: number;
  spreadX: number;
  spreadY: number;
  riseY: number;
  durationMs: number;
  colors: Array<number | string>;
  alphaMin?: number;
  alphaMax?: number;
}

function parseColor(input: number | string, fallback: number): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input !== 'string') return fallback;
  const s = input.trim().toLowerCase();
  if (s.startsWith('0x')) {
    const n = Number.parseInt(s.slice(2), 16);
    return Number.isFinite(n) ? n : fallback;
  }
  if (s.startsWith('#')) {
    const n = Number.parseInt(s.slice(1), 16);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function spawnWinParticleBurst(container: Container, cx: number, cy: number, cfg: WinParticleBurstConfig): void {
  const duration = Math.max(0.1, cfg.durationMs / 1000);
  const alphaMin = cfg.alphaMin ?? 0.5;
  const alphaMax = cfg.alphaMax ?? 0.95;

  for (let i = 0; i < cfg.count; i++) {
    const g = new Graphics();

    const colorInput = cfg.colors[i % Math.max(1, cfg.colors.length)] ?? 0xffffff;
    const color = parseColor(colorInput, 0xffffff);

    const r = rand(cfg.radiusMin, cfg.radiusMax);
    g.circle(0, 0, r);
    g.fill({ color, alpha: rand(alphaMin, alphaMax) });

    g.x = cx + rand(-cfg.spreadX, cfg.spreadX);
    g.y = cy + rand(-cfg.spreadY, cfg.spreadY);

    container.addChild(g);

    const tx = g.x + rand(-cfg.spreadX * 0.35, cfg.spreadX * 0.35);
    const ty = g.y - rand(cfg.riseY * 0.6, cfg.riseY);

    gsap.to(g, {
      x: tx,
      y: ty,
      alpha: 0,
      duration,
      ease: 'power2.out',
      onComplete: () => {
        container.removeChild(g);
        g.destroy();
      },
    });

    // Animate scale via flat scaleX/scaleY properties — Pixi v8 exposes these
    // on DisplayObject directly; avoids GSAP "Missing plugin?" warning for
    // ObservablePoint (.scale.x / .scale.y are not plain JS properties).
    gsap.to(g, {
      scaleX: rand(0.7, 1.4),
      scaleY: rand(0.7, 1.4),
      duration: duration * 0.6,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    });
  }
}
