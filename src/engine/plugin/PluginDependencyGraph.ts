/**
 * PluginDependencyGraph - Visualizes plugin dependencies
 */

import { PluginRegistry } from './PluginRegistry';

export interface GraphNode {
  id: string;
  dependencies: string[];
  dependents: string[];
  depth: number;
}

export class PluginDependencyGraph {
  private registry: PluginRegistry;
  private nodes: Map<string, GraphNode> = new Map();

  constructor() {
    this.registry = PluginRegistry.getInstance();
  }

  public build(): void {
    this.nodes.clear();

    const allPlugins = this.registry.getAll();

    for (const plugin of allPlugins) {
      this.nodes.set(plugin.id, {
        id: plugin.id,
        dependencies: [...plugin.dependencies],
        dependents: [],
        depth: 0,
      });
    }

    for (const [id, node] of this.nodes) {
      for (const depId of node.dependencies) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(id);
        }
      }
    }

    this.calculateDepths();
  }

  private calculateDepths(): void {
    const rootNodes = Array.from(this.nodes.values()).filter(
      (n) => n.dependencies.length === 0
    );

    for (const root of rootNodes) {
      this.setDepth(root, 0);
    }
  }

  private setDepth(node: GraphNode, depth: number): void {
    node.depth = Math.max(node.depth, depth);

    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        this.setDepth(depNode, depth + 1);
      }
    }
  }

  public getNode(pluginId: string): GraphNode | undefined {
    return this.nodes.get(pluginId);
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public getRootNodes(): GraphNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.dependencies.length === 0
    );
  }

  public getLeafNodes(): GraphNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.dependents.length === 0
    );
  }

  public getNodesByDepth(depth: number): GraphNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.depth === depth);
  }

  public getMaxDepth(): number {
    let max = 0;
    for (const node of this.nodes.values()) {
      max = Math.max(max, node.depth);
    }
    return max;
  }

  public toAscii(): string {
    const lines: string[] = [];
    const maxDepth = this.getMaxDepth();

    for (let depth = 0; depth <= maxDepth; depth++) {
      const nodes = this.getNodesByDepth(depth);
      const indent = '  '.repeat(depth);
      for (const node of nodes) {
        lines.push(`${indent}├─ ${node.id}`);
      }
    }

    return lines.join('\n');
  }
}

export default PluginDependencyGraph;
