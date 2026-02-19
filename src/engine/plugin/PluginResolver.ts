/**
 * PluginResolver - Resolves plugin dependencies
 */

import { SlotPlugin } from './SlotPlugin';
import { PluginRegistry } from './PluginRegistry';

export interface DependencyNode {
  pluginId: string;
  dependencies: string[];
  resolved: boolean;
}

export class PluginResolver {
  private registry: PluginRegistry;

  constructor() {
    this.registry = PluginRegistry.getInstance();
  }

  public resolve(pluginId: string): string[] {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const resolved: string[] = [];
    const visited = new Set<string>();

    this.resolveDependencies(pluginId, resolved, visited);

    return resolved;
  }

  private resolveDependencies(
    pluginId: string,
    resolved: string[],
    visited: Set<string>
  ): void {
    if (visited.has(pluginId)) {
      if (!resolved.includes(pluginId)) {
        throw new Error(`Circular dependency detected: ${pluginId}`);
      }
      return;
    }

    visited.add(pluginId);

    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      throw new Error(`Missing dependency: ${pluginId}`);
    }

    for (const depId of plugin.dependencies) {
      this.resolveDependencies(depId, resolved, visited);
    }

    if (!resolved.includes(pluginId)) {
      resolved.push(pluginId);
    }
  }

  public resolveAll(): string[] {
    const allPlugins = this.registry.getAll();
    const resolved: string[] = [];
    const visited = new Set<string>();

    for (const plugin of allPlugins) {
      this.resolveDependencies(plugin.id, resolved, visited);
    }

    return resolved;
  }

  public checkCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const allPlugins = this.registry.getAll();

    for (const plugin of allPlugins) {
      const cycle = this.findCycle(plugin.id, [], new Set());
      if (cycle.length > 0) {
        cycles.push(cycle);
      }
    }

    return cycles;
  }

  private findCycle(
    pluginId: string,
    path: string[],
    visited: Set<string>
  ): string[] {
    if (path.includes(pluginId)) {
      return [...path.slice(path.indexOf(pluginId)), pluginId];
    }

    if (visited.has(pluginId)) {
      return [];
    }

    visited.add(pluginId);
    path.push(pluginId);

    const plugin = this.registry.get(pluginId);
    if (plugin) {
      for (const depId of plugin.dependencies) {
        const cycle = this.findCycle(depId, [...path], visited);
        if (cycle.length > 0) {
          return cycle;
        }
      }
    }

    return [];
  }

  public getMissingDependencies(): Map<string, string[]> {
    const missing = new Map<string, string[]>();
    const allPlugins = this.registry.getAll();

    for (const plugin of allPlugins) {
      const missingDeps = plugin.dependencies.filter(
        (depId) => !this.registry.has(depId)
      );
      if (missingDeps.length > 0) {
        missing.set(plugin.id, missingDeps);
      }
    }

    return missing;
  }
}

export default PluginResolver;
