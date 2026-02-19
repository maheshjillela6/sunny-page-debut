/**
 * SpinStrategyBase - Abstract base class for spin strategies
 * All timing/physics values come from ConfigManager - no hardcoded values
 */

import { Container } from 'pixi.js';
import { 
  ISpinStrategy, 
  SpinConfig, 
  SpinContext, 
  SpinDirection,
  DEFAULT_SPIN_CONFIG 
} from '../../../gameplay/interfaces/ISpinStrategy';
import { ConfigManager } from '../../../content/ConfigManager';

export abstract class SpinStrategyBase implements ISpinStrategy {
  public abstract readonly id: string;
  public abstract readonly direction: SpinDirection;
  
  protected config: SpinConfig;
  protected speed: number = 0;
  protected isActive: boolean = false;
  protected isStopping: boolean = false;
  protected isFinished: boolean = false;
  protected spinDistance: number = 0;
  protected elapsedTime: number = 0;
  protected targetSymbols: string[] = [];
  protected stopStartTime: number = 0;
  protected initialStopSpeed: number = 0;
  protected accumulator: number = 0; // Sub-pixel accumulator

  // These come from config - not hardcoded
  protected stopDuration: number;
  protected minSpinTime: number;

  constructor(config: Partial<SpinConfig> = {}) {
    const configManager = ConfigManager.getInstance();
    const spinDefaults = configManager.getDefault('spin', {} as any);

    // Use config values with fallback to shared defaults, then to DEFAULT_SPIN_CONFIG
    this.config = { 
      ...DEFAULT_SPIN_CONFIG, 
      maxSpeed: config.maxSpeed ?? spinDefaults?.maxSpeed ?? 28,
      acceleration: config.acceleration ?? spinDefaults?.acceleration?.rate ?? 120,
      deceleration: config.deceleration ?? spinDefaults?.deceleration?.rate ?? 80,
      staggerDelay: config.staggerDelay ?? spinDefaults?.stagger?.delay ?? 80,
      bounceStrength: config.bounceStrength ?? spinDefaults?.settle?.bounceStrength ?? 0.3,
      anticipationDuration: config.anticipationDuration ?? spinDefaults?.anticipation?.duration ?? 50,
      settleDuration: config.settleDuration ?? spinDefaults?.settle?.duration ?? 200,
      ...config,
    };

    // Load timing values from config
    this.stopDuration = (spinDefaults?.deceleration?.duration ?? 350) / 1000; // Convert ms to seconds
    this.minSpinTime = (spinDefaults?.minSpinTime ?? 500) / 1000; // Convert ms to seconds
  }

  public initialize(config: Partial<SpinConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public onSpinStart(container: Container, context: SpinContext): void {
    this.isActive = true;
    this.isStopping = false;
    this.isFinished = false;
    this.speed = 0.5; // Start with tiny speed for smooth ramp
    this.spinDistance = 0;
    this.elapsedTime = 0;
    this.targetSymbols = [];
    this.stopStartTime = 0;
    this.initialStopSpeed = 0;
    this.accumulator = 0;
  }

  public abstract update(container: Container, context: SpinContext): boolean;

  public onSpinStop(container: Container, context: SpinContext, targetSymbols: string[]): void {
    this.isStopping = true;
    this.targetSymbols = targetSymbols;
    this.stopStartTime = this.elapsedTime;
    this.initialStopSpeed = this.speed;
  }

  public abstract calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number };

  public getSpeed(): number {
    return this.speed;
  }

  public isComplete(): boolean {
    return this.isFinished;
  }

  public reset(): void {
    this.speed = 0;
    this.isActive = false;
    this.isStopping = false;
    this.isFinished = false;
    this.spinDistance = 0;
    this.elapsedTime = 0;
    this.targetSymbols = [];
    this.stopStartTime = 0;
    this.initialStopSpeed = 0;
    this.accumulator = 0;
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    return reelIndex * this.config.staggerDelay;
  }

  public abstract clone(): ISpinStrategy;

  /**
   * Smooth acceleration using critically damped spring
   * Provides buttery smooth ramp-up without overshoot
   */
  protected accelerate(deltaTime: number): void {
    if (this.speed < this.config.maxSpeed) {
      // Use critically damped spring for ultra-smooth acceleration
      const targetSpeed = this.config.maxSpeed;
      const dampingRatio = 0.8; // Slightly underdamped for natural feel
      const naturalFrequency = this.config.acceleration * 0.05;
      
      const diff = targetSpeed - this.speed;
      const springForce = naturalFrequency * naturalFrequency * diff;
      const dampingForce = 2 * dampingRatio * naturalFrequency * (diff * deltaTime);
      
      this.speed += (springForce + dampingForce) * deltaTime;
      
      // Clamp to prevent overshoot
      if (this.speed >= targetSpeed * 0.998) {
        this.speed = targetSpeed;
      }
    }
  }

  /**
   * Smooth deceleration with natural easing
   * Uses time-based interpolation for consistent timing
   */
  protected decelerate(deltaTime: number): void {
    if (this.speed > 0) {
      const elapsed = this.elapsedTime - this.stopStartTime;
      const progress = Math.min(elapsed / this.stopDuration, 1);
      
      if (progress >= 1) {
        this.speed = 0;
        this.isFinished = true;
        this.isActive = false;
        return;
      }
      
      // Use smootherstep for ultra-smooth deceleration
      const easedProgress = this.smootherstep(progress);
      this.speed = this.initialStopSpeed * (1 - easedProgress);
      
      // Apply bounce effect at the end for natural reel stop
      if (progress > 0.85) {
        const bounceProgress = (progress - 0.85) / 0.15;
        const bounce = Math.sin(bounceProgress * Math.PI) * this.config.bounceStrength * 2;
        this.speed = Math.max(0, this.speed - bounce);
      }
      
      // Finish when speed is negligible
      if (this.speed < 0.01) {
        this.speed = 0;
        this.isFinished = true;
        this.isActive = false;
      }
    }
  }

  /**
   * Apply movement with sub-pixel precision using linear interpolation
   * Ensures pixel-perfect rendering without jitter
   */
  protected applyMovement(container: Container, movement: number): number {
    this.accumulator += movement;
    
    // Use sub-pixel precision for smooth rendering
    // Only round at the final display stage, keep accumulator precise
    const pixelMovement = Math.floor(this.accumulator * 100) / 100;
    
    if (Math.abs(pixelMovement) > 0.01) {
      this.accumulator -= pixelMovement;
      
      for (const child of container.children) {
        // Apply transform with sub-pixel precision
        child.y = Math.round((child.y + pixelMovement) * 100) / 100;
      }
    }
    
    return pixelMovement;
  }

  /**
   * Ease out quadratic - smooth deceleration curve
   */
  protected easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  /**
   * Ease out cubic - slightly faster deceleration
   */
  protected easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Ease out quart - even smoother
   */
  protected easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  protected easeOutBounce(t: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }

  protected easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : 
      Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  protected easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /**
   * Ease in out sine - very smooth
   */
  protected easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  /**
   * Hermite interpolation for extra smooth transitions
   */
  protected smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  /**
   * Smoother step - even better smoothness
   */
  protected smootherstep(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
}
