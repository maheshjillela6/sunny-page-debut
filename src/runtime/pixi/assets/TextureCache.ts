/**
 * TextureCache - Centralized texture caching with memory management
 * Supports both async loading and synchronous caching of already-loaded textures
 */

import { Texture, Assets } from 'pixi.js';
import { EventBus } from '../../../platform/events/EventBus';

export interface TextureCacheEntry {
  texture: Texture;
  refCount: number;
  lastAccess: number;
  size: number;
  source: string;
}

export interface TextureCacheStats {
  totalTextures: number;
  totalMemoryBytes: number;
  hitRate: number;
  missRate: number;
}

export class TextureCache {
  private static instance: TextureCache | null = null;
  
  private cache: Map<string, TextureCacheEntry> = new Map();
  private eventBus: EventBus;
  private hits: number = 0;
  private misses: number = 0;
  private maxMemoryBytes: number = 256 * 1024 * 1024; // 256MB default

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): TextureCache {
    if (!TextureCache.instance) {
      TextureCache.instance = new TextureCache();
    }
    return TextureCache.instance;
  }

  /**
   * Get texture from cache or load it
   */
  public async get(key: string, source?: string): Promise<Texture | null> {
    const entry = this.cache.get(key);
    
    if (entry) {
      entry.refCount++;
      entry.lastAccess = Date.now();
      this.hits++;
      return entry.texture;
    }

    this.misses++;

    if (source) {
      return this.load(key, source);
    }

    return null;
  }

  /**
   * Load and cache a texture from URL
   */
  public async load(key: string, source: string): Promise<Texture> {
    // Check if already cached
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.refCount++;
      entry.lastAccess = Date.now();
      this.hits++;
      return entry.texture;
    }

    try {
      const texture = await Assets.load<Texture>(source);
      
      const entry: TextureCacheEntry = {
        texture,
        refCount: 1,
        lastAccess: Date.now(),
        size: this.estimateTextureSize(texture),
        source,
      };

      this.cache.set(key, entry);
      this.checkMemoryLimit();

      console.log(`[TextureCache] Loaded: ${key} (${this.formatBytes(entry.size)})`);

      return texture;
    } catch (error) {
      console.error(`[TextureCache] Failed to load: ${key}`, error);
      throw error;
    }
  }

  /**
   * Cache an already-loaded texture (synchronous)
   * Used by SpritesheetLoader to cache individual frames
   */
  public cacheTexture(key: string, texture: Texture, source: string = ''): void {
    if (this.cache.has(key)) {
      // Already cached, just increment ref count
      const entry = this.cache.get(key)!;
      entry.refCount++;
      entry.lastAccess = Date.now();
      return;
    }

    const entry: TextureCacheEntry = {
      texture,
      refCount: 1,
      lastAccess: Date.now(),
      size: this.estimateTextureSize(texture),
      source,
    };

    this.cache.set(key, entry);
  }

  /**
   * Preload multiple textures
   */
  public async preload(assets: Array<{ key: string; source: string }>): Promise<void> {
    const promises = assets.map(({ key, source }) => this.load(key, source));
    await Promise.all(promises);
  }

  /**
   * Get texture synchronously (returns null if not cached)
   */
  public getSync(key: string): Texture | null {
    const entry = this.cache.get(key);
    if (entry) {
      entry.refCount++;
      entry.lastAccess = Date.now();
      this.hits++;
      return entry.texture;
    }
    this.misses++;
    return null;
  }

  /**
   * Get texture by trying multiple key patterns
   */
  public getWithFallback(primaryKey: string, ...fallbackKeys: string[]): Texture | null {
    // Try primary key
    let texture = this.getSync(primaryKey);
    if (texture) return texture;

    // Try fallback keys
    for (const key of fallbackKeys) {
      texture = this.getSync(key);
      if (texture) return texture;
    }

    return null;
  }

  /**
   * Get symbol texture by trying various naming conventions
   */
  public getSymbolTexture(symbolId: string): Texture | null {
    const keysToTry = [
      `symbol_${symbolId}`,
      `symbol_${symbolId.toLowerCase()}`,
      `symbol_${symbolId.toUpperCase()}`,
      symbolId,
      symbolId.toLowerCase(),
      symbolId.toUpperCase(),
      `symbols_atlas:${symbolId}`,
      `symbols_atlas:${symbolId.toLowerCase()}`,
    ];

    for (const key of keysToTry) {
      const texture = this.getSync(key);
      if (texture) {
        return texture;
      }
    }

    return null;
  }

  /**
   * Check if texture exists in cache
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all cached texture keys
   */
  public getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Release a texture reference
   */
  public release(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.refCount--;
      if (entry.refCount <= 0) {
        // Mark for potential cleanup but don't delete immediately
        entry.lastAccess = 0;
      }
    }
  }

  /**
   * Force remove a texture from cache
   */
  public remove(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.texture.destroy(true);
      this.cache.delete(key);
    }
  }

  /**
   * Clear all textures from cache
   */
  public clear(): void {
    for (const [key, entry] of this.cache) {
      entry.texture.destroy(true);
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log('[TextureCache] Cleared all textures');
  }

  /**
   * Get cache statistics
   */
  public getStats(): TextureCacheStats {
    let totalMemory = 0;
    for (const entry of this.cache.values()) {
      totalMemory += entry.size;
    }

    const totalRequests = this.hits + this.misses;
    
    return {
      totalTextures: this.cache.size,
      totalMemoryBytes: totalMemory,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
    };
  }

  /**
   * Set maximum memory limit
   */
  public setMaxMemory(bytes: number): void {
    this.maxMemoryBytes = bytes;
    this.checkMemoryLimit();
  }

  /**
   * Estimate texture memory size
   */
  private estimateTextureSize(texture: Texture): number {
    const width = texture.width || 1;
    const height = texture.height || 1;
    return width * height * 4; // RGBA 4 bytes per pixel
  }

  /**
   * Check and enforce memory limit
   */
  private checkMemoryLimit(): void {
    const stats = this.getStats();
    
    if (stats.totalMemoryBytes > this.maxMemoryBytes) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used textures
   */
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries())
      .filter(([_, entry]) => entry.refCount <= 0)
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const targetBytes = this.maxMemoryBytes * 0.8;
    let currentBytes = this.getStats().totalMemoryBytes;

    for (const [key, entry] of entries) {
      if (currentBytes <= targetBytes) break;
      
      this.remove(key);
      currentBytes -= entry.size;
      console.log(`[TextureCache] Evicted: ${key}`);
    }
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  public static reset(): void {
    if (TextureCache.instance) {
      TextureCache.instance.clear();
      TextureCache.instance = null;
    }
  }
}
