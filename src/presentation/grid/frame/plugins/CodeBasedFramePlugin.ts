/**
 * CodeBasedFramePlugin - Programmatic grid frame built from sub-containers.
 *
 * Manages: BackgroundContainer, FrameBorderContainer, ColumnSeparatorContainer,
 * RowSeparatorContainer, EffectContainer, AnimationContainer.
 *
 * All visuals are config-driven. Supports runtime variant switching and
 * lifecycle-bound animations.
 */

import { Container } from 'pixi.js';
import type { IGridFramePlugin } from '../types/IGridFramePlugin';
import type { GridFrameConfig, CodeFrameConfig, FrameContainerConfig } from '../types/GridFrameConfig';
import type { GridConfig } from '@/presentation/grid/GridManager';
import { FrameSubContainer } from '../containers/FrameSubContainer';
import { BackgroundContainer } from '../containers/BackgroundContainer';
import { FrameBorderContainer } from '../containers/FrameBorderContainer';
import { ColumnSeparatorContainer } from '../containers/ColumnSeparatorContainer';
import { RowSeparatorContainer } from '../containers/RowSeparatorContainer';
import { EffectContainer } from '../containers/EffectContainer';
import { AnimationContainer } from '../containers/AnimationContainer';

const DEFAULT_RENDER_ORDER = [
  'background',
  'effect',
  'frameBorder',
  'columnSeparator',
  'rowSeparator',
  'animation',
];

export class CodeBasedFramePlugin implements IGridFramePlugin {
  readonly id = 'code-frame';

  private root: Container = new Container();
  private containers: Map<string, FrameSubContainer> = new Map();
  private currentConfig: GridFrameConfig | null = null;

  constructor() {
    this.root.label = 'CodeBasedFrame';
    this.root.sortableChildren = true;
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  public build(config: GridFrameConfig, gridConfig: GridConfig): void {
    this.currentConfig = config;
    this.destroyContainers();

    const code = config.code;
    if (!code) return;

    const order = config.renderOrder ?? DEFAULT_RENDER_ORDER;

    // Create containers
    this.createIfDefined('background', code.background, () => new BackgroundContainer());
    this.createIfDefined('frameBorder', code.frameBorder, () => new FrameBorderContainer());
    this.createIfDefined('columnSeparator', code.columnSeparator, () => new ColumnSeparatorContainer());
    this.createIfDefined('rowSeparator', code.rowSeparator, () => new RowSeparatorContainer());
    this.createIfDefined('effect', code.effect, () => new EffectContainer());
    this.createIfDefined('animation', code.animation, () => new AnimationContainer());

    // Set zIndex from render order
    for (const [name, container] of this.containers) {
      const idx = order.indexOf(name);
      container.zIndex = idx >= 0 ? idx : 99;
      this.root.addChild(container);
    }

    // Apply padding offset
    if (config.padding) {
      this.root.x = -(config.padding.left ?? 0);
      this.root.y = -(config.padding.top ?? 0);
    }

    // Layout all containers
    for (const c of this.containers.values()) {
      c.layout(gridConfig);
    }
  }

  private createIfDefined<V>(
    name: string,
    cfg: FrameContainerConfig<V> | undefined,
    factory: () => FrameSubContainer<V>,
  ): void {
    if (!cfg) return;

    const container = factory();
    container.setEnabled(cfg.enabled !== false);

    if (typeof cfg.zIndex === 'number') container.zIndex = cfg.zIndex;
    if (cfg.variants) container.setVariants(cfg.variants, cfg.activeVariant);
    if (cfg.animations) container.setAnimationBindings(cfg.animations);

    this.containers.set(name, container);
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  public resize(gridConfig: GridConfig): void {
    for (const c of this.containers.values()) {
      c.layout(gridConfig);
    }
  }

  // ── Variant switching ─────────────────────────────────────────────────────

  public setVariant(containerName: string, variantName: string): boolean {
    const c = this.containers.get(containerName);
    if (!c) return false;
    return c.switchVariant(variantName);
  }

  // ── Animation lifecycle ───────────────────────────────────────────────────

  public triggerAnimation(lifecycle: string): void {
    for (const c of this.containers.values()) {
      c.triggerAnimation(lifecycle);
    }
  }

  public stopAnimations(): void {
    for (const c of this.containers.values()) {
      c.stopAllTweens();
    }
  }

  // ── Enable / Disable ──────────────────────────────────────────────────────

  public setContainerEnabled(name: string, enabled: boolean): void {
    const c = this.containers.get(name);
    if (c) c.setEnabled(enabled);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  public update(deltaTime: number): void {
    for (const c of this.containers.values()) {
      if (c.isEnabled()) c.update(deltaTime);
    }
  }

  // ── Display object ────────────────────────────────────────────────────────

  public getDisplayObject(): Container {
    return this.root;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private destroyContainers(): void {
    for (const c of this.containers.values()) {
      c.destroy();
    }
    this.containers.clear();
    this.root.removeChildren();
  }

  public destroy(): void {
    this.destroyContainers();
    this.root.destroy({ children: true });
  }
}
