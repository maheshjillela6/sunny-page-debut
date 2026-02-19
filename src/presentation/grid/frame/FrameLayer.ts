/**
 * FrameLayer - Orchestrator for the Grid Frame plugin system.
 *
 * Loads frame config (shared defaults + game overrides), selects the
 * appropriate plugin (code or image), and manages lifecycle events.
 *
 * FrameLayer does NOT control sequencing — it only responds to lifecycle
 * events via EventBus bindings.
 */

import { Container } from 'pixi.js';
import { EventBus } from '@/platform/events/EventBus';
import { LayerConfigManager } from '@/presentation/layers/config/LayerConfigManager';
import type { GridConfig } from '@/presentation/grid/GridManager';
import type { GridFrameConfig } from './types/GridFrameConfig';
import type { IGridFramePlugin } from './types/IGridFramePlugin';
import { CodeBasedFramePlugin } from './plugins/CodeBasedFramePlugin';
import { ImageFramePlugin } from './plugins/ImageFramePlugin';

/** Registry of custom plugin factories */
const pluginRegistry: Map<string, () => IGridFramePlugin> = new Map();

export function registerFramePlugin(type: string, factory: () => IGridFramePlugin): void {
  pluginRegistry.set(type, factory);
}

export class FrameLayer {
  private plugin: IGridFramePlugin | null = null;
  private config: GridFrameConfig | null = null;
  private gridConfig: GridConfig | null = null;
  private root: Container = new Container();
  private eventBus: EventBus = EventBus.getInstance();
  private cfgManager: LayerConfigManager = LayerConfigManager.getInstance();
  private boundCleanups: Array<() => void> = [];

  constructor() {
    this.root.label = 'FrameLayer';
    this.root.sortableChildren = true;
  }

  // ── Initialization ────────────────────────────────────────────────────────

  public async initialize(gridConfig: GridConfig): Promise<void> {
    this.gridConfig = gridConfig;

    // Load merged config (shared defaults <- game overrides)
    this.config = await this.cfgManager.getLayerConfig<GridFrameConfig>('gridFrame.layer.json');

    if (!this.config || this.config.enabled === false) {
      this.root.visible = false;
      return;
    }

    // Select & build plugin
    this.createPlugin(this.config.type ?? 'code');
    this.plugin!.build(this.config, gridConfig);
    this.root.addChild(this.plugin!.getDisplayObject());

    // Bind lifecycle events
    this.bindLifecycleEvents();

    // Start idle animations
    this.plugin!.triggerAnimation('idle');
  }

  // ── Plugin selection ──────────────────────────────────────────────────────

  private createPlugin(type: string): void {
    // Destroy existing
    if (this.plugin) {
      this.plugin.destroy();
      this.root.removeChildren();
    }

    // Check custom registry first
    const customFactory = pluginRegistry.get(type);
    if (customFactory) {
      this.plugin = customFactory();
      return;
    }

    // Built-in types
    switch (type) {
      case 'image':
        this.plugin = new ImageFramePlugin();
        break;
      case 'code':
      default:
        this.plugin = new CodeBasedFramePlugin();
        break;
    }
  }

  // ── Lifecycle event bindings ──────────────────────────────────────────────

  private bindLifecycleEvents(): void {
    this.unbindEvents();

    const bind = <K extends keyof import('@/platform/events/EventMap').EventMap>(
      event: K,
      lifecycle: string,
    ) => {
      const subId = this.eventBus.on(event, () => this.plugin?.triggerAnimation(lifecycle));
      this.boundCleanups.push(() => this.eventBus.off(subId));
    };

    bind('game:spin:start', 'spin');
    bind('game:win:detected', 'win');
    bind('game:spin:complete', 'idle');
    bind('feature:start', 'feature');
    bind('feature:end', 'idle');

    // Grid relayout
    const relayoutSubId = this.eventBus.on('game:update', (payload) => {
      if ((payload as any)?.data?.config) {
        this.resize((payload as any).data.config);
      }
    });
    this.boundCleanups.push(() => this.eventBus.off(relayoutSubId));
  }

  private unbindEvents(): void {
    for (const cleanup of this.boundCleanups) cleanup();
    this.boundCleanups = [];
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Resize frame to match new grid dimensions */
  public resize(gridConfig: GridConfig): void {
    this.gridConfig = gridConfig;
    this.plugin?.resize(gridConfig);
  }

  /** Switch variant on a named container (code-based) or whole frame (image-based) */
  public setVariant(containerName: string, variantName: string): boolean {
    return this.plugin?.setVariant(containerName, variantName) ?? false;
  }

  /** Enable / disable a sub-container */
  public setContainerEnabled(name: string, enabled: boolean): void {
    this.plugin?.setContainerEnabled(name, enabled);
  }

  /** Swap the entire plugin at runtime (e.g. switch from code to image) */
  public async switchPluginType(type: string): Promise<void> {
    if (!this.config || !this.gridConfig) return;
    this.createPlugin(type);
    this.plugin!.build(this.config, this.gridConfig);
    this.root.addChild(this.plugin!.getDisplayObject());
    this.plugin!.triggerAnimation('idle');
  }

  /** Per-frame update */
  public update(deltaTime: number): void {
    this.plugin?.update(deltaTime);
  }

  /** Get the display object to add to the scene */
  public getDisplayObject(): Container {
    return this.root;
  }

  /** Get the active plugin */
  public getPlugin(): IGridFramePlugin | null {
    return this.plugin;
  }

  /** Clean up everything */
  public destroy(): void {
    this.unbindEvents();
    this.plugin?.destroy();
    this.plugin = null;
    this.root.destroy({ children: true });
  }
}
