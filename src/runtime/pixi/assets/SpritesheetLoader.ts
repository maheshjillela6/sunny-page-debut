/**
 * SpritesheetLoader - Load and parse spritesheet atlases (TexturePacker format)
 * Handles JSON atlas data with frame definitions
 */

import { Assets, Spritesheet, Texture, SpritesheetData } from 'pixi.js';
import { TextureCache } from './TextureCache';
import { EventBus } from '../../../platform/events/EventBus';
import { appendVersionToUrl } from '../../../config/version.config';

export interface SpritesheetConfig {
  key: string;
  imageUrl: string;
  dataUrl: string;
}

export interface SpritesheetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpritesheetFrameData {
  frame: SpritesheetFrame;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

export interface TexturePackerData {
  frames: Record<string, SpritesheetFrameData>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
  };
}

export interface SpritesheetEntry {
  spritesheet: Spritesheet | null;
  frames: Map<string, Texture>;
  baseTexture: Texture | null;
  data: TexturePackerData | null;
}

export class SpritesheetLoader {
  private static instance: SpritesheetLoader | null = null;
  
  private spritesheets: Map<string, SpritesheetEntry> = new Map();
  private textureCache: TextureCache;
  private eventBus: EventBus;

  private constructor() {
    this.textureCache = TextureCache.getInstance();
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): SpritesheetLoader {
    if (!SpritesheetLoader.instance) {
      SpritesheetLoader.instance = new SpritesheetLoader();
    }
    return SpritesheetLoader.instance;
  }

  /**
   * Load a spritesheet from URL (supports TexturePacker JSON format)
   */
  public async load(config: SpritesheetConfig): Promise<SpritesheetEntry> {
    if (this.spritesheets.has(config.key)) {
      return this.spritesheets.get(config.key)!;
    }

    try {
      console.log(`[SpritesheetLoader] Loading: ${config.key}`);
      console.log(`[SpritesheetLoader] Image URL: ${config.imageUrl}`);
      console.log(`[SpritesheetLoader] Data URL: ${config.dataUrl}`);

      // Load the JSON data first
      const response = await fetch(appendVersionToUrl(config.dataUrl));
      if (!response.ok) {
        throw new Error(`Failed to fetch spritesheet data: ${config.dataUrl} (${response.status})`);
      }
      
      const atlasData = await response.json() as TexturePackerData;
      
      // Determine image URL - either from config or from JSON meta
      let imageUrl = config.imageUrl;
      if (atlasData.meta?.image && !config.imageUrl) {
        // Derive image URL from the same directory as the JSON
        const basePath = config.dataUrl.substring(0, config.dataUrl.lastIndexOf('/'));
        imageUrl = `${basePath}/${atlasData.meta.image}`;
      }

      console.log(`[SpritesheetLoader] Loading base texture: ${imageUrl}`);

      // Load the base texture
      let baseTexture: Texture;
      try {
        baseTexture = await Assets.load<Texture>(imageUrl);
      } catch (texError) {
        console.warn(`[SpritesheetLoader] Failed to load base texture: ${imageUrl}`, texError);
        // Return empty entry - will use fallbacks
        const emptyEntry: SpritesheetEntry = {
          spritesheet: null,
          frames: new Map(),
          baseTexture: null,
          data: atlasData,
        };
        this.spritesheets.set(config.key, emptyEntry);
        return emptyEntry;
      }

      // Convert TexturePacker format to PixiJS SpritesheetData format
      const pixiSheetData = this.convertToPixiFormat(atlasData, baseTexture);

      // Create and parse spritesheet
      const spritesheet = new Spritesheet(baseTexture, pixiSheetData);
      await spritesheet.parse();

      // Extract frames into our cache
      const frames = new Map<string, Texture>();
      for (const frameName of Object.keys(spritesheet.textures)) {
        const texture = spritesheet.textures[frameName];
        frames.set(frameName, texture);
        
        // Also cache in TextureCache for easy lookup
        this.textureCache.cacheTexture(`${config.key}:${frameName}`, texture);
        
        // Cache with symbol_ prefix for symbol lookups
        this.textureCache.cacheTexture(`symbol_${frameName}`, texture);
      }

      const entry: SpritesheetEntry = {
        spritesheet,
        frames,
        baseTexture,
        data: atlasData,
      };

      this.spritesheets.set(config.key, entry);
      
      console.log(`[SpritesheetLoader] Loaded: ${config.key} with ${frames.size} frames`);
      console.log(`[SpritesheetLoader] Frame names: ${Array.from(frames.keys()).slice(0, 10).join(', ')}...`);

      return entry;
    } catch (error) {
      console.error(`[SpritesheetLoader] Failed to load: ${config.key}`, error);
      
      // Return empty entry so game can still load with fallbacks
      const emptyEntry: SpritesheetEntry = {
        spritesheet: null,
        frames: new Map(),
        baseTexture: null,
        data: null,
      };
      this.spritesheets.set(config.key, emptyEntry);
      
      throw error;
    }
  }

  /**
   * Convert TexturePacker JSON to PixiJS SpritesheetData format
   */
  private convertToPixiFormat(data: TexturePackerData, baseTexture: Texture): SpritesheetData {
    const frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; rotated?: boolean; trimmed?: boolean; spriteSourceSize?: { x: number; y: number; w: number; h: number }; sourceSize?: { w: number; h: number } }> = {};

    for (const [name, frameData] of Object.entries(data.frames)) {
      frames[name] = {
        frame: {
          x: frameData.frame.x,
          y: frameData.frame.y,
          w: frameData.frame.w,
          h: frameData.frame.h,
        },
        rotated: frameData.rotated,
        trimmed: frameData.trimmed,
        spriteSourceSize: frameData.spriteSourceSize,
        sourceSize: frameData.sourceSize,
      };
    }

    return {
      frames,
      meta: {
        scale: parseFloat(data.meta.scale) || 1,
      },
    } as SpritesheetData;
  }

  /**
   * Get a specific frame from a spritesheet
   */
  public getFrame(sheetKey: string, frameName: string): Texture | null {
    const entry = this.spritesheets.get(sheetKey);
    if (!entry || !entry.frames) {
      return null;
    }

    const frame = entry.frames.get(frameName);
    if (!frame) {
      // Try lowercase
      const lowercaseFrame = entry.frames.get(frameName.toLowerCase());
      if (lowercaseFrame) return lowercaseFrame;
      
      return null;
    }

    return frame;
  }

  /**
   * Get frame by symbol ID (tries multiple naming conventions)
   */
  public getSymbolFrame(symbolId: string): Texture | null {
    // Search all spritesheets for this symbol
    for (const [sheetKey, entry] of this.spritesheets) {
      if (!entry.frames) continue;
      
      // Try exact match
      if (entry.frames.has(symbolId)) {
        return entry.frames.get(symbolId)!;
      }
      
      // Try lowercase
      if (entry.frames.has(symbolId.toLowerCase())) {
        return entry.frames.get(symbolId.toLowerCase())!;
      }
      
      // Try uppercase
      if (entry.frames.has(symbolId.toUpperCase())) {
        return entry.frames.get(symbolId.toUpperCase())!;
      }
      
      // Try with symbol_ prefix
      const prefixed = `symbol_${symbolId.toLowerCase()}`;
      if (entry.frames.has(prefixed)) {
        return entry.frames.get(prefixed)!;
      }
    }
    
    return null;
  }

  /**
   * Get all frame names from a spritesheet
   */
  public getFrameNames(sheetKey: string): string[] {
    const entry = this.spritesheets.get(sheetKey);
    if (!entry || !entry.frames) return [];
    return Array.from(entry.frames.keys());
  }

  /**
   * Get all frames from a spritesheet
   */
  public getFrames(sheetKey: string): Map<string, Texture> | null {
    const entry = this.spritesheets.get(sheetKey);
    return entry?.frames ?? null;
  }

  /**
   * Check if spritesheet is loaded
   */
  public has(key: string): boolean {
    const entry = this.spritesheets.get(key);
    return entry !== undefined && entry.frames.size > 0;
  }

  /**
   * Check if a specific frame exists in any loaded spritesheet
   */
  public hasFrame(frameName: string): boolean {
    return this.getSymbolFrame(frameName) !== null;
  }

  /**
   * Get all loaded spritesheets
   */
  public getLoadedSheets(): string[] {
    return Array.from(this.spritesheets.keys()).filter(key => {
      const entry = this.spritesheets.get(key);
      return entry && entry.frames.size > 0;
    });
  }

  /**
   * Unload a spritesheet
   */
  public unload(key: string): void {
    const entry = this.spritesheets.get(key);
    if (entry) {
      if (entry.spritesheet) {
        entry.spritesheet.destroy(true);
      }
      this.spritesheets.delete(key);
      console.log(`[SpritesheetLoader] Unloaded: ${key}`);
    }
  }

  /**
   * Clear all spritesheets
   */
  public clear(): void {
    for (const [key, entry] of this.spritesheets) {
      if (entry.spritesheet) {
        entry.spritesheet.destroy(true);
      }
    }
    this.spritesheets.clear();
    console.log('[SpritesheetLoader] Cleared all spritesheets');
  }

  /**
   * Get statistics
   */
  public getStats(): { sheetCount: number; totalFrames: number } {
    let totalFrames = 0;
    for (const entry of this.spritesheets.values()) {
      totalFrames += entry.frames.size;
    }
    return {
      sheetCount: this.spritesheets.size,
      totalFrames,
    };
  }

  public static reset(): void {
    if (SpritesheetLoader.instance) {
      SpritesheetLoader.instance.clear();
      SpritesheetLoader.instance = null;
    }
  }
}
