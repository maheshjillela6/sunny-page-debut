/**
 * SpinePool - Pool for Spine animations
 * Note: Spine integration requires @pixi/spine-pixi package
 */

import { Container } from 'pixi.js';
import { ObjectPool, PoolConfig } from './ObjectPool';

/**
 * Poolable Spine wrapper (placeholder for actual Spine integration).
 */
export class PoolableSpine {
  public container: Container;
  public skeletonData: string = '';
  public currentAnimation: string = '';
  public isPlaying: boolean = false;

  constructor() {
    this.container = new Container();
    this.container.label = 'Spine';
  }

  public reset(): void {
    this.skeletonData = '';
    this.currentAnimation = '';
    this.isPlaying = false;
    this.container.removeChildren();
    this.container.x = 0;
    this.container.y = 0;
    this.container.scale.set(1);
    this.container.rotation = 0;
    this.container.alpha = 1;
    this.container.visible = true;
    
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  /** Play an animation */
  public play(animationName: string, loop: boolean = true): void {
    this.currentAnimation = animationName;
    this.isPlaying = true;
    // Actual Spine playback would be implemented here
  }

  /** Stop current animation */
  public stop(): void {
    this.isPlaying = false;
  }

  /** Set animation speed */
  public setTimeScale(scale: number): void {
    // Actual Spine time scale would be set here
  }
}

/**
 * Specialized pool for Spine animations.
 */
export class SpinePool {
  private pools: Map<string, ObjectPool<PoolableSpine>> = new Map();

  /** Get or create a pool for a skeleton type */
  public getPool(skeletonKey: string, config: PoolConfig = {}): ObjectPool<PoolableSpine> {
    if (!this.pools.has(skeletonKey)) {
      this.pools.set(
        skeletonKey,
        new ObjectPool(() => new PoolableSpine(), {
          initialSize: config.initialSize ?? 5,
          maxSize: config.maxSize ?? 20,
          name: `SpinePool_${skeletonKey}`,
        })
      );
    }
    return this.pools.get(skeletonKey)!;
  }

  /** Acquire a Spine animation */
  public acquire(skeletonKey: string): PoolableSpine | null {
    const pool = this.getPool(skeletonKey);
    const spine = pool.acquire();
    if (spine) {
      spine.skeletonData = skeletonKey;
    }
    return spine;
  }

  /** Release a Spine animation */
  public release(spine: PoolableSpine): void {
    const pool = this.pools.get(spine.skeletonData);
    if (pool) {
      pool.release(spine);
    }
  }

  /** Release all animations */
  public releaseAll(): void {
    for (const pool of this.pools.values()) {
      pool.releaseAll();
    }
  }

  /** Get statistics */
  public getStats(): Record<string, ReturnType<ObjectPool<PoolableSpine>['getStats']>> {
    const stats: Record<string, ReturnType<ObjectPool<PoolableSpine>['getStats']>> = {};
    for (const [key, pool] of this.pools) {
      stats[key] = pool.getStats();
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
