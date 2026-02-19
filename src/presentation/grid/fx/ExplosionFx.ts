/**
 * ExplosionFx - Explosion particle effect
 */

import { Container, Graphics } from 'pixi.js';

interface Particle {
  graphics: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class ExplosionFx extends Container {
  private particles: Particle[] = [];
  private isPlaying: boolean = false;
  private particleCount: number = 20;

  constructor() {
    super();
    this.label = 'ExplosionFx';
    this.visible = false;
  }

  public play(x: number, y: number, color: number = 0xf1c40f): void {
    this.x = x;
    this.y = y;
    this.isPlaying = true;
    this.visible = true;

    // Clear old particles
    for (const p of this.particles) {
      p.graphics.destroy();
    }
    this.particles = [];

    // Create new particles
    for (let i = 0; i < this.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / this.particleCount;
      const speed = 2 + Math.random() * 3;

      const graphics = new Graphics();
      graphics.circle(0, 0, 3 + Math.random() * 4);
      graphics.fill({ color });
      this.addChild(graphics);

      this.particles.push({
        graphics,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 30 + Math.random() * 20,
      });
    }
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    let allDead = true;

    for (const p of this.particles) {
      if (p.life > 0) {
        allDead = false;

        p.graphics.x += p.vx * deltaTime;
        p.graphics.y += p.vy * deltaTime;
        p.vy += 0.1 * deltaTime; // gravity

        p.life -= deltaTime / p.maxLife;
        p.graphics.alpha = p.life;
        p.graphics.scale.set(p.life);
      }
    }

    if (allDead) {
      this.stop();
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.visible = false;

    for (const p of this.particles) {
      p.graphics.destroy();
    }
    this.particles = [];
  }

  public reset(): void {
    this.stop();
    this.x = 0;
    this.y = 0;
  }
}
