/**
 * PixiRuntime - Core PixiJS Application Manager
 * Manages the PixiJS application lifecycle, rendering, and canvas management.
 * This is the single source of truth for the Pixi application instance.
 *
 * Supports responsive virtual dimensions: the virtual canvas size changes
 * based on screen breakpoint (desktop / tablet / mobile) as defined in the
 * game's responsive.json.
 */

import { Application, Container, Graphics } from 'pixi.js';
import type { PixiTicker } from './PixiTicker';
import type { PixiClock } from './PixiClock';
import { PixiRendererFactory } from './PixiRendererFactory';
import { PixiDisposer } from './PixiDisposer';
import { PixiPerformanceMonitor } from './PixiPerformanceMonitor';
import { EventBus } from '../../../platform/events/EventBus';

/** Default virtual resolution (desktop landscape) */
export const VIRTUAL_WIDTH = 1280;
export const VIRTUAL_HEIGHT = 720;

export type Breakpoint = 'desktop' | 'tablet' | 'mobile' | 'mobileLandscape';

export interface PixiRuntimeConfig {
  containerId: string;
  backgroundColor?: number;
  resolution?: number;
  antialias?: boolean;
  powerPreference?: 'high-performance' | 'low-power' | 'default';
}

export interface PixiRuntimeState {
  isInitialized: boolean;
  isRunning: boolean;
  isPaused: boolean;
  currentScale: number;
  screenWidth: number;
  screenHeight: number;
  offsetX: number;
  offsetY: number;
  virtualWidth: number;
  virtualHeight: number;
  breakpoint: Breakpoint;
  orientation: 'landscape' | 'portrait';
}

/**
 * Core Pixi runtime managing the application lifecycle.
 * Singleton pattern ensures only one Pixi application exists.
 */
export class PixiRuntime {
  private static instance: PixiRuntime | null = null;

  private app: Application | null = null;
  private container: HTMLElement | null = null;
  private worldContainer: Container | null = null;
  private letterboxGraphics: Graphics | null = null;
  
  private ticker: PixiTicker | null = null;
  private clock: PixiClock | null = null;
  private performanceMonitor: PixiPerformanceMonitor | null = null;
  private disposer: PixiDisposer;
  private eventBus: EventBus;

  /** Responsive layout map: breakpoint → { virtualWidth, virtualHeight, grid, ... } */
  private responsiveLayouts: Record<string, any> | null = null;

  private state: PixiRuntimeState = {
    isInitialized: false,
    isRunning: false,
    isPaused: false,
    currentScale: 1,
    screenWidth: VIRTUAL_WIDTH,
    screenHeight: VIRTUAL_HEIGHT,
    offsetX: 0,
    offsetY: 0,
    virtualWidth: VIRTUAL_WIDTH,
    virtualHeight: VIRTUAL_HEIGHT,
    breakpoint: 'desktop',
    orientation: 'landscape',
  };

  private config: PixiRuntimeConfig | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimeoutId: number | null = null;
  private pendingResize: boolean = false;
  private lastResizeTime: number = 0;
  private readonly RESIZE_DEBOUNCE_MS = 50;
  private boundResize: () => void;

  private constructor() {
    this.disposer = new PixiDisposer();
    this.eventBus = EventBus.getInstance();
    this.boundResize = this.handleResize.bind(this);
  }

  /** Get singleton instance */
  public static getInstance(): PixiRuntime {
    if (!PixiRuntime.instance) {
      PixiRuntime.instance = new PixiRuntime();
    }
    return PixiRuntime.instance;
  }

  // ── Responsive layout injection ──────────────────────────────────────────

  /**
   * Called by EngineKernel / GameLoader AFTER config is loaded.
   * Provides the responsive.layouts map so PixiRuntime can pick the right
   * virtual dimensions on every resize.
   */
  public setResponsiveLayouts(layouts: Record<string, any>): void {
    this.responsiveLayouts = layouts;
    // Force re-evaluate: virtual dimensions likely changed even though screen
    // size / breakpoint haven't. Reset cached screen dims so performResize
    // doesn't early-return.
    if (this.state.isInitialized) {
      this.state.screenWidth = -1;
      this.state.screenHeight = -1;
      this.performResize();
    }
  }

  /**
   * Determine current breakpoint from screen dimensions.
   * Considers both size AND orientation to pick the best layout.
   */
  private resolveBreakpoint(screenWidth: number, screenHeight: number): Breakpoint {
    const isLandscape = screenWidth > screenHeight;
    const shortSide = Math.min(screenWidth, screenHeight);
    const longSide = Math.max(screenWidth, screenHeight);

    // Portrait phones / small portrait tablets → mobile (portrait layout 720×1280)
    if (!isLandscape && shortSide < 1024) {
      return 'mobile';
    }

    // Landscape phones: short side typically < 500px (or long side < 900)
    // Also catches small landscape tablets held as phones
    if (isLandscape && shortSide < 500) {
      return 'mobileLandscape';
    }

    // Tablets (either orientation) — short side 500-1024
    if (shortSide < 1024 && longSide < 1400) {
      return 'tablet';
    }

    return 'desktop';
  }

  /**
   * Get active virtual dimensions for the given breakpoint.
   */
  private getVirtualDimensions(breakpoint: Breakpoint): { w: number; h: number } {
    if (this.responsiveLayouts) {
      const layout = this.responsiveLayouts[breakpoint];
      if (layout?.virtualWidth && layout?.virtualHeight) {
        return { w: layout.virtualWidth, h: layout.virtualHeight };
      }
    }
    // Fallback to constants
    return { w: VIRTUAL_WIDTH, h: VIRTUAL_HEIGHT };
  }

  /** Get the responsive layout data for the current breakpoint */
  public getActiveResponsiveLayout(): any | null {
    if (!this.responsiveLayouts) return null;
    return this.responsiveLayouts[this.state.breakpoint] ?? null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /** Initialize the Pixi application */
  public async initialize(config: PixiRuntimeConfig): Promise<void> {
    if (this.state.isInitialized) {
      console.warn('[PixiRuntime] Already initialized');
      return;
    }

    this.config = config;
    this.container = document.getElementById(config.containerId);

    if (!this.container) {
      throw new Error(`[PixiRuntime] Container element not found: ${config.containerId}`);
    }

    // Create the Pixi application
    this.app = await PixiRendererFactory.createApplication({
      backgroundColor: config.backgroundColor ?? 0x0a0e14,
      resolution: config.resolution ?? window.devicePixelRatio,
      antialias: config.antialias ?? true,
      powerPreference: config.powerPreference ?? 'high-performance',
      autoDensity: true,
    });

    // Setup canvas
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    
    this.container.appendChild(canvas);

    // Create letterbox graphics for black bars
    this.letterboxGraphics = new Graphics();
    this.app.stage.addChild(this.letterboxGraphics);

    // Create world container that will be scaled
    this.worldContainer = new Container();
    this.worldContainer.label = 'WorldContainer';
    this.app.stage.addChild(this.worldContainer);

    // Setup resize handling
    this.setupResizeObserver();
    this.handleResize();

    // Initialize subsystems
    this.performanceMonitor = new PixiPerformanceMonitor(this.app);

    this.state.isInitialized = true;
    this.state.isRunning = true;

    console.log('[PixiRuntime] Initialized successfully');
  }

  /** Get the Pixi Application instance */
  public getApp(): Application {
    if (!this.app) {
      throw new Error('[PixiRuntime] Not initialized');
    }
    return this.app;
  }

  /** Get the world container for adding game content */
  public getWorldContainer(): Container {
    if (!this.worldContainer) {
      throw new Error('[PixiRuntime] Not initialized');
    }
    return this.worldContainer;
  }

  /** Get current runtime state */
  public getState(): Readonly<PixiRuntimeState> {
    return { ...this.state };
  }

  /** Get current scale factor */
  public getScale(): number {
    return this.state.currentScale;
  }

  /** Get active virtual width (responsive) */
  public getVirtualWidth(): number {
    return this.state.virtualWidth;
  }

  /** Get active virtual height (responsive) */
  public getVirtualHeight(): number {
    return this.state.virtualHeight;
  }

  /** Get current breakpoint */
  public getBreakpoint(): Breakpoint {
    return this.state.breakpoint;
  }

  /** Convert screen coordinates to virtual world coordinates */
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.state.offsetX) / this.state.currentScale,
      y: (screenY - this.state.offsetY) / this.state.currentScale,
    };
  }

  /** Convert virtual world coordinates to screen coordinates */
  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.state.currentScale + this.state.offsetX,
      y: worldY * this.state.currentScale + this.state.offsetY,
    };
  }

  /** Pause rendering */
  public pause(): void {
    if (!this.app || this.state.isPaused) return;
    this.app.ticker.stop();
    this.state.isPaused = true;
    this.state.isRunning = false;
  }

  /** Resume rendering */
  public resume(): void {
    if (!this.app || !this.state.isPaused) return;
    this.app.ticker.start();
    this.state.isPaused = false;
    this.state.isRunning = true;
  }

  /** Handle container resize with debouncing to prevent blinking */
  private handleResize(): void {
    if (!this.app || !this.container || !this.worldContainer) return;

    const now = performance.now();
    
    // Debounce rapid resize events
    if (now - this.lastResizeTime < this.RESIZE_DEBOUNCE_MS) {
      this.pendingResize = true;
      
      if (this.resizeTimeoutId !== null) {
        window.clearTimeout(this.resizeTimeoutId);
      }
      
      this.resizeTimeoutId = window.setTimeout(() => {
        this.resizeTimeoutId = null;
        if (this.pendingResize) {
          this.pendingResize = false;
          this.performResize();
        }
      }, this.RESIZE_DEBOUNCE_MS);
      
      return;
    }

    this.lastResizeTime = now;
    this.performResize();
  }

  /** Perform the actual resize operation */
  private performResize(): void {
    if (!this.app || !this.container || !this.worldContainer) return;

    const screenWidth = this.container.clientWidth;
    const screenHeight = this.container.clientHeight;

    // Skip if dimensions are invalid
    if (screenWidth <= 0 || screenHeight <= 0) return;

    // Determine breakpoint & orientation
    const breakpoint = this.resolveBreakpoint(screenWidth, screenHeight);
    const orientation: 'landscape' | 'portrait' = screenWidth >= screenHeight ? 'landscape' : 'portrait';
    const { w: vw, h: vh } = this.getVirtualDimensions(breakpoint);

    const breakpointChanged = breakpoint !== this.state.breakpoint;
    const dimsUnchanged = screenWidth === this.state.screenWidth && screenHeight === this.state.screenHeight && !breakpointChanged;
    if (dimsUnchanged) return;

    // Calculate scale to fit virtual resolution
    const scaleX = screenWidth / vw;
    const scaleY = screenHeight / vh;
    const scale = Math.min(scaleX, scaleY);

    // Calculate letterbox offsets
    const gameWidth = vw * scale;
    const gameHeight = vh * scale;
    const offsetX = Math.floor((screenWidth - gameWidth) / 2);
    const offsetY = Math.floor((screenHeight - gameHeight) / 2);

    // Use integer values to prevent sub-pixel rendering issues
    this.worldContainer.scale.set(scale);
    this.worldContainer.position.set(offsetX, offsetY);
    
    // Draw letterbox bars
    this.drawLetterbox(screenWidth, screenHeight, offsetX, offsetY, gameWidth, gameHeight);

    // Resize the renderer to the new dimensions
    this.app.renderer.resize(screenWidth, screenHeight);
    this.app.render(); // Force an immediate render

    // Update state
    this.state.currentScale = scale;
    this.state.screenWidth = screenWidth;
    this.state.screenHeight = screenHeight;
    this.state.offsetX = offsetX;
    this.state.offsetY = offsetY;
    this.state.virtualWidth = vw;
    this.state.virtualHeight = vh;
    this.state.breakpoint = breakpoint;
    this.state.orientation = orientation;

    // Emit resize event so layers / grid / screens can relayout
    this.eventBus.emit('viewport:resize', {
      screenWidth,
      screenHeight,
      virtualWidth: vw,
      virtualHeight: vh,
      scale,
      offsetX,
      offsetY,
      breakpoint,
      orientation,
    });

    if (breakpointChanged) {
      console.log(`[PixiRuntime] Breakpoint changed → ${breakpoint} (virtual: ${vw}×${vh})`);
      this.eventBus.emit('viewport:breakpoint:changed', {
        breakpoint,
        orientation,
        virtualWidth: vw,
        virtualHeight: vh,
      });
    }
  }

  /** Draw letterbox black bars */
  private drawLetterbox(
    screenWidth: number,
    screenHeight: number,
    offsetX: number,
    offsetY: number,
    gameWidth: number,
    gameHeight: number
  ): void {
    if (!this.letterboxGraphics) return;

    this.letterboxGraphics.clear();
    const letterboxColor = this.config?.backgroundColor ?? 0x0a0e14;

    if (offsetY > 0) {
      this.letterboxGraphics.rect(0, 0, screenWidth, offsetY);
    }
    if (offsetY > 0) {
      this.letterboxGraphics.rect(0, offsetY + gameHeight, screenWidth, offsetY + 1);
    }
    if (offsetX > 0) {
      this.letterboxGraphics.rect(0, 0, offsetX, screenHeight);
    }
    if (offsetX > 0) {
      this.letterboxGraphics.rect(offsetX + gameWidth, 0, offsetX + 1, screenHeight);
    }

    this.letterboxGraphics.fill({ color: letterboxColor });
  }

  /** Setup resize observer for container */
  private setupResizeObserver(): void {
    if (!this.container) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });

    this.resizeObserver.observe(this.container);
  }

  /** Set the ticker instance */
  public setTicker(ticker: PixiTicker): void {
    this.ticker = ticker;
  }

  /** Set the clock instance */
  public setClock(clock: PixiClock): void {
    this.clock = clock;
  }

  /** Get performance monitor */
  public getPerformanceMonitor(): PixiPerformanceMonitor | null {
    return this.performanceMonitor;
  }

  /** Destroy and cleanup the runtime */
  public destroy(): void {
    if (!this.state.isInitialized) return;

    if (this.resizeTimeoutId !== null) {
      window.clearTimeout(this.resizeTimeoutId);
      this.resizeTimeoutId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.disposer.disposeAll();

    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }

    this.worldContainer = null;
    this.letterboxGraphics = null;
    this.container = null;
    this.ticker = null;
    this.clock = null;
    this.performanceMonitor = null;
    this.pendingResize = false;
    this.responsiveLayouts = null;

    this.state = {
      isInitialized: false,
      isRunning: false,
      isPaused: false,
      currentScale: 1,
      screenWidth: VIRTUAL_WIDTH,
      screenHeight: VIRTUAL_HEIGHT,
      offsetX: 0,
      offsetY: 0,
      virtualWidth: VIRTUAL_WIDTH,
      virtualHeight: VIRTUAL_HEIGHT,
      breakpoint: 'desktop',
      orientation: 'landscape',
    };

    PixiRuntime.instance = null;

    console.log('[PixiRuntime] Destroyed');
  }
}
