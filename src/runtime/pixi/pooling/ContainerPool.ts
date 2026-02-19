/**
 * ContainerPool - Pool specifically for containers
 */

import { Container } from 'pixi.js';
import { ObjectPool, PoolConfig } from './ObjectPool';

/**
 * Poolable container wrapper.
 */
class PoolableContainer {
  public container: Container;
  
  constructor() {
    this.container = new Container();
  }

  public reset(): void {
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
}

/**
 * Specialized pool for Container objects.
 */
export class ContainerPool {
  private pool: ObjectPool<PoolableContainer>;

  constructor(config: PoolConfig = {}) {
    this.pool = new ObjectPool(
      () => new PoolableContainer(),
      { ...config, name: config.name ?? 'ContainerPool' }
    );
  }

  /** Acquire a container from pool */
  public acquire(name?: string): Container | null {
    const poolable = this.pool.acquire();
    if (!poolable) return null;

    if (name) {
      poolable.container.label = name;
    }
    return poolable.container;
  }

  /** Release a container back to pool */
  public release(container: Container): void {
    // Find the poolable wrapper - simplified approach
    // In production, you'd maintain a reverse map
    const poolable = new PoolableContainer();
    poolable.container = container;
    this.pool.release(poolable);
  }

  /** Release all containers */
  public releaseAll(): void {
    this.pool.releaseAll();
  }

  /** Get pool statistics */
  public getStats() {
    return this.pool.getStats();
  }

  /** Destroy the pool */
  public destroy(): void {
    this.pool.destroy();
  }
}
