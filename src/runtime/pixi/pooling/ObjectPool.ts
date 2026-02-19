/**
 * ObjectPool - Generic object pool implementation
 * Provides reusable object management to prevent runtime allocations.
 */

export interface Poolable {
  reset(): void;
  destroy?(): void;
}

export interface PoolConfig {
  initialSize?: number;
  maxSize?: number;
  autoExpand?: boolean;
  name?: string;
}

/**
 * Generic object pool for reducing garbage collection.
 */
export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private config: Required<PoolConfig>;
  private totalCreated: number = 0;

  constructor(factory: () => T, config: PoolConfig = {}) {
    this.factory = factory;
    this.config = {
      initialSize: config.initialSize ?? 10,
      maxSize: config.maxSize ?? 100,
      autoExpand: config.autoExpand ?? true,
      name: config.name ?? 'ObjectPool',
    };

    this.prewarm();
  }

  /** Prewarm the pool with initial objects */
  private prewarm(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      const obj = this.factory();
      this.totalCreated++;
      this.pool.push(obj);
    }
  }

  /** Acquire an object from the pool */
  public acquire(): T | null {
    let obj: T | undefined;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else if (this.config.autoExpand && this.totalCreated < this.config.maxSize) {
      obj = this.factory();
      this.totalCreated++;
    } else {
      console.warn(`[${this.config.name}] Pool exhausted, max size: ${this.config.maxSize}`);
      return null;
    }

    this.active.add(obj);
    return obj;
  }

  /** Release an object back to the pool */
  public release(obj: T): void {
    if (!this.active.has(obj)) {
      console.warn(`[${this.config.name}] Attempted to release unknown object`);
      return;
    }

    this.active.delete(obj);
    obj.reset();
    this.pool.push(obj);
  }

  /** Release all active objects */
  public releaseAll(): void {
    for (const obj of this.active) {
      obj.reset();
      this.pool.push(obj);
    }
    this.active.clear();
  }

  /** Get pool statistics */
  public getStats(): {
    available: number;
    active: number;
    total: number;
    maxSize: number;
  } {
    return {
      available: this.pool.length,
      active: this.active.size,
      total: this.totalCreated,
      maxSize: this.config.maxSize,
    };
  }

  /** Check if pool has available objects */
  public hasAvailable(): boolean {
    return this.pool.length > 0 || 
      (this.config.autoExpand && this.totalCreated < this.config.maxSize);
  }

  /** Get number of available objects */
  public getAvailableCount(): number {
    return this.pool.length;
  }

  /** Get number of active objects */
  public getActiveCount(): number {
    return this.active.size;
  }

  /** Destroy the pool and all objects */
  public destroy(): void {
    for (const obj of this.pool) {
      if (obj.destroy) obj.destroy();
    }
    for (const obj of this.active) {
      if (obj.destroy) obj.destroy();
    }
    this.pool = [];
    this.active.clear();
    this.totalCreated = 0;
  }

  /** Clear pool but keep capacity */
  public clear(): void {
    this.releaseAll();
  }
}
