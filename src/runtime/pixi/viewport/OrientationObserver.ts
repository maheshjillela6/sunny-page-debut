/**
 * OrientationObserver - Monitors device orientation changes
 */

export type Orientation = 'landscape' | 'portrait';
export type OrientationCallback = (orientation: Orientation) => void;

/**
 * Observes and reports device orientation changes.
 */
export class OrientationObserver {
  private static instance: OrientationObserver | null = null;

  private currentOrientation: Orientation = 'landscape';
  private listeners: Set<OrientationCallback> = new Set();
  private mediaQuery: MediaQueryList | null = null;

  private constructor() {
    this.setupOrientationListener();
    this.updateOrientation();
  }

  /** Get singleton instance */
  public static getInstance(): OrientationObserver {
    if (!OrientationObserver.instance) {
      OrientationObserver.instance = new OrientationObserver();
    }
    return OrientationObserver.instance;
  }

  /** Setup orientation change listener */
  private setupOrientationListener(): void {
    if (typeof window === 'undefined') return;

    // Use matchMedia for orientation detection
    this.mediaQuery = window.matchMedia('(orientation: landscape)');
    this.mediaQuery.addEventListener('change', this.handleOrientationChange.bind(this));

    // Also listen to resize as fallback
    window.addEventListener('resize', this.updateOrientation.bind(this));
  }

  /** Handle orientation change event */
  private handleOrientationChange(event: MediaQueryListEvent): void {
    const newOrientation: Orientation = event.matches ? 'landscape' : 'portrait';
    if (newOrientation !== this.currentOrientation) {
      this.currentOrientation = newOrientation;
      this.notifyListeners();
    }
  }

  /** Update orientation from window dimensions */
  private updateOrientation(): void {
    const newOrientation: Orientation = 
      window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
    
    if (newOrientation !== this.currentOrientation) {
      this.currentOrientation = newOrientation;
      this.notifyListeners();
    }
  }

  /** Get current orientation */
  public getOrientation(): Orientation {
    return this.currentOrientation;
  }

  /** Check if landscape */
  public isLandscape(): boolean {
    return this.currentOrientation === 'landscape';
  }

  /** Check if portrait */
  public isPortrait(): boolean {
    return this.currentOrientation === 'portrait';
  }

  /** Add orientation change listener */
  public addListener(callback: OrientationCallback): void {
    this.listeners.add(callback);
  }

  /** Remove orientation change listener */
  public removeListener(callback: OrientationCallback): void {
    this.listeners.delete(callback);
  }

  /** Notify all listeners */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentOrientation);
    }
  }

  /** Cleanup listeners */
  public destroy(): void {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleOrientationChange.bind(this));
    }
    window.removeEventListener('resize', this.updateOrientation.bind(this));
    this.listeners.clear();
    OrientationObserver.instance = null;
  }
}
