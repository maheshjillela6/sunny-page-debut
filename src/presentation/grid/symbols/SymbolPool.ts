/**
 * SymbolPool - Object pool for symbols
 */

import { SymbolView } from './SymbolView';
import { ObjectPool, PoolConfig } from '../../../runtime/pixi/pooling/ObjectPool';

export class SymbolPool {
  private static instance: SymbolPool | null = null;

  private pool: ObjectPool<SymbolView>;
  private symbolSize: number;

  private constructor(symbolSize: number = 120, config: PoolConfig = {}) {
    this.symbolSize = symbolSize;
    this.pool = new ObjectPool<SymbolView>(
      () => new SymbolView(this.symbolSize),
      {
        initialSize: config.initialSize ?? 30,
        maxSize: config.maxSize ?? 100,
        autoExpand: config.autoExpand ?? true,
        name: config.name ?? 'SymbolPool',
      }
    );
  }

  public static getInstance(symbolSize?: number): SymbolPool {
    if (!SymbolPool.instance) {
      SymbolPool.instance = new SymbolPool(symbolSize);
    }
    return SymbolPool.instance;
  }

  public static reset(): void {
    if (SymbolPool.instance) {
      SymbolPool.instance.destroy();
      SymbolPool.instance = null;
    }
  }

  public acquire(): SymbolView | null {
    return this.pool.acquire();
  }

  public release(symbol: SymbolView): void {
    this.pool.release(symbol);
  }

  public releaseAll(): void {
    this.pool.releaseAll();
  }

  public getStats() {
    return this.pool.getStats();
  }

  public destroy(): void {
    this.pool.destroy();
  }
}
