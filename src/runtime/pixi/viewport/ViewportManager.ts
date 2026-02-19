/**
 * ViewportManager - Manages viewport state and calculations
 * Handles scaling, letterboxing, and safe areas.
 * Now delegates virtual dimensions to PixiRuntime's responsive system.
 */

import { PixiRuntime, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, type Breakpoint } from '../core/PixiRuntime';

export interface ViewportState {
  screenWidth: number;
  screenHeight: number;
  gameWidth: number;
  gameHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  safeArea: SafeArea;
  orientation: 'landscape' | 'portrait';
  dpr: number;
  virtualWidth: number;
  virtualHeight: number;
  breakpoint: Breakpoint;
}

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Manages viewport calculations and transformations.
 */
export class ViewportManager {
  private static instance: ViewportManager | null = null;

  private state: ViewportState;
  private listeners: Set<(state: ViewportState) => void> = new Set();

  private constructor() {
    this.state = this.createDefaultState();
  }

  /** Get singleton instance */
  public static getInstance(): ViewportManager {
    if (!ViewportManager.instance) {
      ViewportManager.instance = new ViewportManager();
    }
    return ViewportManager.instance;
  }

  /** Create default viewport state */
  private createDefaultState(): ViewportState {
    return {
      screenWidth: VIRTUAL_WIDTH,
      screenHeight: VIRTUAL_HEIGHT,
      gameWidth: VIRTUAL_WIDTH,
      gameHeight: VIRTUAL_HEIGHT,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
      orientation: 'landscape',
      dpr: window.devicePixelRatio,
      virtualWidth: VIRTUAL_WIDTH,
      virtualHeight: VIRTUAL_HEIGHT,
      breakpoint: 'desktop',
    };
  }

  /** Update viewport from screen dimensions. Uses PixiRuntime's active virtual dims. */
  public update(screenWidth: number, screenHeight: number): ViewportState {
    const runtime = PixiRuntime.getInstance();
    const rtState = runtime.getState();

    const vw = rtState.virtualWidth;
    const vh = rtState.virtualHeight;

    const scaleX = screenWidth / vw;
    const scaleY = screenHeight / vh;
    const scale = Math.min(scaleX, scaleY);

    const gameWidth = vw * scale;
    const gameHeight = vh * scale;
    const offsetX = (screenWidth - gameWidth) / 2;
    const offsetY = (screenHeight - gameHeight) / 2;

    const orientation = screenWidth >= screenHeight ? 'landscape' : 'portrait';

    this.state = {
      screenWidth,
      screenHeight,
      gameWidth,
      gameHeight,
      scale,
      offsetX,
      offsetY,
      safeArea: this.calculateSafeArea(screenWidth, screenHeight, scale),
      orientation,
      dpr: window.devicePixelRatio,
      virtualWidth: vw,
      virtualHeight: vh,
      breakpoint: rtState.breakpoint,
    };

    this.notifyListeners();
    return this.state;
  }

  /** Calculate safe area for content */
  private calculateSafeArea(
    _screenWidth: number,
    _screenHeight: number,
    _scale: number
  ): SafeArea {
    const basePadding = 20;
    return { top: basePadding, bottom: basePadding, left: basePadding, right: basePadding };
  }

  /** Convert screen coordinates to virtual coordinates */
  public screenToVirtual(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.state.offsetX) / this.state.scale,
      y: (screenY - this.state.offsetY) / this.state.scale,
    };
  }

  /** Convert virtual coordinates to screen coordinates */
  public virtualToScreen(virtualX: number, virtualY: number): { x: number; y: number } {
    return {
      x: virtualX * this.state.scale + this.state.offsetX,
      y: virtualY * this.state.scale + this.state.offsetY,
    };
  }

  /** Get current viewport state */
  public getState(): Readonly<ViewportState> {
    return { ...this.state };
  }

  /** Get active virtual width (responsive-aware) */
  public getVirtualWidth(): number {
    return this.state.virtualWidth;
  }

  /** Get active virtual height (responsive-aware) */
  public getVirtualHeight(): number {
    return this.state.virtualHeight;
  }

  /** Add resize listener */
  public addListener(callback: (state: ViewportState) => void): void {
    this.listeners.add(callback);
  }

  /** Remove resize listener */
  public removeListener(callback: (state: ViewportState) => void): void {
    this.listeners.delete(callback);
  }

  /** Notify all listeners */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /** Check if point is within game area */
  public isPointInGameArea(screenX: number, screenY: number): boolean {
    return (
      screenX >= this.state.offsetX &&
      screenX <= this.state.offsetX + this.state.gameWidth &&
      screenY >= this.state.offsetY &&
      screenY <= this.state.offsetY + this.state.gameHeight
    );
  }

  /** Reset to default state */
  public reset(): void {
    this.state = this.createDefaultState();
    this.notifyListeners();
  }
}
