/**
 * ResizeObserverWrapper - Wrapper for ResizeObserver
 * Provides debounced resize handling.
 */

export type ResizeCallback = (width: number, height: number) => void;

/**
 * Debounced resize observer for container elements.
 */
export class ResizeObserverWrapper {
  private observer: ResizeObserver | null = null;
  private element: HTMLElement | null = null;
  private callback: ResizeCallback;
  private debounceMs: number;
  private debounceTimeout: number | null = null;

  constructor(callback: ResizeCallback, debounceMs: number = 16) {
    this.callback = callback;
    this.debounceMs = debounceMs;
  }

  /** Start observing an element */
  public observe(element: HTMLElement): void {
    this.element = element;

    this.observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.handleResize(width, height);
      }
    });

    this.observer.observe(element);
  }

  /** Handle resize with debounce */
  private handleResize(width: number, height: number): void {
    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = window.setTimeout(() => {
      this.callback(width, height);
      this.debounceTimeout = null;
    }, this.debounceMs);
  }

  /** Stop observing */
  public disconnect(): void {
    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout);
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.element = null;
  }
}
