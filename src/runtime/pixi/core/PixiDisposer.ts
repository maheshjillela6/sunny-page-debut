/**
 * PixiDisposer - Resource disposal management
 * Tracks and disposes of Pixi resources to prevent memory leaks.
 */

import { Container, Texture, Graphics, Sprite } from 'pixi.js';

export type DisposableResource = Container | Texture | Graphics | Sprite | { destroy: () => void };

interface TrackedResource {
  resource: DisposableResource;
  label: string;
  addedAt: number;
}

/**
 * Manages disposal of Pixi resources to prevent memory leaks.
 */
export class PixiDisposer {
  private resources: Map<string, TrackedResource> = new Map();
  private idCounter: number = 0;

  /**
   * Track a resource for disposal
   */
  public track<T extends DisposableResource>(resource: T, label: string = 'unnamed'): T {
    const id = `${label}_${this.idCounter++}`;
    
    this.resources.set(id, {
      resource,
      label,
      addedAt: Date.now(),
    });

    return resource;
  }

  /**
   * Dispose a specific resource by its tracking ID
   */
  public dispose(id: string): boolean {
    const tracked = this.resources.get(id);
    if (!tracked) return false;

    this.destroyResource(tracked.resource);
    this.resources.delete(id);
    return true;
  }

  /**
   * Dispose all resources matching a label pattern
   */
  public disposeByLabel(labelPattern: string | RegExp): number {
    let count = 0;
    const pattern = typeof labelPattern === 'string' 
      ? new RegExp(labelPattern) 
      : labelPattern;

    for (const [id, tracked] of this.resources) {
      if (pattern.test(tracked.label)) {
        this.destroyResource(tracked.resource);
        this.resources.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * Dispose all tracked resources
   */
  public disposeAll(): void {
    for (const tracked of this.resources.values()) {
      this.destroyResource(tracked.resource);
    }
    this.resources.clear();
    console.log('[PixiDisposer] All resources disposed');
  }

  /**
   * Get count of tracked resources
   */
  public getResourceCount(): number {
    return this.resources.size;
  }

  /**
   * Get all tracked resource labels
   */
  public getTrackedLabels(): string[] {
    return Array.from(this.resources.values()).map(r => r.label);
  }

  /**
   * Destroy a resource safely
   */
  private destroyResource(resource: DisposableResource): void {
    try {
      if ('destroy' in resource && typeof resource.destroy === 'function') {
        if (resource instanceof Container) {
          resource.destroy({ children: true, texture: false });
        } else if (resource instanceof Texture) {
          resource.destroy(true);
        } else {
          resource.destroy();
        }
      }
    } catch (error) {
      console.warn('[PixiDisposer] Error disposing resource:', error);
    }
  }
}
