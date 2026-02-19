/**
 * LetterboxCalculator - Calculates letterbox dimensions
 */

export interface LetterboxDimensions {
  hasLetterbox: boolean;
  hasHorizontalBars: boolean;
  hasVerticalBars: boolean;
  top: { x: number; y: number; width: number; height: number };
  bottom: { x: number; y: number; width: number; height: number };
  left: { x: number; y: number; width: number; height: number };
  right: { x: number; y: number; width: number; height: number };
}

/**
 * Calculates letterbox bar dimensions for aspect ratio preservation.
 */
export class LetterboxCalculator {
  /**
   * Calculate letterbox bar dimensions
   */
  public static calculate(
    screenWidth: number,
    screenHeight: number,
    gameWidth: number,
    gameHeight: number,
    offsetX: number,
    offsetY: number
  ): LetterboxDimensions {
    const hasHorizontalBars = offsetY > 0;
    const hasVerticalBars = offsetX > 0;
    const hasLetterbox = hasHorizontalBars || hasVerticalBars;

    return {
      hasLetterbox,
      hasHorizontalBars,
      hasVerticalBars,
      top: {
        x: 0,
        y: 0,
        width: screenWidth,
        height: Math.max(0, offsetY),
      },
      bottom: {
        x: 0,
        y: offsetY + gameHeight,
        width: screenWidth,
        height: Math.max(0, offsetY),
      },
      left: {
        x: 0,
        y: 0,
        width: Math.max(0, offsetX),
        height: screenHeight,
      },
      right: {
        x: offsetX + gameWidth,
        y: 0,
        width: Math.max(0, offsetX),
        height: screenHeight,
      },
    };
  }
}
