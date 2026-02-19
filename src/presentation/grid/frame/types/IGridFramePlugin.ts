/**
 * IGridFramePlugin - Plugin contract for grid frame implementations.
 *
 * Any frame plugin (code-based, image-based, or custom) must implement this
 * interface to be usable by FrameLayer. This allows swapping implementations
 * without changing GridLayer / GridContainer.
 */

import type { Container } from 'pixi.js';
import type { GridConfig } from '@/presentation/grid/GridManager';
import type { GridFrameConfig } from './GridFrameConfig';

export interface IGridFramePlugin {
  /** Unique plugin identifier */
  readonly id: string;

  /**
   * Build / rebuild the frame using the given config and grid dimensions.
   * Called once on init and again if grid resizes.
   */
  build(config: GridFrameConfig, gridConfig: GridConfig): void;

  /**
   * Update layout to match new grid dimensions without full rebuild.
   */
  resize(gridConfig: GridConfig): void;

  /**
   * Switch to a named variant at runtime (no rebuild).
   * Returns false if variant name is unknown.
   */
  setVariant(containerName: string, variantName: string): boolean;

  /**
   * Trigger lifecycle animations.
   */
  triggerAnimation(lifecycle: 'idle' | 'spin' | 'win' | 'feature' | string): void;

  /**
   * Stop all running animations.
   */
  stopAnimations(): void;

  /**
   * Enable / disable a specific sub-container by name.
   */
  setContainerEnabled(name: string, enabled: boolean): void;

  /**
   * Per-frame update – only active containers should process.
   */
  update(deltaTime: number): void;

  /**
   * The root display object to add to the scene graph.
   */
  getDisplayObject(): Container;

  /**
   * Clean up all resources.
   */
  destroy(): void;
}
