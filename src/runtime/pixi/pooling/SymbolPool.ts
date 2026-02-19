/**
 * SymbolPool - Pool for slot machine symbols
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { ObjectPool, PoolConfig } from './ObjectPool';

export interface SymbolConfig {
  id: string;
  textureKey: string;
  width: number;
  height: number;
}

/**
 * Poolable symbol wrapper.
 */
export class PoolableSymbol {
  public container: Container;
  public sprite: Sprite;
  public symbolId: string = '';
  public row: number = 0;
  public col: number = 0;

  constructor() {
    this.container = new Container();
    this.container.label = 'Symbol';
    
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.container.addChild(this.sprite);
  }

  public reset(): void {
    this.symbolId = '';
    this.row = 0;
    this.col = 0;
    this.container.x = 0;
    this.container.y = 0;
    this.container.scale.set(1);
    this.container.rotation = 0;
    this.container.alpha = 1;
    this.container.visible = true;
    this.container.filters = null;
    this.sprite.texture = Texture.EMPTY;
    
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  /** Set the symbol texture */
  public setTexture(texture: Texture): void {
    this.sprite.texture = texture;
  }

  /** Position the symbol */
  public setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  /** Set grid position */
  public setGridPosition(row: number, col: number): void {
    this.row = row;
    this.col = col;
  }
}

/**
 * Specialized pool for slot machine symbols.
 */
export class SymbolPool {
  private pool: ObjectPool<PoolableSymbol>;
  private symbolMap: Map<PoolableSymbol, Container> = new Map();

  constructor(config: PoolConfig = {}) {
    this.pool = new ObjectPool(
      () => new PoolableSymbol(),
      { 
        initialSize: config.initialSize ?? 50,
        maxSize: config.maxSize ?? 200,
        name: config.name ?? 'SymbolPool' 
      }
    );
  }

  /** Acquire a symbol from pool */
  public acquire(): PoolableSymbol | null {
    const symbol = this.pool.acquire();
    if (symbol) {
      this.symbolMap.set(symbol, symbol.container);
    }
    return symbol;
  }

  /** Release a symbol back to pool */
  public release(symbol: PoolableSymbol): void {
    this.symbolMap.delete(symbol);
    this.pool.release(symbol);
  }

  /** Release all symbols */
  public releaseAll(): void {
    this.symbolMap.clear();
    this.pool.releaseAll();
  }

  /** Get pool statistics */
  public getStats() {
    return this.pool.getStats();
  }

  /** Destroy the pool */
  public destroy(): void {
    this.symbolMap.clear();
    this.pool.destroy();
  }
}
