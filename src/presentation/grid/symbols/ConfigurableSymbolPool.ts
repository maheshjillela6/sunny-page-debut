/**
 * ConfigurableSymbolPool - Object pool for ConfigurableSymbolView instances.
 *
 * Drop-in replacement for SymbolPool when using the new composition system.
 */

import { ConfigurableSymbolView } from './ConfigurableSymbolView';
import { ObjectPool, PoolConfig } from '../../../runtime/pixi/pooling/ObjectPool';

export class ConfigurableSymbolPool {
  private static instance: ConfigurableSymbolPool | null = null;

  private pool: ObjectPool<ConfigurableSymbolView>;
  private symbolSize: number;

  private constructor(symbolSize: number = 120, config: PoolConfig = {}) {
    this.symbolSize = symbolSize;
    this.pool = new ObjectPool<ConfigurableSymbolView>(
      () => new ConfigurableSymbolView(this.symbolSize),
      {
        initialSize: config.initialSize ?? 30,
        maxSize: config.maxSize ?? 100,
        autoExpand: config.autoExpand ?? true,
        name: config.name ?? 'ConfigurableSymbolPool',
      },
    );
  }

  public static getInstance(symbolSize?: number): ConfigurableSymbolPool {
    if (!ConfigurableSymbolPool.instance) {
      ConfigurableSymbolPool.instance = new ConfigurableSymbolPool(symbolSize);
    }
    return ConfigurableSymbolPool.instance;
  }

  public static reset(): void {
    if (ConfigurableSymbolPool.instance) {
      ConfigurableSymbolPool.instance.destroy();
      ConfigurableSymbolPool.instance = null;
    }
  }

  public acquire(): ConfigurableSymbolView | null {
    return this.pool.acquire();
  }

  public release(symbol: ConfigurableSymbolView): void {
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
