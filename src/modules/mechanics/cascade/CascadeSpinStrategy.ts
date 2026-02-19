/**
 * CascadeSpinStrategy - Symbols fall and disappear with gravity
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from '../standard/SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';
import { GravityResolver } from './GravityResolver';

export class CascadeSpinStrategy extends SpinStrategyBase {
  public readonly id = 'cascade';
  public readonly direction = SpinDirection.TOP_TO_BOTTOM;
  
  private gravityResolver: GravityResolver;
  private cascadePhase: 'dropping' | 'settling' | 'complete' = 'complete';
  private dropPositions: Map<number, number> = new Map();

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.TOP_TO_BOTTOM });
    this.gravityResolver = new GravityResolver();
  }

  public override onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    this.cascadePhase = 'dropping';
    this.dropPositions.clear();
    
    // Initialize drop positions for each symbol
    for (let i = 0; i < container.children.length; i++) {
      this.dropPositions.set(i, -context.cellHeight * (i + 1));
    }
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    switch (this.cascadePhase) {
      case 'dropping':
        return this.updateDropping(container, context);
      case 'settling':
        return this.updateSettling(container, context);
      case 'complete':
        return false;
    }

    return true;
  }

  private updateDropping(container: Container, context: SpinContext): boolean {
    const gravity = 2.5;
    const cellHeight = context.cellHeight + context.spacing;
    let allLanded = true;

    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i];
      const targetY = Math.floor(i / context.totalReels) * cellHeight;
      
      if (child.y < targetY) {
        child.y += this.speed * context.deltaTime * gravity;
        if (child.y > targetY) {
          child.y = targetY;
        } else {
          allLanded = false;
        }
      }
    }

    this.accelerate(context.deltaTime);

    if (allLanded) {
      this.cascadePhase = 'settling';
    }

    return true;
  }

  private updateSettling(container: Container, context: SpinContext): boolean {
    // Apply bounce effect
    if (this.elapsedTime < this.config.settleDuration) {
      const bounceProgress = this.elapsedTime / this.config.settleDuration;
      const bounce = Math.sin(bounceProgress * Math.PI * 2) * this.config.bounceStrength * (1 - bounceProgress);
      
      for (const child of container.children) {
        child.y += bounce;
      }
      return true;
    }

    this.cascadePhase = 'complete';
    this.isFinished = true;
    this.isActive = false;
    return false;
  }

  public calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number } {
    const cellHeight = context.cellHeight + context.spacing;
    const row = Math.floor(symbolIndex / context.totalReels);
    
    return {
      x: 0,
      y: row * cellHeight,
      scale: 1,
      alpha: 1,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    // Cascade uses column-based stagger
    return reelIndex * (this.config.staggerDelay * 0.5);
  }

  public clone(): ISpinStrategy {
    return new CascadeSpinStrategy({ ...this.config });
  }
}
