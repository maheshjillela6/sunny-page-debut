/**
 * PluggableReelAnimator - Uses pluggable spin strategies with config-driven timing
 * All timing values come from ConfigManager - no hardcoded values
 */

import { Container } from 'pixi.js';
import { ISpinStrategy, SpinContext, SpinConfig } from '../../../gameplay/interfaces/ISpinStrategy';
import { SpinStrategyRegistry } from '../../../modules/registry/SpinStrategyRegistry';
import { EventBus } from '../../../platform/events/EventBus';
import { ConfigManager } from '../../../content/ConfigManager';

export interface ReelAnimatorConfig {
  reelIndex: number;
  totalReels: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  spacing: number;
}

export class PluggableReelAnimator {
  private config: ReelAnimatorConfig;
  private strategy: ISpinStrategy;
  private container: Container | null = null;
  private eventBus: EventBus;
  private configManager: ConfigManager;
  private isActive: boolean = false;
  private elapsedTime: number = 0;
  private phase: SpinContext['phase'] = 'stopped';
  private targetSymbols: string[] = [];
  private lastUpdateTime: number = 0;
  private frameAccumulator: number = 0;
  
  // These come from config
  private fixedTimestep: number;
  private anticipationDuration: number;

  constructor(config: ReelAnimatorConfig, strategyId?: string) {
    this.config = config;
    this.eventBus = EventBus.getInstance();
    this.configManager = ConfigManager.getInstance();
    
    // Get timing config
    const engineConfig = this.configManager.getEngineConfig();
    this.fixedTimestep = engineConfig.fixedTimestep;
    
    // Get spin config for anticipation duration
    const spinConfig = this.configManager.getSpinConfig('baseGame');
    this.anticipationDuration = spinConfig?.anticipation?.duration ?? 50;
    
    const registry = SpinStrategyRegistry.getInstance();
    this.strategy = strategyId 
      ? registry.get(strategyId) || registry.getDefault()
      : registry.getDefault();
  }

  /**
   * Set the spin strategy
   */
  public setStrategy(strategyId: string, spinConfig?: Partial<SpinConfig>): void {
    const registry = SpinStrategyRegistry.getInstance();
    const newStrategy = registry.get(strategyId, spinConfig);
    
    if (newStrategy) {
      this.strategy = newStrategy;
      console.log(`[PluggableReelAnimator] Reel ${this.config.reelIndex} using strategy: ${strategyId}`);
    }
  }

  /**
   * Set strategy for a specific game mode
   */
  public setStrategyForMode(mode: string): void {
    const spinConfig = this.configManager.getSpinConfig(mode);
    if (spinConfig) {
      this.setStrategy(spinConfig.strategy, {
        maxSpeed: spinConfig.maxSpeed,
        acceleration: spinConfig.acceleration.rate,
        deceleration: spinConfig.deceleration.rate,
        bounceStrength: spinConfig.settle.bounceStrength,
        staggerDelay: spinConfig.stagger.delay,
        anticipationDuration: spinConfig.anticipation.duration,
        settleDuration: spinConfig.settle.duration,
      });
      this.anticipationDuration = spinConfig.anticipation.duration;
    }
  }

  /**
   * Set strategy instance directly
   */
  public setStrategyInstance(strategy: ISpinStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  public getStrategy(): ISpinStrategy {
    return this.strategy;
  }

  /**
   * Bind to a container
   */
  public bind(container: Container): void {
    this.container = container;
  }

  /**
   * Start spinning
   */
  public start(): void {
    if (!this.container) return;
    
    this.isActive = true;
    this.elapsedTime = 0;
    this.phase = 'anticipation';
    this.targetSymbols = [];
    this.lastUpdateTime = performance.now();
    this.frameAccumulator = 0;
    
    const context = this.createContext();
    this.strategy.onSpinStart(this.container, context);
    
    // Transition to accelerating after anticipation (duration from config)
    setTimeout(() => {
      if (this.isActive) {
        this.phase = 'accelerating';
      }
    }, this.anticipationDuration);
  }

  /**
   * Stop spinning with target symbols
   */
  public stop(targetSymbols: string[]): void {
    if (!this.container || !this.isActive) return;
    
    this.targetSymbols = targetSymbols;
    this.phase = 'decelerating';
    
    const context = this.createContext();
    this.strategy.onSpinStop(this.container, context, targetSymbols);
  }

  /**
   * Update animation with frame-rate independent timing
   */
  public update(deltaTime: number): void {
    if (!this.isActive || !this.container) return;

    // Use fixed timestep for consistent physics
    this.frameAccumulator += deltaTime;
    
    while (this.frameAccumulator >= this.fixedTimestep) {
      this.elapsedTime += this.fixedTimestep;
      
      const context = this.createContext();
      context.deltaTime = this.fixedTimestep;
      context.elapsedTime = this.elapsedTime;
      context.phase = this.phase;

      const stillAnimating = this.strategy.update(this.container, context);

      if (!stillAnimating && this.strategy.isComplete()) {
        this.phase = 'stopped';
        this.isActive = false;
        
        this.eventBus.emit('game:reel:spin:stop', {
          reelIndex: this.config.reelIndex,
          symbols: this.targetSymbols,
        });
        return;
      }
      
      this.frameAccumulator -= this.fixedTimestep;
    }
  }

  /**
   * Create spin context
   */
  private createContext(): SpinContext {
    return {
      reelIndex: this.config.reelIndex,
      totalReels: this.config.totalReels,
      rowIndex: 0,
      totalRows: this.config.rows,
      cellWidth: this.config.cellWidth,
      cellHeight: this.config.cellHeight,
      spacing: this.config.spacing,
      deltaTime: 0,
      elapsedTime: this.elapsedTime,
      phase: this.phase,
    };
  }

  /**
   * Get stagger delay for this reel
   */
  public getStaggerDelay(): number {
    return this.strategy.getStaggerDelay(
      this.config.reelIndex,
      this.config.totalReels
    );
  }

  /**
   * Check if currently animating
   */
  public isAnimating(): boolean {
    return this.isActive;
  }

  /**
   * Get current speed
   */
  public getSpeed(): number {
    return this.strategy.getSpeed();
  }

  /**
   * Force stop
   */
  public forceStop(): void {
    this.isActive = false;
    this.phase = 'stopped';
    this.frameAccumulator = 0;
    this.strategy.reset();
  }

  /**
   * Reset animator
   */
  public reset(): void {
    this.isActive = false;
    this.elapsedTime = 0;
    this.phase = 'stopped';
    this.targetSymbols = [];
    this.frameAccumulator = 0;
    this.strategy.reset();
  }
}
