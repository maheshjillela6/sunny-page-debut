/**
 * GravityResolver - Handles gravity-based symbol movement
 */

export interface GravityConfig {
  gravity: number;
  maxVelocity: number;
  bounceCoefficient: number;
  friction: number;
}

export interface SymbolPhysics {
  index: number;
  x: number;
  y: number;
  velocityY: number;
  targetY: number;
  isLanded: boolean;
}

export class GravityResolver {
  private config: GravityConfig;
  private symbols: Map<number, SymbolPhysics> = new Map();

  constructor(config: Partial<GravityConfig> = {}) {
    this.config = {
      gravity: config.gravity ?? 980,
      maxVelocity: config.maxVelocity ?? 2000,
      bounceCoefficient: config.bounceCoefficient ?? 0.3,
      friction: config.friction ?? 0.95,
    };
  }

  public initialize(symbolCount: number, cellHeight: number, spacing: number): void {
    this.symbols.clear();
    
    for (let i = 0; i < symbolCount; i++) {
      const targetY = i * (cellHeight + spacing);
      this.symbols.set(i, {
        index: i,
        x: 0,
        y: -cellHeight * (i + 2), // Start above the grid
        velocityY: 0,
        targetY,
        isLanded: false,
      });
    }
  }

  public update(deltaTime: number): boolean {
    let allLanded = true;

    for (const [index, physics] of this.symbols) {
      if (physics.isLanded) continue;

      // Apply gravity
      physics.velocityY += this.config.gravity * deltaTime;
      physics.velocityY = Math.min(physics.velocityY, this.config.maxVelocity);

      // Update position
      physics.y += physics.velocityY * deltaTime;

      // Check for landing
      if (physics.y >= physics.targetY) {
        physics.y = physics.targetY;
        
        // Apply bounce
        if (Math.abs(physics.velocityY) > 50) {
          physics.velocityY = -physics.velocityY * this.config.bounceCoefficient;
        } else {
          physics.velocityY = 0;
          physics.isLanded = true;
        }
      }

      if (!physics.isLanded) {
        allLanded = false;
      }
    }

    return !allLanded;
  }

  public getSymbolPosition(index: number): { x: number; y: number } | null {
    const physics = this.symbols.get(index);
    if (!physics) return null;
    return { x: physics.x, y: physics.y };
  }

  public getAllPositions(): SymbolPhysics[] {
    return Array.from(this.symbols.values());
  }

  public isComplete(): boolean {
    for (const physics of this.symbols.values()) {
      if (!physics.isLanded) return false;
    }
    return true;
  }

  public reset(): void {
    this.symbols.clear();
  }

  public setConfig(config: Partial<GravityConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
