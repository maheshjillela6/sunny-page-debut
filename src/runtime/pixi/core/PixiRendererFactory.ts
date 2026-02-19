/**
 * PixiRendererFactory - Factory for creating Pixi applications
 * Handles WebGL context creation with fallbacks.
 */

import { Application, ApplicationOptions } from 'pixi.js';

export interface RendererConfig {
  backgroundColor?: number;
  resolution?: number;
  antialias?: boolean;
  powerPreference?: 'high-performance' | 'low-power' | 'default';
  autoDensity?: boolean;
}

/**
 * Factory for creating PixiJS applications with optimal settings.
 */
export class PixiRendererFactory {
  /**
   * Create a new Pixi Application with optimal settings
   */
  public static async createApplication(config: RendererConfig): Promise<Application> {
    const app = new Application();

    const powerPref = config.powerPreference === 'default' 
      ? undefined 
      : config.powerPreference ?? 'high-performance';

    const options: Partial<ApplicationOptions> = {
      backgroundColor: config.backgroundColor ?? 0x0a0e14,
      resolution: config.resolution ?? window.devicePixelRatio,
      antialias: config.antialias ?? true,
      autoDensity: config.autoDensity ?? true,
      powerPreference: powerPref as 'high-performance' | 'low-power' | undefined,
      preference: 'webgl',
    };

    try {
      await app.init(options);
      (globalThis as any).__PIXI_APP__ = app;
      console.log('[PixiRendererFactory] Application created successfully');
      console.log(`[PixiRendererFactory] Renderer: ${app.renderer.type}`);
      console.log(`[PixiRendererFactory] Resolution: ${app.renderer.resolution}`);
    } catch (error) {
      console.error('[PixiRendererFactory] Failed to create application:', error);
      throw error;
    }

    return app;
  }

  /**
   * Check WebGL support
   */
  public static checkWebGLSupport(): { supported: boolean; version: number } {
    const canvas = document.createElement('canvas');
    
    // Try WebGL2 first
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      return { supported: true, version: 2 };
    }

    // Fallback to WebGL1
    const gl1 = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl1) {
      return { supported: true, version: 1 };
    }

    return { supported: false, version: 0 };
  }

  /**
   * Get recommended settings based on device capabilities
   */
  public static getRecommendedSettings(): RendererConfig {
    const webgl = this.checkWebGLSupport();
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    return {
      resolution: Math.min(window.devicePixelRatio, isMobile ? 2 : 3),
      antialias: !isMobile && webgl.version >= 2,
      powerPreference: isMobile ? 'low-power' : 'high-performance',
      autoDensity: true,
    };
  }
}
