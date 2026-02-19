/**
 * AspectScaler - Handles aspect ratio calculations
 */

export type ScaleMode = 'contain' | 'cover' | 'stretch';

export interface AspectScaleResult {
  scale: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/**
 * Calculates scaling factors for different aspect ratios.
 */
export class AspectScaler {
  /**
   * Calculate scale to fit content within bounds
   */
  public static contain(
    contentWidth: number,
    contentHeight: number,
    boundsWidth: number,
    boundsHeight: number
  ): AspectScaleResult {
    const scaleX = boundsWidth / contentWidth;
    const scaleY = boundsHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY);

    const width = contentWidth * scale;
    const height = contentHeight * scale;
    const offsetX = (boundsWidth - width) / 2;
    const offsetY = (boundsHeight - height) / 2;

    return { scale, scaleX: scale, scaleY: scale, offsetX, offsetY, width, height };
  }

  /**
   * Calculate scale to cover bounds (may crop)
   */
  public static cover(
    contentWidth: number,
    contentHeight: number,
    boundsWidth: number,
    boundsHeight: number
  ): AspectScaleResult {
    const scaleX = boundsWidth / contentWidth;
    const scaleY = boundsHeight / contentHeight;
    const scale = Math.max(scaleX, scaleY);

    const width = contentWidth * scale;
    const height = contentHeight * scale;
    const offsetX = (boundsWidth - width) / 2;
    const offsetY = (boundsHeight - height) / 2;

    return { scale, scaleX: scale, scaleY: scale, offsetX, offsetY, width, height };
  }

  /**
   * Calculate stretch scale (distorts aspect ratio)
   */
  public static stretch(
    contentWidth: number,
    contentHeight: number,
    boundsWidth: number,
    boundsHeight: number
  ): AspectScaleResult {
    const scaleX = boundsWidth / contentWidth;
    const scaleY = boundsHeight / contentHeight;

    return {
      scale: Math.min(scaleX, scaleY),
      scaleX,
      scaleY,
      offsetX: 0,
      offsetY: 0,
      width: boundsWidth,
      height: boundsHeight,
    };
  }

  /**
   * Calculate scale based on mode
   */
  public static calculate(
    mode: ScaleMode,
    contentWidth: number,
    contentHeight: number,
    boundsWidth: number,
    boundsHeight: number
  ): AspectScaleResult {
    switch (mode) {
      case 'contain':
        return this.contain(contentWidth, contentHeight, boundsWidth, boundsHeight);
      case 'cover':
        return this.cover(contentWidth, contentHeight, boundsWidth, boundsHeight);
      case 'stretch':
        return this.stretch(contentWidth, contentHeight, boundsWidth, boundsHeight);
    }
  }
}
