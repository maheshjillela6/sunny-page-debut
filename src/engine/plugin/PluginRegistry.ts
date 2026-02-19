/**
 * PluginRegistry - Central registry for game plugins
 */

import { SlotPlugin, PluginPriority } from './SlotPlugin';

export class PluginRegistry {
  private static instance: PluginRegistry | null = null;

  private plugins: Map<string, SlotPlugin> = new Map();
  private loadOrder: string[] = [];

  private constructor() {}

  public static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  public register(plugin: SlotPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginRegistry] Plugin already registered: ${plugin.id}`);
      return;
    }

    this.plugins.set(plugin.id, plugin);
    this.recalculateLoadOrder();
    console.log(`[PluginRegistry] Registered plugin: ${plugin.id}`);
  }

  public unregister(pluginId: string): void {
    if (!this.plugins.has(pluginId)) {
      return;
    }

    this.plugins.delete(pluginId);
    this.recalculateLoadOrder();
    console.log(`[PluginRegistry] Unregistered plugin: ${pluginId}`);
  }

  public get(pluginId: string): SlotPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  public has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  public getAll(): SlotPlugin[] {
    return Array.from(this.plugins.values());
  }

  public getByPriority(priority: PluginPriority): SlotPlugin[] {
    return this.getAll().filter((p) => p.priority === priority);
  }

  public async loadAll(): Promise<void> {
    for (const pluginId of this.loadOrder) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        try {
          await plugin.onLoad();
          console.log(`[PluginRegistry] Loaded plugin: ${pluginId}`);
        } catch (error) {
          console.error(`[PluginRegistry] Failed to load plugin: ${pluginId}`, error);
        }
      }
    }
  }

  public async unloadAll(): Promise<void> {
    for (const pluginId of [...this.loadOrder].reverse()) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        try {
          await plugin.onUnload();
          console.log(`[PluginRegistry] Unloaded plugin: ${pluginId}`);
        } catch (error) {
          console.error(`[PluginRegistry] Failed to unload plugin: ${pluginId}`, error);
        }
      }
    }
  }

  public enableAll(): void {
    for (const plugin of this.plugins.values()) {
      plugin.enable();
    }
  }

  public disableAll(): void {
    for (const plugin of this.plugins.values()) {
      plugin.disable();
    }
  }

  private recalculateLoadOrder(): void {
    const plugins = this.getAll();

    plugins.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      if (a.dependencies.includes(b.id)) return 1;
      if (b.dependencies.includes(a.id)) return -1;

      return 0;
    });

    this.loadOrder = plugins.map((p) => p.id);
  }

  public getLoadOrder(): string[] {
    return [...this.loadOrder];
  }

  public clear(): void {
    this.plugins.clear();
    this.loadOrder = [];
  }
}

export default PluginRegistry;
