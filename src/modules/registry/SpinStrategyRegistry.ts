/**
 * SpinStrategyRegistry - Registry for pluggable spin strategies
 */

import { ISpinStrategy, SpinDirection, SpinConfig } from '../../gameplay/interfaces/ISpinStrategy';
import { TopToBottomStrategy } from '../mechanics/standard/TopToBottomStrategy';
import { BottomToTopStrategy } from '../mechanics/standard/BottomToTopStrategy';
import { LeftToRightStrategy } from '../mechanics/standard/LeftToRightStrategy';
import { RightToLeftStrategy } from '../mechanics/standard/RightToLeftStrategy';
import { ZoomInStrategy } from '../mechanics/standard/ZoomInStrategy';
import { ZoomOutStrategy } from '../mechanics/standard/ZoomOutStrategy';
import { SpiralStrategy } from '../mechanics/standard/SpiralStrategy';
import { FadeShuffleStrategy } from '../mechanics/standard/FadeShuffleStrategy';
import { FlipStrategy } from '../mechanics/standard/FlipStrategy';

export type SpinStrategyFactory = (config?: Partial<SpinConfig>) => ISpinStrategy;

export class SpinStrategyRegistry {
  private static instance: SpinStrategyRegistry | null = null;
  
  private strategies: Map<string, SpinStrategyFactory> = new Map();
  private defaultStrategyId: string = 'top_to_bottom';
  private currentStrategy: ISpinStrategy | null = null;

  private constructor() {
    this.registerBuiltInStrategies();
  }

  public static getInstance(): SpinStrategyRegistry {
    if (!SpinStrategyRegistry.instance) {
      SpinStrategyRegistry.instance = new SpinStrategyRegistry();
    }
    return SpinStrategyRegistry.instance;
  }

  private registerBuiltInStrategies(): void {
    // Vertical strategies
    this.register('top_to_bottom', (config) => new TopToBottomStrategy(config));
    this.register('bottom_to_top', (config) => new BottomToTopStrategy(config));
    
    // Horizontal strategies
    this.register('left_to_right', (config) => new LeftToRightStrategy(config));
    this.register('right_to_left', (config) => new RightToLeftStrategy(config));
    
    // Zoom strategies
    this.register('zoom_in', (config) => new ZoomInStrategy(config));
    this.register('zoom_out', (config) => new ZoomOutStrategy(config));
    
    // Spiral strategies
    this.register('spiral_in', (config) => new SpiralStrategy(config, true));
    this.register('spiral_out', (config) => new SpiralStrategy(config, false));
    
    // Effect strategies
    this.register('fade_shuffle', (config) => new FadeShuffleStrategy(config));
    this.register('flip_horizontal', (config) => new FlipStrategy(config, true));
    this.register('flip_vertical', (config) => new FlipStrategy(config, false));
  }

  /**
   * Register a custom spin strategy
   */
  public register(id: string, factory: SpinStrategyFactory): void {
    if (this.strategies.has(id)) {
      console.warn(`[SpinStrategyRegistry] Overwriting existing strategy: ${id}`);
    }
    this.strategies.set(id, factory);
  }

  /**
   * Unregister a spin strategy
   */
  public unregister(id: string): boolean {
    return this.strategies.delete(id);
  }

  /**
   * Get a strategy instance by ID
   */
  public get(id: string, config?: Partial<SpinConfig>): ISpinStrategy | null {
    const factory = this.strategies.get(id);
    if (!factory) {
      console.warn(`[SpinStrategyRegistry] Strategy not found: ${id}`);
      return null;
    }
    return factory(config);
  }

  /**
   * Get strategy by direction enum
   */
  public getByDirection(direction: SpinDirection, config?: Partial<SpinConfig>): ISpinStrategy | null {
    const mapping: Record<SpinDirection, string> = {
      [SpinDirection.TOP_TO_BOTTOM]: 'top_to_bottom',
      [SpinDirection.BOTTOM_TO_TOP]: 'bottom_to_top',
      [SpinDirection.LEFT_TO_RIGHT]: 'left_to_right',
      [SpinDirection.RIGHT_TO_LEFT]: 'right_to_left',
      [SpinDirection.ZOOM_IN]: 'zoom_in',
      [SpinDirection.ZOOM_OUT]: 'zoom_out',
      [SpinDirection.SPIRAL_IN]: 'spiral_in',
      [SpinDirection.SPIRAL_OUT]: 'spiral_out',
      [SpinDirection.FADE_SHUFFLE]: 'fade_shuffle',
      [SpinDirection.FLIP_HORIZONTAL]: 'flip_horizontal',
      [SpinDirection.FLIP_VERTICAL]: 'flip_vertical',
    };
    
    return this.get(mapping[direction], config);
  }

  /**
   * Set the default strategy
   */
  public setDefault(id: string): void {
    if (!this.strategies.has(id)) {
      console.warn(`[SpinStrategyRegistry] Cannot set default - strategy not found: ${id}`);
      return;
    }
    this.defaultStrategyId = id;
  }

  /**
   * Get the default strategy
   */
  public getDefault(config?: Partial<SpinConfig>): ISpinStrategy {
    return this.get(this.defaultStrategyId, config) || new TopToBottomStrategy(config);
  }

  /**
   * Set current active strategy for the game
   */
  public setCurrent(strategy: ISpinStrategy): void {
    this.currentStrategy = strategy;
  }

  /**
   * Get current active strategy
   */
  public getCurrent(): ISpinStrategy | null {
    return this.currentStrategy;
  }

  /**
   * List all registered strategy IDs
   */
  public list(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if a strategy exists
   */
  public has(id: string): boolean {
    return this.strategies.has(id);
  }

  /**
   * Get strategy info
   */
  public getInfo(): Array<{ id: string; direction: SpinDirection }> {
    return this.list().map(id => {
      const strategy = this.get(id);
      return {
        id,
        direction: strategy?.direction || SpinDirection.TOP_TO_BOTTOM,
      };
    });
  }

  /**
   * Create strategies for all reels with proper cloning
   */
  public createForReels(id: string, reelCount: number, config?: Partial<SpinConfig>): ISpinStrategy[] {
    const strategies: ISpinStrategy[] = [];
    const baseStrategy = this.get(id, config);
    
    if (!baseStrategy) {
      // Fallback to default
      for (let i = 0; i < reelCount; i++) {
        strategies.push(new TopToBottomStrategy(config));
      }
      return strategies;
    }
    
    for (let i = 0; i < reelCount; i++) {
      strategies.push(baseStrategy.clone());
    }
    
    return strategies;
  }

  public static reset(): void {
    SpinStrategyRegistry.instance = null;
  }
}
