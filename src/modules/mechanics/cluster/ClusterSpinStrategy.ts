/**
 * ClusterSpinStrategy - Cluster-based spin with connected symbols
 */

import { Container } from 'pixi.js';
import { SpinStrategyBase } from '../standard/SpinStrategyBase';
import { SpinConfig, SpinContext, SpinDirection, ISpinStrategy } from '../../../gameplay/interfaces/ISpinStrategy';
import { ClusterResolver } from './ClusterResolver';

export class ClusterSpinStrategy extends SpinStrategyBase {
  public readonly id = 'cluster';
  public readonly direction = SpinDirection.TOP_TO_BOTTOM;
  
  private clusterResolver: ClusterResolver;
  private explodingSymbols: Set<number> = new Set();
  private phase: 'spinning' | 'exploding' | 'refilling' | 'complete' = 'complete';

  constructor(config: Partial<SpinConfig> = {}) {
    super({ ...config, direction: SpinDirection.TOP_TO_BOTTOM });
    this.clusterResolver = new ClusterResolver();
  }

  public override onSpinStart(container: Container, context: SpinContext): void {
    super.onSpinStart(container, context);
    this.phase = 'spinning';
    this.explodingSymbols.clear();
  }

  public update(container: Container, context: SpinContext): boolean {
    if (!this.isActive) return false;

    this.elapsedTime += context.deltaTime;

    switch (this.phase) {
      case 'spinning':
        return this.updateSpinning(container, context);
      case 'exploding':
        return this.updateExploding(container, context);
      case 'refilling':
        return this.updateRefilling(container, context);
      case 'complete':
        return false;
    }
  }

  private updateSpinning(container: Container, context: SpinContext): boolean {
    if (this.isStopping) {
      this.decelerate(context.deltaTime);
      if (this.speed <= 0) {
        this.phase = 'complete';
        this.isFinished = true;
        this.isActive = false;
        return false;
      }
    } else {
      this.accelerate(context.deltaTime);
    }

    const cellHeight = context.cellHeight + context.spacing;
    const movement = this.speed * context.deltaTime;
    this.spinDistance += movement;

    for (const child of container.children) {
      child.y += movement;
    }

    return true;
  }

  private updateExploding(container: Container, context: SpinContext): boolean {
    let allExploded = true;

    for (let i = 0; i < container.children.length; i++) {
      if (this.explodingSymbols.has(i)) {
        const child = container.children[i];
        child.scale.x *= 0.95;
        child.scale.y *= 0.95;
        child.alpha *= 0.9;

        if (child.alpha > 0.01) {
          allExploded = false;
        }
      }
    }

    if (allExploded) {
      this.phase = 'refilling';
      this.elapsedTime = 0;
    }

    return true;
  }

  private updateRefilling(container: Container, context: SpinContext): boolean {
    const refillDuration = 300;
    const progress = Math.min(this.elapsedTime / refillDuration, 1);

    for (let i = 0; i < container.children.length; i++) {
      if (this.explodingSymbols.has(i)) {
        const child = container.children[i];
        child.scale.x = progress;
        child.scale.y = progress;
        child.alpha = progress;
      }
    }

    if (progress >= 1) {
      this.phase = 'complete';
      this.isFinished = true;
      this.isActive = false;
      return false;
    }

    return true;
  }

  public markClustersForExplosion(clusters: number[][]): void {
    this.explodingSymbols.clear();
    for (const cluster of clusters) {
      for (const index of cluster) {
        this.explodingSymbols.add(index);
      }
    }
    this.phase = 'exploding';
    this.elapsedTime = 0;
  }

  public calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number } {
    const cellHeight = context.cellHeight + context.spacing;
    
    return {
      x: 0,
      y: symbolIndex * cellHeight,
      scale: this.explodingSymbols.has(symbolIndex) ? 0 : 1,
      alpha: this.explodingSymbols.has(symbolIndex) ? 0 : 1,
      rotation: 0,
    };
  }

  public getStaggerDelay(reelIndex: number, totalReels: number): number {
    return reelIndex * this.config.staggerDelay;
  }

  public clone(): ISpinStrategy {
    return new ClusterSpinStrategy({ ...this.config });
  }
}
