/**
 * DPRResolver - Device Pixel Ratio resolution
 */

/**
 * Resolves and manages device pixel ratio.
 */
export class DPRResolver {
  private static cachedDPR: number | null = null;
  private static maxDPR: number = 3;

  /**
   * Get the effective device pixel ratio
   */
  public static getDPR(): number {
    if (this.cachedDPR !== null) {
      return this.cachedDPR;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDPR);
    this.cachedDPR = dpr;
    return dpr;
  }

  /**
   * Set maximum allowed DPR
   */
  public static setMaxDPR(max: number): void {
    this.maxDPR = max;
    this.cachedDPR = null; // Reset cache
  }

  /**
   * Get raw device pixel ratio (uncapped)
   */
  public static getRawDPR(): number {
    return window.devicePixelRatio || 1;
  }

  /**
   * Check if device is high DPI
   */
  public static isHighDPI(): boolean {
    return this.getRawDPR() > 1;
  }

  /**
   * Clear cached DPR
   */
  public static clearCache(): void {
    this.cachedDPR = null;
  }

  /**
   * Calculate optimal resolution for canvas
   */
  public static getOptimalResolution(maxResolution: number = 2): number {
    return Math.min(this.getDPR(), maxResolution);
  }
}
