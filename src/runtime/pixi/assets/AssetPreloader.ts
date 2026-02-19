/**
 * AssetPreloader - Orchestrates asset loading with progress tracking and fallback support
 */

import { EventBus } from '../../../platform/events/EventBus';
import { TextureCache } from './TextureCache';
import { SpritesheetLoader, SpritesheetConfig } from './SpritesheetLoader';
import { AssetResolver } from './AssetResolver';
import { DefaultAssets } from './DefaultAssets';
import { SpineFactory } from '../spine/SpineFactory';
import { appendVersionToUrl } from '../../../config/version.config';

export interface PreloadConfig {
  textures?: Array<{ key: string; url: string }>;
  spritesheets?: SpritesheetConfig[];
  atlases?: Array<{ key: string; url: string }>;
  spine?: Array<{ key: string; jsonUrl: string; atlasUrl?: string; scale?: number }>;
  images?: Array<{ key: string; url: string }>;
  audio?: Array<{ key: string; url: string }>;
  fonts?: Array<{ family: string; url: string }>;
  json?: Array<{ key: string; url: string }>;
}

export interface PreloadProgress {
  loaded: number;
  total: number;
  percent: number;
  currentAsset: string;
  phase: 'textures' | 'atlases' | 'spine' | 'images' | 'spritesheets' | 'audio' | 'fonts' | 'json' | 'complete';
}

export interface PreloadOptions {
  continueOnError?: boolean;
  maxRetries?: number;
  useDefaultsOnFail?: boolean;
}

export interface GameManifestAsset {
  type: string;
  key: string;
  url: string;
  imageUrl?: string;
  dataUrl?: string;
  path?: string; // Support for path-based manifest
  atlasPath?: string;
  scale?: number;
}

export interface GameManifest {
  id: string;
  name: string;
  assets: {
    basePath: string;
    preload?: GameManifestAsset[]; // Old structure
    bundles?: Record<string, { assets: GameAssetManifestEntry[] }>; // Support for bundle structure
  };
}

// Map entries from your bundle-based JSON
interface GameAssetManifestEntry {
    type: string;
    key: string;
    path: string;
    atlasPath?: string;
    imagePath?: string;
    scale?: number;
}

export class AssetPreloader {
  private static instance: AssetPreloader | null = null;

  private eventBus: EventBus;
  private textureCache: TextureCache;
  private spritesheetLoader: SpritesheetLoader;
  private assetResolver: AssetResolver;
  private defaultAssets: DefaultAssets;
  private jsonCache: Map<string, unknown> = new Map();
  private audioCache: Map<string, string> = new Map();
  private spineCache: Map<string, { json: unknown; atlas?: string }> = new Map();
  private spineFactory: SpineFactory;
  private failedAssets: Set<string> = new Set();
  private isLoading: boolean = false;
  private aborted: boolean = false;
  private initialized: boolean = false;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.textureCache = TextureCache.getInstance();
    this.spritesheetLoader = SpritesheetLoader.getInstance();
    this.assetResolver = AssetResolver.getInstance();
    this.defaultAssets = DefaultAssets.getInstance();
    this.spineFactory = SpineFactory.getInstance();
  }

  public static getInstance(): AssetPreloader {
    if (!AssetPreloader.instance) {
      AssetPreloader.instance = new AssetPreloader();
    }
    return AssetPreloader.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.spineFactory.initialize();
    this.initialized = true;
    console.log('[AssetPreloader] Initialized');
  }

  public async preloadWithFallback(config: PreloadConfig, options: PreloadOptions = {}): Promise<void> {
    const { continueOnError = true, maxRetries = 2 } = options;
    if (this.isLoading) return;

    await this.initialize();
    this.isLoading = true;
    this.aborted = false;
    this.failedAssets.clear();

    const totalAssets = this.countAssets(config);
    let loadedAssets = 0;

    const updateProgress = (asset: string, phase: PreloadProgress['phase']) => {
      loadedAssets++;
      const progress: PreloadProgress = {
        loaded: loadedAssets,
        total: totalAssets,
        percent: (loadedAssets / totalAssets) * 100,
        currentAsset: asset,
        phase,
      };
      this.eventBus.emit('assets:load:progress', progress);
    };

    try {
      this.eventBus.emit('assets:load:start', { total: totalAssets });

      // 1. Textures/Images
      if (config.textures) {
        for (const tex of config.textures) {
          if (this.aborted) break;
          await this.loadWithRetry(() => this.textureCache.load(tex.key, tex.url), tex.key, maxRetries, continueOnError);
          updateProgress(tex.key, 'textures');
        }
      }
      if (config.images) {
        for (const img of config.images) {
          if (this.aborted) break;
          await this.loadWithRetry(() => this.textureCache.load(img.key, img.url), img.key, maxRetries, continueOnError);
          updateProgress(img.key, 'images');
        }
      }

      // 2. Atlases/Spritesheets
      if (config.atlases) {
        for (const atlas of config.atlases) {
          if (this.aborted) break;
          const imageUrl = atlas.url.replace('.json', '.png');
          await this.loadWithRetry(() => this.spritesheetLoader.load({ key: atlas.key, imageUrl, dataUrl: atlas.url }), atlas.key, maxRetries, continueOnError);
          updateProgress(atlas.key, 'atlases');
        }
      }
      if (config.spritesheets) {
        for (const sheet of config.spritesheets) {
          if (this.aborted) break;
          await this.loadWithRetry(() => this.spritesheetLoader.load(sheet), sheet.key, maxRetries, continueOnError);
          updateProgress(sheet.key, 'spritesheets');
        }
      }

      // 3. SPINE (Adopting Alias + Spine.from logic)
      if (config.spine) {
        for (const spine of config.spine) {
          if (this.aborted) break;
          const success = await this.loadWithRetry(() => this.loadSpineAsset(spine.key, spine.jsonUrl, spine.atlasUrl, spine.scale), spine.key, maxRetries, continueOnError);
          updateProgress(spine.key, 'spine');
        }
      }

      // 4. JSON
      if (config.json) {
        for (const json of config.json) {
          if (this.aborted) break;
          await this.loadWithRetry(() => this.loadJSON(json.key, json.url), json.key, maxRetries, continueOnError);
          updateProgress(json.key, 'json');
        }
      }

      // 5. Audio URLs
      if (config.audio) {
        for (const audio of config.audio) {
          if (this.aborted) break;
          this.audioCache.set(audio.key, audio.url);
          updateProgress(audio.key, 'audio');
        }
      }

      // 6. Fonts
      if (config.fonts) {
        for (const font of config.fonts) {
          if (this.aborted) break;
          await this.loadWithRetry(() => this.loadFont(font.family, font.url), font.family, maxRetries, continueOnError);
          updateProgress(font.family, 'fonts');
        }
      }

      this.eventBus.emit('assets:load:complete', { total: totalAssets });
    } catch (error) {
      this.eventBus.emit('assets:load:error', { error: (error as Error).message });
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  private async loadSpineAsset(key: string, jsonUrl: string, atlasUrl?: string, scale: number = 1): Promise<void> {
    this.spineFactory.registerSpineAsset(key, jsonUrl, atlasUrl || '');
    const loaded = await this.spineFactory.loadSpine(key, jsonUrl, atlasUrl, scale);
    if (!loaded) throw new Error(`Failed to load spine: ${key}`);
  }

  private async loadWithRetry(loadFn: () => Promise<any>, key: string, maxRetries: number, continueOnError: boolean): Promise<boolean> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await loadFn();
        return true;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) await this.delay(100 * (attempt + 1));
      }
    }
    this.failedAssets.add(key);
    if (!continueOnError) throw lastError;
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async loadGame(gameName: string): Promise<void> {
    this.assetResolver.setGameName(gameName);
    const manifestUrl = this.assetResolver.resolveManifest(gameName);
    try {
      const response = await fetch(appendVersionToUrl(manifestUrl));
      if (!response.ok) return;
      const manifest: any = await response.json();
      const config = this.manifestToConfig(manifest);
      await this.preloadWithFallback(config, { continueOnError: true });
    } catch (error) {
      console.warn(`[AssetPreloader] Could not load manifest:`, error);
    }
  }

  /**
   * Enhanced Manifest Parser supporting both legacy and bundle-based structures
   */
  private manifestToConfig(manifest: any): PreloadConfig {
    const config: PreloadConfig = {
      textures: [], images: [], atlases: [], spritesheets: [],
      spine: [], json: [], audio: [], fonts: [],
    };

    const basePath = manifest.basePath || manifest.assets?.basePath;

    // Handle Bundle Structure (from neon-nights)
    if (manifest.bundles) {
        Object.values(manifest.bundles).forEach((bundle: any) => {
            bundle.assets?.forEach((asset: any) => {
                const fullUrl = `${basePath}/${asset.path}`;
                switch (asset.type) {
                    case 'image': config.images!.push({ key: asset.key, url: fullUrl }); break;
                    case 'spine': config.spine!.push({ key: asset.key, jsonUrl: fullUrl, atlasUrl: asset.atlasPath ? `${basePath}/${asset.atlasPath}` : undefined, scale: asset.scale }); break;
                    case 'spritesheet':
                    case 'atlas':
                        config.spritesheets!.push({ 
                            key: asset.key, 
                            dataUrl: fullUrl, 
                            imageUrl: asset.imagePath ? `${basePath}/${asset.imagePath}` : fullUrl.replace('.json', '.png') 
                        });
                        break;
                    case 'audio': config.audio!.push({ key: asset.key, url: fullUrl }); break;
                    case 'font': config.fonts!.push({ family: asset.key, url: fullUrl }); break;
                }
            });
        });
    }

    // Handle Legacy Preload Array
    if (manifest.assets?.preload) {
      for (const asset of manifest.assets.preload) {
        const fullUrl = `${basePath}/${asset.url}`;
        switch (asset.type) {
          case 'texture':
          case 'image': config.images!.push({ key: asset.key, url: fullUrl }); break;
          case 'atlas': config.atlases!.push({ key: asset.key, url: fullUrl }); break;
          case 'spritesheet': config.spritesheets!.push({ key: asset.key, imageUrl: asset.imageUrl || fullUrl.replace('.json', '.png'), dataUrl: asset.dataUrl || fullUrl }); break;
          case 'spine': config.spine!.push({ key: asset.key, jsonUrl: fullUrl, atlasUrl: `${fullUrl.replace('.json', '')}.atlas` }); break;
          case 'json': config.json!.push({ key: asset.key, url: fullUrl }); break;
          case 'audio': config.audio!.push({ key: asset.key, url: fullUrl }); break;
          case 'font': config.fonts!.push({ family: asset.key, url: fullUrl }); break;
        }
      }
    }

    return config;
  }

  private async loadFont(family: string, url: string): Promise<void> {
    const font = new FontFace(family, `url(${url})`);
    await font.load();
    document.fonts.add(font);
  }

  private async loadJSON(key: string, url: string): Promise<unknown> {
    if (this.jsonCache.has(key)) return this.jsonCache.get(key);
    const response = await fetch(appendVersionToUrl(url));
    if (!response.ok) throw new Error(`Failed to load JSON: ${url}`);
    const data = await response.json();
    this.jsonCache.set(key, data);
    return data;
  }

  public getJSON<T>(key: string): T | null { return (this.jsonCache.get(key) as T) ?? null; }
  public getAudioUrl(key: string): string | null { return this.audioCache.get(key) ?? null; }
  public hasAssetFailed(key: string): boolean { return this.failedAssets.has(key); }
  public getFailedAssets(): string[] { return Array.from(this.failedAssets); }

  public hasLoadedAssets(): boolean {
    const textureStats = this.textureCache.getStats();
    const sheetStats = this.spritesheetLoader.getStats();
    const spineStats = this.spineFactory.getStats();
    return textureStats.totalTextures > 0 || sheetStats.totalFrames > 0 || spineStats.loaded > 0;
  }

  private countAssets(config: PreloadConfig): number {
    return (config.textures?.length || 0) + (config.images?.length || 0) + (config.atlases?.length || 0) + (config.spritesheets?.length || 0) + (config.spine?.length || 0) + (config.audio?.length || 0) + (config.fonts?.length || 0) + (config.json?.length || 0);
  }

  public clear(): void {
    this.jsonCache.clear();
    this.audioCache.clear();
    this.spineCache.clear();
    this.failedAssets.clear();
    this.textureCache.clear();
    this.spritesheetLoader.clear();
  }

  public static reset(): void {
    if (AssetPreloader.instance) {
      AssetPreloader.instance.clear();
      AssetPreloader.instance = null;
    }
  }
}