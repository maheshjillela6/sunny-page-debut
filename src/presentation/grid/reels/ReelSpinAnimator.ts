/**
 * ReelSpinAnimator - Handles smooth reel spinning animation with proper physics
 */

import { ReelStripView } from './ReelStripView';

export class ReelSpinAnimator {
  private reel: ReelStripView;
  private speed: number = 0;
  private maxSpeed: number = 30; // Pixels per frame at 60fps
  private acceleration: number = 1.5; // Smooth acceleration
  private isActive: boolean = false;
  private spinDistance: number = 0;
  private targetSpeed: number = 0;
  private accumulator: number = 0;

  constructor(reel: ReelStripView) {
    this.reel = reel;
  }

  public start(): void {
    this.isActive = true;
    this.speed = 0;
    this.targetSpeed = this.maxSpeed;
    this.spinDistance = 0;
    this.accumulator = 0;
  }

  public stop(): void {
    this.isActive = false;
    this.speed = 0;
    this.targetSpeed = 0;
  }

  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Smooth acceleration using exponential easing
    if (this.speed < this.targetSpeed) {
      const speedDiff = this.targetSpeed - this.speed;
      this.speed += speedDiff * Math.min(1, this.acceleration * deltaTime);
      
      // Snap to max when close enough
      if (this.speed >= this.targetSpeed * 0.99) {
        this.speed = this.targetSpeed;
      }
    }

    const config = this.reel.getConfig();
    const symbolContainer = this.reel.getSymbolContainer();
    const cellHeight = config.cellHeight + config.spacing;

    // Calculate movement with sub-pixel precision
    const movement = this.speed * deltaTime * 60; // Normalize to 60fps
    this.accumulator += movement;
    this.spinDistance += movement;

    // Apply movement with rounding for pixel-perfect rendering
    const roundedMovement = Math.round(this.accumulator * 100) / 100;
    
    for (const child of symbolContainer.children) {
      child.y += roundedMovement;
    }
    
    this.accumulator -= roundedMovement;

    // Recycle symbols that go off bottom
    const symbols = this.reel.getSymbols();
    if (symbols.length > 0 && symbols[0].y > cellHeight) {
      // Move all symbols up by one cell
      for (const symbol of symbols) {
        symbol.y -= cellHeight;
      }
      
      // Randomize the symbol that went off screen
      const lastSymbol = symbols[symbols.length - 1];
      if (lastSymbol) {
        lastSymbol.setRandomSymbol();
      }
    }
  }

  public getSpeed(): number {
    return this.speed;
  }

  public isAnimating(): boolean {
    return this.isActive;
  }

  public setMaxSpeed(speed: number): void {
    this.maxSpeed = speed;
    this.targetSpeed = speed;
  }
}
