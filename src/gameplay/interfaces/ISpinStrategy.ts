/**
 * ISpinStrategy - Interface for pluggable spin animations
 */

import { Container } from 'pixi.js';

export enum SpinDirection {
  TOP_TO_BOTTOM = 'top_to_bottom',
  BOTTOM_TO_TOP = 'bottom_to_top',
  LEFT_TO_RIGHT = 'left_to_right',
  RIGHT_TO_LEFT = 'right_to_left',
  ZOOM_IN = 'zoom_in',
  ZOOM_OUT = 'zoom_out',
  SPIRAL_IN = 'spiral_in',
  SPIRAL_OUT = 'spiral_out',
  FADE_SHUFFLE = 'fade_shuffle',
  FLIP_HORIZONTAL = 'flip_horizontal',
  FLIP_VERTICAL = 'flip_vertical',
}

export interface SpinConfig {
  direction: SpinDirection;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  bounceStrength: number;
  staggerDelay: number;
  anticipationDuration: number;
  settleDuration: number;
}

export interface SpinContext {
  reelIndex: number;
  totalReels: number;
  rowIndex: number;
  totalRows: number;
  cellWidth: number;
  cellHeight: number;
  spacing: number;
  deltaTime: number;
  elapsedTime: number;
  phase: 'anticipation' | 'accelerating' | 'spinning' | 'decelerating' | 'settling' | 'stopped';
}

export interface ISpinStrategy {
  readonly id: string;
  readonly direction: SpinDirection;
  
  /**
   * Initialize the strategy with config
   */
  initialize(config: Partial<SpinConfig>): void;
  
  /**
   * Called when spin starts - setup initial state
   */
  onSpinStart(container: Container, context: SpinContext): void;
  
  /**
   * Update animation each frame
   * Returns true if still animating, false if complete
   */
  update(container: Container, context: SpinContext): boolean;
  
  /**
   * Called when stopping with target symbols
   */
  onSpinStop(container: Container, context: SpinContext, targetSymbols: string[]): void;
  
  /**
   * Calculate symbol position during spin
   */
  calculateSymbolPosition(
    symbolIndex: number,
    context: SpinContext,
    speed: number
  ): { x: number; y: number; scale: number; alpha: number; rotation: number };
  
  /**
   * Get current speed
   */
  getSpeed(): number;
  
  /**
   * Check if spinning is complete
   */
  isComplete(): boolean;
  
  /**
   * Reset strategy state
   */
  reset(): void;
  
  /**
   * Get stagger delay for this reel
   */
  getStaggerDelay(reelIndex: number, totalReels: number): number;
  
  /**
   * Clone strategy for independent reel usage
   */
  clone(): ISpinStrategy;
}

export const DEFAULT_SPIN_CONFIG: SpinConfig = {
  direction: SpinDirection.TOP_TO_BOTTOM,
  maxSpeed: 40,
  acceleration: 3,
  deceleration: 5,
  bounceStrength: 0.3,
  staggerDelay: 100,
  anticipationDuration: 100,
  settleDuration: 200,
};
