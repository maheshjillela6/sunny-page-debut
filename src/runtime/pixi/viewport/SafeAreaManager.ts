/**
 * SafeAreaManager - Manages content safe areas
 * Handles notch, status bar, and navigation bar insets.
 */

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Manages safe area calculations for content placement.
 */
export class SafeAreaManager {
  private static instance: SafeAreaManager | null = null;
  private insets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };

  private constructor() {
    this.detectSafeAreaInsets();
  }

  /** Get singleton instance */
  public static getInstance(): SafeAreaManager {
    if (!SafeAreaManager.instance) {
      SafeAreaManager.instance = new SafeAreaManager();
    }
    return SafeAreaManager.instance;
  }

  /** Detect safe area insets from CSS environment variables */
  private detectSafeAreaInsets(): void {
    if (typeof window === 'undefined') return;

    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.right = '0';
    div.style.bottom = '0';
    div.style.paddingTop = 'env(safe-area-inset-top)';
    div.style.paddingBottom = 'env(safe-area-inset-bottom)';
    div.style.paddingLeft = 'env(safe-area-inset-left)';
    div.style.paddingRight = 'env(safe-area-inset-right)';
    div.style.visibility = 'hidden';
    div.style.pointerEvents = 'none';
    
    document.body.appendChild(div);
    const computed = getComputedStyle(div);

    this.insets = {
      top: parseFloat(computed.paddingTop) || 0,
      bottom: parseFloat(computed.paddingBottom) || 0,
      left: parseFloat(computed.paddingLeft) || 0,
      right: parseFloat(computed.paddingRight) || 0,
    };

    document.body.removeChild(div);
  }

  /** Get current safe area insets */
  public getInsets(): SafeAreaInsets {
    return { ...this.insets };
  }

  /** Update insets manually */
  public setInsets(insets: Partial<SafeAreaInsets>): void {
    this.insets = { ...this.insets, ...insets };
  }

  /** Refresh insets detection */
  public refresh(): void {
    this.detectSafeAreaInsets();
  }

  /** Check if device has notch */
  public hasNotch(): boolean {
    return this.insets.top > 20 || this.insets.left > 0 || this.insets.right > 0;
  }
}
