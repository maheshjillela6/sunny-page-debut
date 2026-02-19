/**
 * SymbolView - Visual representation of a slot symbol
 * Priority: 1. Spine animation, 2. Spritesheet frame, 3. Individual texture, 4. Default graphics
 */

import { Container, Graphics, Text, TextStyle, Sprite, Texture } from 'pixi.js';
import { Poolable } from '../../../runtime/pixi/pooling/ObjectPool';
import { SpineFactory, SpineSymbolContainer } from '../../../runtime/pixi/spine/SpineFactory';
import { SpineSymbolAnimator } from '../../../runtime/pixi/spine/SpineAnimator';
import { DefaultAssets } from '../../../runtime/pixi/assets/DefaultAssets';
import { TextureCache } from '../../../runtime/pixi/assets/TextureCache';
import { SpritesheetLoader } from '../../../runtime/pixi/assets/SpritesheetLoader';
import { ConfigManager, SymbolDefinition } from '../../../content/ConfigManager';
import { EventBus } from '../../../platform/events/EventBus';

export type SymbolState = 'idle' | 'spinning' | 'landing' | 'lowwin' | 'highwin' | 'anticipation';

export type SymbolRenderMode = 'spine' | 'texture' | 'fallback';

export class SymbolView extends Container implements Poolable {
  private symbolId: string = '';
  private symbolState: SymbolState = 'idle';
  private size: number;
  private renderMode: SymbolRenderMode = 'fallback';
  
  // Spine rendering
  private spineContainer: SpineSymbolContainer | null = null;
  private spineAnimator: SpineSymbolAnimator | null = null;
  
  // Texture rendering (from spritesheet or individual image)
  private textureSprite: Sprite | null = null;
  
  // Fallback rendering
  private fallbackContainer: Container | null = null;
  
  // Highlight overlay
  private highlightGraphics: Graphics;
  
  // State
  private isHighlighted: boolean = false;
  private symbolDefinition: SymbolDefinition | null = null;
  
  // Managers
  private spineFactory: SpineFactory;
  private textureCache: TextureCache;
  private spritesheetLoader: SpritesheetLoader;
  private defaultAssets: DefaultAssets;
  private configManager: ConfigManager;
  private eventBus: EventBus;

  constructor(size: number = 120) {
    super();
    this.label = 'SymbolView';
    this.size = size;

    this.spineFactory = SpineFactory.getInstance();
    this.textureCache = TextureCache.getInstance();
    this.spritesheetLoader = SpritesheetLoader.getInstance();
    this.defaultAssets = DefaultAssets.getInstance();
    this.configManager = ConfigManager.getInstance();
    this.eventBus = EventBus.getInstance();

    // Highlight graphics (always available)
    this.highlightGraphics = new Graphics();
    this.addChild(this.highlightGraphics);
  }

  /**
   * Set the symbol ID and update visuals
   * Uses priority: Spine > Spritesheet texture > Individual texture > Default graphics
   */
  public setSymbolId(id: string): void {
    if (this.symbolId === id) return;
    
    this.symbolId = id;
    this.symbolDefinition = this.configManager.getSymbolDefinition(id);
    
    // Clear previous visuals
    this.clearVisuals();
    
    // Try each render mode in priority order
    if (this.trySetupSpine(id)) {
      this.renderMode = 'spine';
    } else if (this.trySetupTexture(id)) {
      this.renderMode = 'texture';
    } else {
      this.setupFallback(id);
      this.renderMode = 'fallback';
    }
    
    this.setState('idle');
  }

  /**
   * Try to setup spine animation for this symbol
   */
  private trySetupSpine(symbolId: string): boolean {
    const spineKey = `symbol_${symbolId.toLowerCase()}`;
    
    if (!this.spineFactory.isSpineEnabled() || !this.spineFactory.isSpineLoaded(spineKey)) {
      return false;
    }

    try {
      this.spineContainer = this.spineFactory.createSymbolSpine(symbolId, this.size);
      
      if (this.spineContainer.hasSpine()) {
        this.spineAnimator = new SpineSymbolAnimator(this.spineContainer, symbolId);
        this.addChild(this.spineContainer);
        console.log(`[SymbolView] Using Spine for symbol: ${symbolId}`);
        return true;
      }
      
      // Spine container created but no spine instance - cleanup and try texture
      this.spineContainer = null;
      return false;
    } catch (error) {
      console.warn(`[SymbolView] Failed to create spine for ${symbolId}:`, error);
      this.spineContainer = null;
      return false;
    }
  }

  /**
   * Try to setup texture from spritesheet or individual image
   */
  private trySetupTexture(symbolId: string): boolean {
    let texture: Texture | null = null;
    
    // Try spritesheet frame first
    texture = this.spritesheetLoader.getSymbolFrame(symbolId);
    
    if (!texture) {
      // Try texture cache with various naming conventions
      texture = this.textureCache.getSymbolTexture(symbolId);
    }
    
    if (texture && texture !== Texture.EMPTY) {
      this.textureSprite = new Sprite(texture);
      this.textureSprite.anchor.set(0.5);
      
      // Scale to fit size
      const maxDim = Math.max(texture.width, texture.height);
      if (maxDim > 0) {
        const scale = this.size / maxDim;
        this.textureSprite.scale.set(scale);
      }
      
      // Center in container
      this.textureSprite.x = this.size / 2;
      this.textureSprite.y = this.size / 2;
      
      this.addChild(this.textureSprite);
      console.log(`[SymbolView] Using texture for symbol: ${symbolId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Setup fallback graphics
   */
  private setupFallback(symbolId: string): void {
    this.fallbackContainer = this.defaultAssets.createSymbol(symbolId, this.size);
    this.addChild(this.fallbackContainer);
    console.log(`[SymbolView] Using fallback graphics for symbol: ${symbolId}`);
  }

  /**
   * Clear current visuals
   */
  private clearVisuals(): void {
    if (this.spineContainer) {
      this.removeChild(this.spineContainer);
      this.spineAnimator?.destroy();
      this.spineAnimator = null;
      this.spineContainer = null;
    }
    
    if (this.textureSprite) {
      this.removeChild(this.textureSprite);
      this.textureSprite.destroy();
      this.textureSprite = null;
    }
    
    if (this.fallbackContainer) {
      this.removeChild(this.fallbackContainer);
      this.fallbackContainer.destroy({ children: true });
      this.fallbackContainer = null;
    }
  }

  /**
   * Get the current symbol ID
   */
  public getSymbolId(): string {
    return this.symbolId;
  }

  /**
   * Get the current render mode
   */
  public getRenderMode(): SymbolRenderMode {
    return this.renderMode;
  }

  /**
   * Set symbol state (triggers appropriate animation)
   */
  public setState(state: SymbolState): void {
    if (this.symbolState === state) return;
    
    this.symbolState = state;
    
    if (this.renderMode === 'spine' && this.spineAnimator) {
      this.playSpineState(state);
    } else {
      this.playFallbackState(state);
    }
  }

  /**
   * Play spine animation for state
   */
  private playSpineState(state: SymbolState): void {
    if (!this.spineAnimator) return;
    
    switch (state) {
      case 'idle':
        this.spineAnimator.playIdle();
        break;
      case 'landing':
        this.spineAnimator.playLandThenIdle();
        break;
      case 'lowwin':
        this.spineAnimator.playWin('low');
        break;
      case 'highwin':
        this.spineAnimator.playWin('high');
        break;
      case 'anticipation':
        this.spineAnimator.playAnticipation();
        break;
    }
  }

  /**
   * Handle state change for texture/fallback rendering
   */
  private playFallbackState(state: SymbolState): void {
    // Reset scale/alpha
    this.scale.set(1);
    this.alpha = 1;
    
    switch (state) {
      case 'landing':
        // Bounce effect can be applied via GSAP externally
        break;
      case 'lowwin':
      case 'highwin':
        // Pulse effect can be applied externally
        break;
      case 'spinning':
        // Blur might be applied externally
        break;
    }
  }

  /**
   * Get current state
   */
  public getState(): SymbolState {
    return this.symbolState;
  }

  /**
   * Set a random symbol (for testing/demo)
   */
  public setRandomSymbol(): void {
    const symbols = ['A', 'B', 'C', 'D', 'E', 'F'];
    const randomId = symbols[Math.floor(Math.random() * symbols.length)];
    this.setSymbolId(randomId);
  }

  /**
   * Highlight this symbol (for win display)
   */
  public highlight(color: number = 0xf1c40f): void {
    if (this.isHighlighted) return;
    this.isHighlighted = true;

    this.highlightGraphics.clear();
    this.highlightGraphics.roundRect(-4, -4, this.size + 8, this.size + 8, 16);
    this.highlightGraphics.fill({ color, alpha: 0.4 });
    this.highlightGraphics.stroke({ color, width: 4 });
  }

  /**
   * Remove highlight
   */
  public unhighlight(): void {
    if (!this.isHighlighted) return;
    this.isHighlighted = false;
    this.highlightGraphics.clear();
  }

  /**
   * Play win animation
   */
  public playWin(tier: 'low' | 'high' = 'low', onComplete?: () => void): void {
    if (tier === 'high') {
      this.setState('highwin');
    } else {
      this.setState('lowwin');
    }
    
    if (this.renderMode === 'spine' && this.spineAnimator) {
      this.spineAnimator.playWin(tier, onComplete);
    } else if (onComplete) {
      // Fallback: simulate animation duration
      setTimeout(onComplete, 500);
    }
  }

  /**
   * Play landing animation
   */
  public playLand(onComplete?: () => void): void {
    this.setState('landing');
    
    if (this.renderMode === 'spine' && this.spineAnimator) {
      this.spineAnimator.playLandThenIdle(onComplete);
    } else if (onComplete) {
      setTimeout(onComplete, 200);
    }
  }

  /**
   * Pulse effect (used for win highlighting)
   */
  public pulse(): void {
    this.scale.set(1.05);
  }

  /**
   * Remove pulse effect
   */
  public unpulse(): void {
    this.scale.set(1);
  }

  /**
   * Check if using spine rendering
   */
  public isUsingSpine(): boolean {
    return this.renderMode === 'spine';
  }

  /**
   * Check if using texture rendering
   */
  public isUsingTexture(): boolean {
    return this.renderMode === 'texture';
  }

  /**
   * Get symbol definition
   */
  public getDefinition(): SymbolDefinition | null {
    return this.symbolDefinition;
  }

  /**
   * Reset for pooling
   */
  public reset(): void {
    this.clearVisuals();
    
    this.symbolId = '';
    this.symbolDefinition = null;
    this.symbolState = 'idle';
    this.isHighlighted = false;
    this.renderMode = 'fallback';
    
    this.highlightGraphics.clear();
    this.scale.set(1);
    this.alpha = 1;
    this.x = 0;
    this.y = 0;
    this.rotation = 0;
    this.visible = true;

    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  /**
   * Destroy the symbol view
   */
  public override destroy(): void {
    this.clearVisuals();
    this.highlightGraphics.destroy();
    super.destroy({ children: true });
  }
}
