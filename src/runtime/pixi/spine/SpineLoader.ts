import { Assets } from 'pixi.js';
import { EventBus } from '@/platform/events/EventBus';
import { AssetResolver, AssetType } from '../assets/AssetResolver';
import { SpineFactory } from './SpineFactory';

export interface SpineLoadConfig {
  key: string;
  jsonPath: string;
  atlasPath: string;
  scale?: number;
  priority?: number;
}

export interface SpineLoadResult {
  key: string;
  success: boolean;
  error?: string;
}

export class SpineLoader {
  private static instance: SpineLoader | null = null;
  
  private eventBus: EventBus;
  private assetResolver: AssetResolver;
  private spineFactory: SpineFactory;
  private loadQueue: SpineLoadConfig[] = [];
  private loadedKeys: Set<string> = new Set();
  private loading: boolean = false;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.assetResolver = AssetResolver.getInstance();
    this.spineFactory = SpineFactory.getInstance();
  }

  public static getInstance(): SpineLoader {
    if (!SpineLoader.instance) {
      SpineLoader.instance = new SpineLoader();
    }
    return SpineLoader.instance;
  }

  public queueSpine(config: SpineLoadConfig): void {
    if (this.loadedKeys.has(config.key)) return;
    this.loadQueue.push(config);
    this.spineFactory.registerSpineAsset(config.key, config.jsonPath, config.atlasPath);
  }

  public queueSpines(configs: SpineLoadConfig[]): void {
    for (const config of configs) {
      this.queueSpine(config);
    }
  }

  public async loadAll(): Promise<SpineLoadResult[]> {
    if (this.loading) {
      console.warn('[SpineLoader] Already loading');
      return [];
    }

    this.loading = true;
    const results: SpineLoadResult[] = [];
    this.loadQueue.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    for (const config of this.loadQueue) {
      const result = await this.loadSingle(config);
      results.push(result);
      if (result.success) this.loadedKeys.add(config.key);
    }

    this.loadQueue = [];
    this.loading = false;
    return results;
  }

  private async loadSingle(config: SpineLoadConfig): Promise<SpineLoadResult> {
    try {
      console.log(`[SpineLoader] Loading spine: ${config.key}`);
      
      const jsonUrl = this.assetResolver.resolve(AssetType.SPINE, config.jsonPath);
      const atlasUrl = this.assetResolver.resolve(AssetType.SPINE, config.atlasPath);

      // Trigger the factory to load via Alias + Spine.from logic
      const success = await this.spineFactory.loadSpine(config.key, jsonUrl, atlasUrl, config.scale);

      if (!success) throw new Error(`Factory failed to load spine: ${config.key}`);

      this.eventBus.emit('asset:spine:loaded', { key: config.key });
      return { key: config.key, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SpineLoader] Failed to load ${config.key}:`, errorMsg);
      return { key: config.key, success: false, error: errorMsg };
    }
  }

  public async loadGameSpines(gameId: string, spineAssets: any[]): Promise<SpineLoadResult[]> {
    const configs: SpineLoadConfig[] = [];
    for (const asset of spineAssets) {
      configs.push({
        key: asset.key,
        jsonPath: asset.path,
        atlasPath: asset.atlasPath,
        scale: asset.scale,
        priority: asset.priority ?? 0,
      });
    }
    this.queueSpines(configs);
    return this.loadAll();
  }

  public async loadSymbolSpines(symbolIds: string[], basePath: string): Promise<SpineLoadResult[]> {
    const configs: SpineLoadConfig[] = [];
    for (const symbolId of symbolIds) {
      const key = `symbol_${symbolId}`;
      configs.push({
        key,
        jsonPath: `${basePath}/${symbolId}/${symbolId}.json`,
        atlasPath: `${basePath}/${symbolId}/${symbolId}.atlas`,
        scale: 1,
        priority: 1,
      });
    }
    this.queueSpines(configs);
    return this.loadAll();
  }

  public isLoaded(key: string): boolean {
    return this.loadedKeys.has(key);
  }

  public unload(key: string): void {
    this.loadedKeys.delete(key);
    this.spineFactory.unloadSpine(key);
  }

  public unloadAll(): void {
    for (const key of this.loadedKeys) {
      this.spineFactory.unloadSpine(key);
    }
    this.loadedKeys.clear();
  }

  public getProgress(): { loaded: number; total: number; percent: number } {
    const total = this.loadQueue.length + this.loadedKeys.size;
    const loaded = this.loadedKeys.size;
    return { loaded, total, percent: total > 0 ? (loaded / total) * 100 : 100 };
  }

  public destroy(): void {
    this.unloadAll();
    this.loadQueue = [];
    SpineLoader.instance = null;
  }
}