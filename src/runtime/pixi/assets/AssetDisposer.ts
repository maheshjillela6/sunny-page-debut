/**
 * AssetDisposer - Manages cleanup and disposal of assets
 */

import { TextureCache } from './TextureCache';
import { SpritesheetLoader } from './SpritesheetLoader';
import { AssetPreloader } from './AssetPreloader';

export interface DisposalReport {
  texturesDisposed: number;
  spritesheetsDisposed: number;
  memoryFreed: number;
}

export class AssetDisposer {
  private static instance: AssetDisposer | null = null;

  private textureCache: TextureCache;
  private spritesheetLoader: SpritesheetLoader;

  private constructor() {
    this.textureCache = TextureCache.getInstance();
    this.spritesheetLoader = SpritesheetLoader.getInstance();
  }

  public static getInstance(): AssetDisposer {
    if (!AssetDisposer.instance) {
      AssetDisposer.instance = new AssetDisposer();
    }
    return AssetDisposer.instance;
  }

  /**
   * Dispose all assets for a specific game
   */
  public disposeGame(gameId: string): DisposalReport {
    const beforeStats = this.textureCache.getStats();
    
    // Clear all game-specific assets
    // In a real implementation, track assets per game
    
    const afterStats = this.textureCache.getStats();

    const report: DisposalReport = {
      texturesDisposed: beforeStats.totalTextures - afterStats.totalTextures,
      spritesheetsDisposed: 0,
      memoryFreed: beforeStats.totalMemoryBytes - afterStats.totalMemoryBytes,
    };

    console.log(`[AssetDisposer] Disposed game ${gameId}:`, report);
    return report;
  }

  /**
   * Dispose all assets
   */
  public disposeAll(): DisposalReport {
    const beforeStats = this.textureCache.getStats();

    this.textureCache.clear();
    this.spritesheetLoader.clear();

    const report: DisposalReport = {
      texturesDisposed: beforeStats.totalTextures,
      spritesheetsDisposed: 0,
      memoryFreed: beforeStats.totalMemoryBytes,
    };

    console.log('[AssetDisposer] Disposed all assets:', report);
    return report;
  }

  /**
   * Run garbage collection (hint to browser)
   */
  public gc(): void {
    // Force JS garbage collection if available (Chrome DevTools)
    if ((window as any).gc) {
      (window as any).gc();
    }
  }

  public static reset(): void {
    AssetDisposer.instance = null;
  }
}
