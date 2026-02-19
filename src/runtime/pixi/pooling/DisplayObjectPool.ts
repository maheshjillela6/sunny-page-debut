/**
 * DisplayObjectPool - Pool for Pixi display objects
 */

import { Container, Sprite, Graphics, Text } from 'pixi.js';

export type DisplayObjectType = 'container' | 'sprite' | 'graphics' | 'text';

interface PooledDisplayObject {
  instance: Container | Sprite | Graphics | Text;
  inUse: boolean;
}

/**
 * Specialized pool for Pixi display objects.
 */
export class DisplayObjectPool {
  private pools: Map<string, PooledDisplayObject[]> = new Map();
  private maxPerType: number;

  constructor(maxPerType: number = 50) {
    this.maxPerType = maxPerType;
  }

  /** Get or create a pool for a type */
  private getPool(type: string): PooledDisplayObject[] {
    if (!this.pools.has(type)) {
      this.pools.set(type, []);
    }
    return this.pools.get(type)!;
  }

  /** Acquire a container */
  public acquireContainer(name?: string): Container {
    const pool = this.getPool('container');
    
    for (const item of pool) {
      if (!item.inUse) {
        item.inUse = true;
        const container = item.instance as Container;
        this.resetContainer(container);
        if (name) container.label = name;
        return container;
      }
    }

    if (pool.length < this.maxPerType) {
      const container = new Container();
      if (name) container.label = name;
      pool.push({ instance: container, inUse: true });
      return container;
    }

    console.warn('[DisplayObjectPool] Container pool exhausted');
    return new Container();
  }

  /** Acquire a sprite */
  public acquireSprite(): Sprite {
    const pool = this.getPool('sprite');
    
    for (const item of pool) {
      if (!item.inUse) {
        item.inUse = true;
        const sprite = item.instance as Sprite;
        this.resetSprite(sprite);
        return sprite;
      }
    }

    if (pool.length < this.maxPerType) {
      const sprite = new Sprite();
      pool.push({ instance: sprite, inUse: true });
      return sprite;
    }

    console.warn('[DisplayObjectPool] Sprite pool exhausted');
    return new Sprite();
  }

  /** Acquire graphics */
  public acquireGraphics(): Graphics {
    const pool = this.getPool('graphics');
    
    for (const item of pool) {
      if (!item.inUse) {
        item.inUse = true;
        const graphics = item.instance as Graphics;
        graphics.clear();
        this.resetDisplayObject(graphics);
        return graphics;
      }
    }

    if (pool.length < this.maxPerType) {
      const graphics = new Graphics();
      pool.push({ instance: graphics, inUse: true });
      return graphics;
    }

    console.warn('[DisplayObjectPool] Graphics pool exhausted');
    return new Graphics();
  }

  /** Release a display object back to pool */
  public release(obj: Container | Sprite | Graphics | Text): void {
    for (const [type, pool] of this.pools) {
      for (const item of pool) {
        if (item.instance === obj) {
          item.inUse = false;
          if (obj.parent) {
            obj.parent.removeChild(obj);
          }
          return;
        }
      }
    }
  }

  /** Reset container to default state */
  private resetContainer(container: Container): void {
    container.removeChildren();
    this.resetDisplayObject(container);
  }

  /** Reset sprite to default state */
  private resetSprite(sprite: Sprite): void {
    sprite.texture = null as unknown as typeof sprite.texture;
    sprite.anchor.set(0);
    this.resetDisplayObject(sprite);
  }

  /** Reset common display object properties */
  private resetDisplayObject(obj: Container): void {
    obj.x = 0;
    obj.y = 0;
    obj.scale.set(1);
    obj.rotation = 0;
    obj.alpha = 1;
    obj.visible = true;
    obj.filters = null;
  }

  /** Get pool statistics */
  public getStats(): Record<string, { total: number; inUse: number; available: number }> {
    const stats: Record<string, { total: number; inUse: number; available: number }> = {};
    
    for (const [type, pool] of this.pools) {
      const inUse = pool.filter(p => p.inUse).length;
      stats[type] = {
        total: pool.length,
        inUse,
        available: pool.length - inUse,
      };
    }
    
    return stats;
  }

  /** Clear all pools */
  public clear(): void {
    for (const pool of this.pools.values()) {
      for (const item of pool) {
        if (item.instance.parent) {
          item.instance.parent.removeChild(item.instance);
        }
        item.inUse = false;
      }
    }
  }

  /** Destroy all pools */
  public destroy(): void {
    for (const pool of this.pools.values()) {
      for (const item of pool) {
        item.instance.destroy({ children: true });
      }
    }
    this.pools.clear();
  }
}
