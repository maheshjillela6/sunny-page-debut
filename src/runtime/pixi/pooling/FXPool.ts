/**
 * FXPool - Pool for visual effects
 */

import { Container, Sprite, Graphics, ParticleContainer } from 'pixi.js';
import { ObjectPool, PoolConfig } from './ObjectPool';

export type FXType = 'particle' | 'glow' | 'trail' | 'explosion' | 'coin';

/**
 * Poolable effect wrapper.
 */
export class PoolableFX {
  public container: Container;
  public type: FXType = 'particle';
  public isPlaying: boolean = false;
  public duration: number = 0;
  public elapsed: number = 0;

  constructor() {
    this.container = new Container();
    this.container.label = 'FX';
  }

  public reset(): void {
    this.type = 'particle';
    this.isPlaying = false;
    this.duration = 0;
    this.elapsed = 0;
    this.container.removeChildren();
    this.container.x = 0;
    this.container.y = 0;
    this.container.scale.set(1);
    this.container.rotation = 0;
    this.container.alpha = 1;
    this.container.visible = true;
    this.container.filters = null;
    
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  /** Start playing the effect */
  public play(duration: number = 1000): void {
    this.isPlaying = true;
    this.duration = duration;
    this.elapsed = 0;
  }

  /** Stop the effect */
  public stop(): void {
    this.isPlaying = false;
  }

  /** Update the effect */
  public update(deltaMs: number): boolean {
    if (!this.isPlaying) return false;
    
    this.elapsed += deltaMs;
    if (this.elapsed >= this.duration) {
      this.isPlaying = false;
      return false;
    }
    
    return true;
  }

  /** Get progress (0-1) */
  public getProgress(): number {
    if (this.duration <= 0) return 1;
    return Math.min(1, this.elapsed / this.duration);
  }
}

/**
 * Specialized pool for visual effects.
 */
export class FXPool {
  private pools: Map<FXType, ObjectPool<PoolableFX>> = new Map();
  private defaultConfig: PoolConfig = {
    initialSize: 10,
    maxSize: 50,
  };

  constructor() {
    // Initialize pools for each effect type
    const types: FXType[] = ['particle', 'glow', 'trail', 'explosion', 'coin'];
    for (const type of types) {
      this.pools.set(
        type,
        new ObjectPool(() => new PoolableFX(), {
          ...this.defaultConfig,
          name: `FXPool_${type}`,
        })
      );
    }
  }

  /** Acquire an effect of specific type */
  public acquire(type: FXType): PoolableFX | null {
    const pool = this.pools.get(type);
    if (!pool) {
      console.warn(`[FXPool] Unknown effect type: ${type}`);
      return null;
    }

    const fx = pool.acquire();
    if (fx) {
      fx.type = type;
    }
    return fx;
  }

  /** Release an effect back to its pool */
  public release(fx: PoolableFX): void {
    const pool = this.pools.get(fx.type);
    if (pool) {
      pool.release(fx);
    }
  }

  /** Release all effects */
  public releaseAll(): void {
    for (const pool of this.pools.values()) {
      pool.releaseAll();
    }
  }

  /** Get statistics for all pools */
  public getStats(): Record<FXType, ReturnType<ObjectPool<PoolableFX>['getStats']>> {
    const stats = {} as Record<FXType, ReturnType<ObjectPool<PoolableFX>['getStats']>>;
    for (const [type, pool] of this.pools) {
      stats[type] = pool.getStats();
    }
    return stats;
  }

  /** Destroy all pools */
  public destroy(): void {
    for (const pool of this.pools.values()) {
      pool.destroy();
    }
    this.pools.clear();
  }
}
