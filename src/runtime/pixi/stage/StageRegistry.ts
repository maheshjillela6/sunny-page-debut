/**
 * StageRegistry - Registry for named stage elements
 */

import { Container } from 'pixi.js';

export interface RegisteredElement {
  name: string;
  container: Container;
  tags: string[];
  registeredAt: number;
}

/**
 * Registry for named stage elements for easy lookup.
 */
export class StageRegistry {
  private static instance: StageRegistry | null = null;
  private elements: Map<string, RegisteredElement> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  private constructor() {}

  /** Get singleton instance */
  public static getInstance(): StageRegistry {
    if (!StageRegistry.instance) {
      StageRegistry.instance = new StageRegistry();
    }
    return StageRegistry.instance;
  }

  /** Register an element */
  public register(name: string, container: Container, tags: string[] = []): void {
    if (this.elements.has(name)) {
      console.warn(`[StageRegistry] Element ${name} already registered, replacing`);
      this.unregister(name);
    }

    const element: RegisteredElement = {
      name,
      container,
      tags,
      registeredAt: Date.now(),
    };

    this.elements.set(name, element);

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(name);
    }
  }

  /** Unregister an element */
  public unregister(name: string): boolean {
    const element = this.elements.get(name);
    if (!element) return false;

    // Remove from tag index
    for (const tag of element.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(name);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    this.elements.delete(name);
    return true;
  }

  /** Get an element by name */
  public get(name: string): Container | undefined {
    return this.elements.get(name)?.container;
  }

  /** Get elements by tag */
  public getByTag(tag: string): Container[] {
    const names = this.tagIndex.get(tag);
    if (!names) return [];

    return Array.from(names)
      .map(name => this.elements.get(name)?.container)
      .filter((c): c is Container => c !== undefined);
  }

  /** Check if element exists */
  public has(name: string): boolean {
    return this.elements.has(name);
  }

  /** Get all registered names */
  public getNames(): string[] {
    return Array.from(this.elements.keys());
  }

  /** Get all tags */
  public getTags(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  /** Clear registry */
  public clear(): void {
    this.elements.clear();
    this.tagIndex.clear();
  }

  /** Destroy registry */
  public destroy(): void {
    this.clear();
    StageRegistry.instance = null;
  }
}
