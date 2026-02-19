/**
 * StageManager - Manages stage lifecycle and transitions
 */

import { Container } from 'pixi.js';
import { StageRoot, StageLayer } from './StageRoot';
import { PixiRuntime } from '../core/PixiRuntime';

export interface StageConfig {
  enableDebug?: boolean;
}

/**
 * Manages the game stage and its layers.
 */
export class StageManager {
  private static instance: StageManager | null = null;

  private stageRoot: StageRoot | null = null;
  private isInitialized: boolean = false;
  private config: StageConfig = {};

  private constructor() {}

  /** Get singleton instance */
  public static getInstance(): StageManager {
    if (!StageManager.instance) {
      StageManager.instance = new StageManager();
    }
    return StageManager.instance;
  }

  /** Initialize the stage manager */
  public initialize(config: StageConfig = {}): void {
    if (this.isInitialized) {
      console.warn('[StageManager] Already initialized');
      return;
    }

    this.config = config;
    
    // Create stage root
    this.stageRoot = new StageRoot();

    // Add to Pixi world container
    const runtime = PixiRuntime.getInstance();
    const worldContainer = runtime.getWorldContainer();
    worldContainer.addChild(this.stageRoot);

    // Hide debug layer by default
    if (!config.enableDebug) {
      this.stageRoot.hideLayer(StageLayer.DEBUG);
    }

    this.isInitialized = true;
    console.log('[StageManager] Initialized');
  }

  /** Get the stage root */
  public getStageRoot(): StageRoot {
    if (!this.stageRoot) {
      throw new Error('[StageManager] Not initialized');
    }
    return this.stageRoot;
  }

  /** Get a specific layer */
  public getLayer(type: StageLayer): Container {
    return this.getStageRoot().getLayer(type);
  }

  /** Add content to layer */
  public addToLayer(type: StageLayer, child: Container): void {
    this.getStageRoot().addToLayer(type, child);
  }

  /** Remove content from layer */
  public removeFromLayer(type: StageLayer, child: Container): void {
    this.getStageRoot().removeFromLayer(type, child);
  }

  /** Clear a layer */
  public clearLayer(type: StageLayer): void {
    this.getStageRoot().clearLayer(type);
  }

  /** Show layer */
  public showLayer(type: StageLayer): void {
    this.getStageRoot().showLayer(type);
  }

  /** Hide layer */
  public hideLayer(type: StageLayer): void {
    this.getStageRoot().hideLayer(type);
  }

  /** Toggle debug layer */
  public toggleDebug(): void {
    const root = this.getStageRoot();
    const debugLayer = root.getLayer(StageLayer.DEBUG);
    debugLayer.visible = !debugLayer.visible;
  }

  /** Check if initialized */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /** Destroy the stage manager */
  public destroy(): void {
    if (this.stageRoot) {
      this.stageRoot.destroy();
      this.stageRoot = null;
    }
    this.isInitialized = false;
    StageManager.instance = null;
  }
}
