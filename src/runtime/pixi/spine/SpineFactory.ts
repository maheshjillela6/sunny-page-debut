/**
 * SpineFactory - Factory for creating and managing Spine animations
 * Supports symbol states: idle, lowwin, highwin, land
 * Supports background, win, and transition animations
 */

import { Container, Sprite, Assets, Texture } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8'; // Using the specific v8 package
import { EventBus } from '@/platform/events/EventBus';
import { AssetResolver } from '../assets/AssetResolver';

// Use the explicit Spine type from the v8 package
type SpineInstance = Spine;

export interface SpineAnimationConfig {
  skeletonKey: string;
  defaultAnimation: string;
  loop: boolean;
  timeScale: number;
  mixDuration: number;
}

export interface SpineSymbolAnimations {
  idle: string;
  lowwin: string;
  highwin: string;
  land: string;
  anticipation?: string;
  scatter?: string;
  expand?: string;
}

export enum SpineAnimationType {
  SYMBOL = 'symbol',
  BACKGROUND = 'background',
  WIN = 'win',
  TRANSITION = 'transition',
  BIGWIN = 'bigwin',
  FEATURE = 'feature',
  OVERLAY = 'overlay',
}

export interface SpineAssetData {
  key: string;
  jsonPath: string;
  atlasPath: string;
  loaded: boolean;
  skeletonData?: any; // Kept for internal tracking
}

/**
 * SpineFactory creates Spine animation instances from loaded skeleton data
 */
export class SpineFactory {
  private static instance: SpineFactory | null = null;
  
  private eventBus: EventBus;
  private assetResolver: AssetResolver;
  private loadedSpines: Map<string, SpineAssetData> = new Map();
  private spineEnabled: boolean = false;
  private initialized: boolean = false;
  
  // Animation name conventions
  private readonly symbolAnimationNames: SpineSymbolAnimations = {
    idle: '{symbol}_idle',
    lowwin: '{symbol}_lowwin',
    highwin: '{symbol}_highwin',
    land: '{symbol}_land',
    anticipation: '{symbol}_anticipation',
    scatter: '{symbol}_scatter',
    expand: '{symbol}_expand',
  };

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.assetResolver = AssetResolver.getInstance();
  }

  public static getInstance(): SpineFactory {
    if (!SpineFactory.instance) {
      SpineFactory.instance = new SpineFactory();
    }
    return SpineFactory.instance;
  }

  /**
   * Check if Spine is available
   */
  public isSpineEnabled(): boolean {
    return this.spineEnabled;
  }

  /**
   * Initialize Spine support
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // In v8, the plugin is often auto-registered or directly imported
      this.spineEnabled = true;
      this.initialized = true;
      console.log('[SpineFactory] Spine support initialized successfully');
    } catch (error) {
      console.warn('[SpineFactory] Spine module failed:', error);
      this.spineEnabled = false;
      this.initialized = true;
    }
  }

  /**
   * Register spine asset data
   */
  public registerSpineAsset(key: string, jsonPath: string, atlasPath: string): void {
    if (this.loadedSpines.has(key)) return;
    
    this.loadedSpines.set(key, {
      key,
      jsonPath,
      atlasPath,
      loaded: false,
    });
  }

  /**
   * Load a spine skeleton using Alias-based logic from working reference
   */
  public async loadSpine(key: string, jsonUrl?: string, atlasUrl?: string, scale: number = 1): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    if (!this.spineEnabled) return false;

    let spineData = this.loadedSpines.get(key);
    if (!spineData && jsonUrl) {
      this.registerSpineAsset(key, jsonUrl, atlasUrl || jsonUrl.replace('.json', '.atlas'));
      spineData = this.loadedSpines.get(key);
    }
    
    if (!spineData) return false;
    if (spineData.loaded) return true;

    const finalJsonUrl = jsonUrl || spineData.jsonPath;
    const finalAtlasUrl = atlasUrl || spineData.atlasPath || finalJsonUrl.replace('.json', '.atlas');

    try {
      const skeletonAlias = `${key}-skeleton`;
      const atlasAlias = `${key}-atlas`;

      // ADOPTED FROM WORKING REF: Add assets to PIXI Assets with aliases
      Assets.add({ alias: skeletonAlias, src: finalJsonUrl });
      Assets.add({ alias: atlasAlias, src: finalAtlasUrl });

      // Load explicitly
      await Assets.load([skeletonAlias, atlasAlias]);

      spineData.loaded = true;
      // We store the aliases to recreate instances
      spineData.skeletonData = { skeletonAlias, atlasAlias, scale };

      console.log(`[SpineFactory] Successfully loaded spine (Alias Mode): ${key}`);
      this.eventBus.emit('asset:spine:loaded', { key });
      return true;
    } catch (error) {
      console.error(`[SpineFactory] Failed to load spine ${key}:`, error);
      return false;
    }
  }

  /**
   * Create a Spine instance using Spine.from
   */
  public createSpineInstance(key: string): SpineInstance | null {
    if (!this.spineEnabled) return null;

    const spineData = this.loadedSpines.get(key);
    if (!spineData || !spineData.loaded || !spineData.skeletonData) return null;

    try {
      const { skeletonAlias, atlasAlias, scale } = spineData.skeletonData;
      
      // ADOPTED FROM WORKING REF: Create instance using static helper
      const spine = Spine.from({
        skeleton: skeletonAlias,
        atlas: atlasAlias,
        scale: scale || 1.0
      });

      spine.autoUpdate = true;
      return spine;
    } catch (error) {
      console.error(`[SpineFactory] Failed to create instance for ${key}:`, error);
      return null;
    }
  }

  public createSymbolSpine(symbolId: string, size: number): SpineSymbolContainer {
    return new SpineSymbolContainer(symbolId, size, this);
  }

  public createBackgroundSpine(key: string): SpineBackgroundContainer {
    return new SpineBackgroundContainer(key, this);
  }

  public createWinSpine(key: string): SpineWinContainer {
    return new SpineWinContainer(key, this);
  }

  public createTransitionSpine(key: string): SpineTransitionContainer {
    return new SpineTransitionContainer(key, this);
  }

  public getSymbolAnimationName(symbolId: string, state: keyof SpineSymbolAnimations): string {
    const template = this.symbolAnimationNames[state];
    return template?.replace('{symbol}', symbolId.toLowerCase()) ?? `${symbolId}_${state}`;
  }

  public isSpineLoaded(key: string): boolean {
    const data = this.loadedSpines.get(key);
    return data?.loaded === true;
  }

  public getSpineData(key: string): SpineAssetData | null {
    return this.loadedSpines.get(key) ?? null;
  }

  public getLoadedSpineKeys(): string[] {
    return Array.from(this.loadedSpines.entries())
      .filter(([_, data]) => data.loaded)
      .map(([key]) => key);
  }

  public unloadSpine(key: string): void {
    const spineData = this.loadedSpines.get(key);
    if (spineData) {
      spineData.loaded = false;
      spineData.skeletonData = undefined;
      console.log(`[SpineFactory] Unloaded spine: ${key}`);
    }
  }

  public unloadAll(): void {
    for (const [key] of this.loadedSpines) {
      this.unloadSpine(key);
    }
  }

  public getStats(): { registered: number; loaded: number } {
    let loaded = 0;
    for (const data of this.loadedSpines.values()) {
      if (data.loaded) loaded++;
    }
    return { registered: this.loadedSpines.size, loaded };
  }

  public destroy(): void {
    this.unloadAll();
    this.loadedSpines.clear();
    this.initialized = false;
    SpineFactory.instance = null;
  }
}

// Ensure the rest of the Container classes (SpineContainerBase, SpineSymbolContainer, etc.) remain as they are in your source code.
// No changes required to SpineContainerBase as it already calls this.factory.createSpineInstance(this.spineKey).

/**
 * Base container for Spine animations with fallback support
 */
export class SpineContainerBase extends Container {
  protected spineKey: string;
  protected factory: SpineFactory;
  protected currentAnimation: string = '';
  protected isPlaying: boolean = false;
  protected timeScale: number = 1;
  protected fallbackSprite: Sprite | null = null;
  protected spine: SpineInstance | null = null;

  constructor(spineKey: string, factory: SpineFactory) {
    super();
    this.spineKey = spineKey;
    this.factory = factory;
    this.label = `SpineContainer_${spineKey}`;
    
    this.initializeSpine();
  }

  private initializeSpine(): void {
    if (!this.factory.isSpineEnabled() || !this.factory.isSpineLoaded(this.spineKey)) {
      console.log(`[SpineContainer] Spine not available for ${this.spineKey}, using fallback`);
      return;
    }

    const spineInstance = this.factory.createSpineInstance(this.spineKey);
    if (spineInstance) {
      this.spine = spineInstance;
      this.addChild(this.spine);
      console.log(`[SpineContainer] Created spine instance for ${this.spineKey}`);
    }
  }

  /**
   * Play an animation
   */
  public play(animationName: string, loop: boolean = true, onComplete?: () => void): void {
    this.currentAnimation = animationName;
    this.isPlaying = true;
    
    if (this.spine && this.spine.state) {
      try {
        // Check if animation exists
        const hasAnim = this.spine.skeleton?.data?.findAnimation?.(animationName);
        if (hasAnim) {
          const track = this.spine.state.setAnimation(0, animationName, loop);
          if (onComplete && track) {
            track.listener = {
              complete: () => onComplete()
            };
          }
        } else {
          console.warn(`[SpineContainer] Animation not found: ${animationName} for ${this.spineKey}`);
          this.onFallbackPlay(animationName, loop, onComplete);
        }
      } catch (e) {
        console.error(`[SpineContainer] Error playing animation ${animationName}`, e);
        this.onFallbackPlay(animationName, loop, onComplete);
      }
    } else {
      this.onFallbackPlay(animationName, loop, onComplete);
    }
  }

  /**
   * Stop current animation
   */
  public stop(): void {
    this.isPlaying = false;
    if (this.spine && this.spine.state) {
      this.spine.state.clearTracks();
      if (this.spine.skeleton) {
        this.spine.skeleton.setToSetupPose();
      }
    }
    this.onFallbackStop();
  }

  /**
   * Set animation time scale
   */
  public setTimeScale(scale: number): void {
    this.timeScale = scale;
    if (this.spine && this.spine.state) {
      this.spine.state.timeScale = scale;
    }
  }

  /**
   * Get current animation
   */
  public getCurrentAnimation(): string {
    return this.currentAnimation;
  }

  /**
   * Check if playing
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Check if spine instance exists
   */
  public hasSpine(): boolean {
    return this.spine !== null;
  }

  /**
   * Override in subclasses for fallback behavior
   */
  protected onFallbackPlay(_animation: string, _loop: boolean, _onComplete?: () => void): void {
    // Override in subclass
  }

  protected onFallbackStop(): void {
    // Override in subclass
  }

  public reset(): void {
    this.stop();
    this.currentAnimation = '';
    this.timeScale = 1;
    this.x = 0;
    this.y = 0;
    this.scale.set(1);
    this.rotation = 0;
    this.alpha = 1;
    this.visible = true;
    
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }
}

/**
 * Spine container for symbol animations
 */
export class SpineSymbolContainer extends SpineContainerBase {
  private symbolId: string;
  private size: number;

  constructor(symbolId: string, size: number, factory: SpineFactory) {
    super(`symbol_${symbolId}`, factory);
    this.symbolId = symbolId;
    this.size = size;
    this.label = `SpineSymbol_${symbolId}`;
  }

  public playIdle(loop: boolean = true): void {
    const animName = this.factory.getSymbolAnimationName(this.symbolId, 'idle');
    this.play(animName, loop);
  }

  public playLowWin(onComplete?: () => void): void {
    const animName = this.factory.getSymbolAnimationName(this.symbolId, 'lowwin');
    this.play(animName, false, onComplete);
  }

  public playHighWin(onComplete?: () => void): void {
    const animName = this.factory.getSymbolAnimationName(this.symbolId, 'highwin');
    this.play(animName, false, onComplete);
  }

  public playLand(onComplete?: () => void): void {
    const animName = this.factory.getSymbolAnimationName(this.symbolId, 'land');
    this.play(animName, false, onComplete);
  }

  public playAnticipation(loop: boolean = true): void {
    const animName = this.factory.getSymbolAnimationName(this.symbolId, 'anticipation');
    this.play(animName, loop);
  }

  public getSymbolId(): string {
    return this.symbolId;
  }

  protected onFallbackPlay(animation: string, loop: boolean, onComplete?: () => void): void {
    // Call complete after a delay if not looping
    if (!loop && onComplete) {
      setTimeout(onComplete, 500);
    }
  }
}

/**
 * Spine container for background animations
 */
export class SpineBackgroundContainer extends SpineContainerBase {
  constructor(key: string, factory: SpineFactory) {
    super(key, factory);
    this.label = `SpineBackground_${key}`;
  }

  public playAmbient(loop: boolean = true): void {
    this.play('ambient', loop);
  }

  public playTransition(onComplete?: () => void): void {
    this.play('transition', false, onComplete);
  }

  public playFeatureIntro(onComplete?: () => void): void {
    this.play('feature_intro', false, onComplete);
  }

  protected onFallbackPlay(animation: string, loop: boolean, onComplete?: () => void): void {
    // Could add background shimmer or gradient animation here
    if (!loop && onComplete) {
      setTimeout(onComplete, 1000);
    }
  }
}

/**
 * Spine container for win celebrations
 */
export class SpineWinContainer extends SpineContainerBase {
  constructor(key: string, factory: SpineFactory) {
    super(key, factory);
    this.label = `SpineWin_${key}`;
  }

  public playSmallWin(onComplete?: () => void): void {
    this.play('small_win', false, onComplete);
  }

  public playBigWin(onComplete?: () => void): void {
    this.play('big_win', false, onComplete);
  }

  public playMegaWin(onComplete?: () => void): void {
    this.play('mega_win', false, onComplete);
  }

  public playEpicWin(onComplete?: () => void): void {
    this.play('epic_win', false, onComplete);
  }

  protected onFallbackPlay(animation: string, loop: boolean, onComplete?: () => void): void {
    // Fallback uses CSS/UI overlay for win celebrations
    if (onComplete) {
      setTimeout(onComplete, 2000);
    }
  }
}

/**
 * Spine container for transitions
 */
export class SpineTransitionContainer extends SpineContainerBase {
  constructor(key: string, factory: SpineFactory) {
    super(key, factory);
    this.label = `SpineTransition_${key}`;
  }

  public playIn(onComplete?: () => void): void {
    this.play('transition_in', false, onComplete);
  }

  public playOut(onComplete?: () => void): void {
    this.play('transition_out', false, onComplete);
  }

  protected onFallbackPlay(animation: string, loop: boolean, onComplete?: () => void): void {
    // Fallback to CSS transitions
    if (onComplete) {
      setTimeout(onComplete, 500);
    }
  }
}

export default SpineFactory;
