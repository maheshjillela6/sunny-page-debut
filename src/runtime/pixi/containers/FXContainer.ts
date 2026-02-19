/**
 * FXContainer - Container for visual effects
 */

import { BaseContainer, ContainerConfig } from './BaseContainer';
import { BlurFilter, ColorMatrixFilter } from 'pixi.js';

export interface FXConfig extends ContainerConfig {
  blurEnabled?: boolean;
  blurStrength?: number;
  colorMatrix?: boolean;
}

/**
 * Container with built-in visual effect capabilities.
 */
export class FXContainer extends BaseContainer {
  private blurFilter: BlurFilter | null = null;
  private colorMatrixFilter: ColorMatrixFilter | null = null;
  private fxConfig: FXConfig;

  constructor(config: FXConfig = {}) {
    super(config);
    this.fxConfig = config;

    if (config.blurEnabled) {
      this.enableBlur(config.blurStrength ?? 4);
    }

    if (config.colorMatrix) {
      this.enableColorMatrix();
    }
  }

  /** Enable blur effect */
  public enableBlur(strength: number = 4): void {
    if (!this.blurFilter) {
      this.blurFilter = new BlurFilter();
      this.updateFilters();
    }
    this.blurFilter.blur = strength;
  }

  /** Disable blur effect */
  public disableBlur(): void {
    this.blurFilter = null;
    this.updateFilters();
  }

  /** Set blur strength */
  public setBlur(strength: number): void {
    if (this.blurFilter) {
      this.blurFilter.blur = strength;
    }
  }

  /** Enable color matrix filter */
  public enableColorMatrix(): void {
    if (!this.colorMatrixFilter) {
      this.colorMatrixFilter = new ColorMatrixFilter();
      this.updateFilters();
    }
  }

  /** Set brightness */
  public setBrightness(value: number): void {
    if (this.colorMatrixFilter) {
      this.colorMatrixFilter.brightness(value, false);
    }
  }

  /** Set saturation */
  public setSaturation(value: number): void {
    if (this.colorMatrixFilter) {
      this.colorMatrixFilter.saturate(value, false);
    }
  }

  /** Set contrast */
  public setContrast(value: number): void {
    if (this.colorMatrixFilter) {
      this.colorMatrixFilter.contrast(value, false);
    }
  }

  /** Apply grayscale */
  public setGrayscale(value: number): void {
    if (this.colorMatrixFilter) {
      this.colorMatrixFilter.greyscale(value, false);
    }
  }

  /** Reset color matrix */
  public resetColorMatrix(): void {
    if (this.colorMatrixFilter) {
      this.colorMatrixFilter.reset();
    }
  }

  /** Update filters array */
  private updateFilters(): void {
    const filters = [];
    if (this.blurFilter) filters.push(this.blurFilter);
    if (this.colorMatrixFilter) filters.push(this.colorMatrixFilter);
    this.filters = filters.length > 0 ? filters : null;
  }

  /** Destroy FX container */
  public override destroy(): void {
    this.blurFilter = null;
    this.colorMatrixFilter = null;
    this.filters = null;
    super.destroy();
  }
}
