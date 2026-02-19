/**
 * PixiMemoryTracker - Memory usage tracking
 * Tracks texture memory and container counts.
 */

import { Container, Texture, Assets } from 'pixi.js';

export interface MemoryStats {
  textureCount: number;
  totalTextureMemory: number;
  containerCount: number;
  spriteCount: number;
  graphicsCount: number;
}

/**
 * Tracks memory usage of Pixi resources.
 */
export class PixiMemoryTracker {
  private static instance: PixiMemoryTracker | null = null;

  private constructor() {}

  /** Get singleton instance */
  public static getInstance(): PixiMemoryTracker {
    if (!PixiMemoryTracker.instance) {
      PixiMemoryTracker.instance = new PixiMemoryTracker();
    }
    return PixiMemoryTracker.instance;
  }

  /** Count containers recursively */
  public countContainers(root: Container): {
    containers: number;
    sprites: number;
    graphics: number;
  } {
    let containers = 0;
    let sprites = 0;
    let graphics = 0;

    const traverse = (node: Container) => {
      containers++;
      
      for (const child of node.children) {
        if (child instanceof Container) {
          traverse(child);
        }
      }
    };

    traverse(root);
    return { containers, sprites, graphics };
  }

  /** Get memory statistics */
  public getStats(root?: Container): MemoryStats {
    const counts = root 
      ? this.countContainers(root) 
      : { containers: 0, sprites: 0, graphics: 0 };

    // Get texture cache stats from Assets
    const textureCount = 0; // Assets cache tracking would go here
    const totalTextureMemory = 0;

    return {
      textureCount,
      totalTextureMemory,
      containerCount: counts.containers,
      spriteCount: counts.sprites,
      graphicsCount: counts.graphics,
    };
  }

  /** Estimate texture memory in bytes */
  public estimateTextureMemory(texture: Texture): number {
    const width = texture.width;
    const height = texture.height;
    // Assume RGBA (4 bytes per pixel)
    return width * height * 4;
  }

  /** Format bytes to human readable string */
  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
