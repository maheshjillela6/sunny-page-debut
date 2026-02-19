/**
 * WinAnimations - 4 distinct configurable win-celebration animations.
 *
 *  1. "classic"   - gentle coin-rise burst (original WinParticles style, default)
 *  2. "burst"     - wide confetti-style particle explosion
 *  3. "shockwave" - expanding ring + radial sparks
 *  4. "rain"      - particles fall from the top of the screen
 *
 * Each animation is fully driven by config from presentation.layer.json
 * under the "winAnimation" key.
 */

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { spawnWinParticleBurst } from './WinParticles';

// ── Shared helpers ───────────────────────────────────────────────────────────

function parseColor(input: number | string, fallback = 0xffffff): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input !== 'string') return fallback;
  const s = input.trim().toLowerCase();
  if (s.startsWith('0x')) { const n = parseInt(s.slice(2), 16); return isFinite(n) ? n : fallback; }
  if (s.startsWith('#')) { const n = parseInt(s.slice(1), 16); return isFinite(n) ? n : fallback; }
  return fallback;
}

function rand(min: number, max: number) { return min + Math.random() * (max - min); }

// ── Config types ─────────────────────────────────────────────────────────────

export interface ClassicAnimationConfig {
  type: 'classic';
  enabled: boolean;
  /** Particle count (default 28) */
  count?: number;
  colors?: (number | string)[];
  radiusMin?: number;
  radiusMax?: number;
  spreadX?: number;
  spreadY?: number;
  riseY?: number;
  durationMs?: number;
  alphaMin?: number;
  alphaMax?: number;
}

export interface BurstAnimationConfig {
  type: 'burst';
  enabled: boolean;
  count?: number;
  colors?: (number | string)[];
  radiusMin?: number;
  radiusMax?: number;
  spreadX?: number;
  spreadY?: number;
  riseY?: number;
  durationMs?: number;
  alphaMin?: number;
  alphaMax?: number;
}

export interface ShockwaveAnimationConfig {
  type: 'shockwave';
  enabled: boolean;
  ringCount?: number;
  ringColor?: number | string;
  ringAlpha?: number;
  sparkCount?: number;
  sparkColors?: (number | string)[];
  maxRadius?: number;
  durationMs?: number;
}

export interface RainAnimationConfig {
  type: 'rain';
  enabled: boolean;
  count?: number;
  colors?: (number | string)[];
  radiusMin?: number;
  radiusMax?: number;
  spreadX?: number;
  fallY?: number;
  durationMs?: number;
  staggerMs?: number;
}

export type WinAnimationConfig =
  | ClassicAnimationConfig
  | BurstAnimationConfig
  | ShockwaveAnimationConfig
  | RainAnimationConfig;

// ── 0. Classic (original WinParticles coin-rise style) ───────────────────────

export function playClassicAnimation(
  _container: Container,
  _cx: number,
  _cy: number,
  _cfg: Partial<ClassicAnimationConfig> = {},
): void {
  // No-op: classic animation intentionally produces no visual effect.
}


// ── 1. Burst (confetti-style) ────────────────────────────────────────────────

export function playBurstAnimation(
  container: Container,
  cx: number,
  cy: number,
  cfg: Partial<BurstAnimationConfig> = {},
): void {
  const count = cfg.count ?? 40;
  const colors = cfg.colors ?? [0xfbbf24, 0x06b6d4, 0xffffff];
  const radiusMin = cfg.radiusMin ?? 3;
  const radiusMax = cfg.radiusMax ?? 7;
  const spreadX = cfg.spreadX ?? 200;
  const spreadY = cfg.spreadY ?? 70;
  const riseY = cfg.riseY ?? 160;
  const duration = Math.max(0.1, (cfg.durationMs ?? 800) / 1000);
  const alphaMin = cfg.alphaMin ?? 0.5;
  const alphaMax = cfg.alphaMax ?? 1;

  for (let i = 0; i < count; i++) {
    const g = new Graphics();
    const color = parseColor(colors[i % colors.length] ?? 0xffffff);
    const r = rand(radiusMin, radiusMax);
    g.circle(0, 0, r).fill({ color, alpha: rand(alphaMin, alphaMax) });
    g.x = cx + rand(-spreadX, spreadX);
    g.y = cy + rand(-spreadY, spreadY);
    container.addChild(g);

    const tx = g.x + rand(-spreadX * 0.4, spreadX * 0.4);
    const ty = g.y - rand(riseY * 0.5, riseY);

    gsap.to(g, {
      x: tx, y: ty, alpha: 0, duration,
      ease: 'power2.out',
      delay: rand(0, 0.15),
      onComplete: () => { container.removeChild(g); g.destroy(); },
    });
    // Animate scale via flat scaleX/scaleY — avoids GSAP ObservablePoint warning
    gsap.to(g, {
      scaleX: rand(0.6, 1.5), scaleY: rand(0.6, 1.5),
      duration: duration * 0.5,
      yoyo: true, repeat: 1, ease: 'sine.inOut',
    });
  }
}

// ── 2. Shockwave (expanding ring + radial sparks) ────────────────────────────

export function playShockwaveAnimation(
  container: Container,
  cx: number,
  cy: number,
  cfg: Partial<ShockwaveAnimationConfig> = {},
): void {
  const ringCount = cfg.ringCount ?? 3;
  const ringColor = parseColor(cfg.ringColor ?? 0xfbbf24);
  const ringAlpha = cfg.ringAlpha ?? 0.8;
  const sparkCount = cfg.sparkCount ?? 24;
  const sparkColors = cfg.sparkColors ?? [0xfbbf24, 0x06b6d4, 0xffffff];
  const maxRadius = cfg.maxRadius ?? 220;
  const duration = Math.max(0.1, (cfg.durationMs ?? 900) / 1000);

  // Rings
  for (let ri = 0; ri < ringCount; ri++) {
    const ring = new Graphics();
    ring.x = cx;
    ring.y = cy;
    container.addChild(ring);

    const delay = (ri / ringCount) * duration * 0.4;
    const durationRing = duration * 0.7;

    // Animate using ticker via gsap proxy
    const proxy = { radius: 0, alpha: ringAlpha };
    gsap.to(proxy, {
      radius: maxRadius,
      alpha: 0,
      duration: durationRing,
      delay,
      ease: 'power2.out',
      onUpdate: () => {
        ring.clear();
        ring.circle(0, 0, proxy.radius).stroke({ color: ringColor, alpha: proxy.alpha, width: 4 });
      },
      onComplete: () => { container.removeChild(ring); ring.destroy(); },
    });
  }

  // Radial sparks
  for (let si = 0; si < sparkCount; si++) {
    const angle = (si / sparkCount) * Math.PI * 2;
    const g = new Graphics();
    const color = parseColor((sparkColors as any)[si % sparkColors.length] ?? 0xffffff);
    const r = rand(2, 5);
    g.circle(0, 0, r).fill({ color, alpha: rand(0.7, 1) });
    g.x = cx;
    g.y = cy;
    container.addChild(g);

    const dist = rand(maxRadius * 0.5, maxRadius * 1.1);
    gsap.to(g, {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      alpha: 0,
      duration: duration * 0.85,
      ease: 'power2.out',
      delay: rand(0, 0.1),
      onComplete: () => { container.removeChild(g); g.destroy(); },
    });
  }
}

// ── 3. Rain (particles fall from top) ───────────────────────────────────────

export function playRainAnimation(
  container: Container,
  cx: number,
  _cy: number,
  cfg: Partial<RainAnimationConfig> = {},
  stageHeight = 1080,
): void {
  const count = cfg.count ?? 50;
  const colors = cfg.colors ?? [0xfbbf24, 0x06b6d4, 0xc084fc, 0xffffff];
  const radiusMin = cfg.radiusMin ?? 3;
  const radiusMax = cfg.radiusMax ?? 7;
  const spreadX = cfg.spreadX ?? 300;
  const fallY = cfg.fallY ?? stageHeight + 80;
  const duration = Math.max(0.1, (cfg.durationMs ?? 1200) / 1000);
  const stagger = (cfg.staggerMs ?? 600) / 1000;

  for (let i = 0; i < count; i++) {
    const g = new Graphics();
    const color = parseColor(colors[i % colors.length] ?? 0xffffff);
    const r = rand(radiusMin, radiusMax);
    g.circle(0, 0, r).fill({ color, alpha: rand(0.6, 1) });
    g.x = cx + rand(-spreadX, spreadX);
    g.y = -20;
    container.addChild(g);

    gsap.to(g, {
      y: fallY,
      alpha: 0,
      duration: duration,
      delay: rand(0, stagger),
      ease: 'power1.in',
      onComplete: () => { container.removeChild(g); g.destroy(); },
    });
    // Wobble horizontally
    gsap.to(g, {
      x: g.x + rand(-40, 40),
      duration: duration * 0.4,
      yoyo: true,
      repeat: Math.floor(duration / 0.4),
      ease: 'sine.inOut',
    });
  }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export function playWinAnimation(
  container: Container,
  cx: number,
  cy: number,
  cfg: WinAnimationConfig,
  stageHeight?: number,
): void {
  if (!cfg.enabled) return;
  switch (cfg.type) {
    case 'classic':
      playClassicAnimation(container, cx, cy, cfg);
      break;
    case 'burst':
      playBurstAnimation(container, cx, cy, cfg);
      break;
    case 'shockwave':
      playShockwaveAnimation(container, cx, cy, cfg);
      break;
    case 'rain':
      playRainAnimation(container, cx, cy, cfg, stageHeight);
      break;
  }
}
