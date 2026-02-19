/**
 * BaseContainer - Foundation container class
 * Extends Pixi Container with common functionality.
 */

import { Container, ContainerChild } from 'pixi.js';

export interface ContainerConfig {
  name?: string;
  x?: number;
  y?: number;
  alpha?: number;
  visible?: boolean;
  interactive?: boolean;
}

/**
 * Base container with common functionality for all game containers.
 */
export class BaseContainer extends Container {
  protected isInitialized: boolean = false;
  protected isActive: boolean = true;

  constructor(config: ContainerConfig = {}) {
    super();

    this.label = config.name || 'BaseContainer';
    this.x = config.x ?? 0;
    this.y = config.y ?? 0;
    this.alpha = config.alpha ?? 1;
    this.visible = config.visible ?? true;
    this.eventMode = config.interactive ? 'static' : 'passive';
  }

  /** Initialize the container */
  public init(): void {
    this.isInitialized = true;
  }

  /** Activate the container */
  public activate(): void {
    this.isActive = true;
    this.visible = true;
  }

  /** Deactivate the container */
  public deactivate(): void {
    this.isActive = false;
    this.visible = false;
  }

  /** Reset container to initial state */
  public reset(): void {
    this.x = 0;
    this.y = 0;
    this.alpha = 1;
    this.scale.set(1);
    this.rotation = 0;
    this.visible = true;
    this.isActive = true;
  }

  /** Update method called each frame */
  public update(deltaTime: number): void {
    // Override in subclasses
  }

  /** Set position */
  public setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  /** Set scale uniformly */
  public setScale(scale: number): this {
    this.scale.set(scale);
    return this;
  }

  /** Set alpha */
  public setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  /** Add child and return self for chaining */
  public addTo(parent: Container): this {
    parent.addChild(this as unknown as ContainerChild);
    return this;
  }

  /** Remove from parent */
  public removeFromParent(): this {
    if (this.parent) {
      this.parent.removeChild(this as unknown as ContainerChild);
    }
    return this;
  }

  /** Check if initialized */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /** Check if active */
  public getIsActive(): boolean {
    return this.isActive;
  }

  /** Destroy container */
  public override destroy(): void {
    this.isInitialized = false;
    this.isActive = false;
    super.destroy({ children: true });
  }
}
