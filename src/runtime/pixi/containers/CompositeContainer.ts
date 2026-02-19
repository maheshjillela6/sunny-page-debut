/**
 * CompositeContainer - Container composed of multiple sub-containers
 */

import { Container } from 'pixi.js';
import { BaseContainer, ContainerConfig } from './BaseContainer';

export interface CompositeSlot {
  name: string;
  container: Container;
  zIndex: number;
}

/**
 * Container managing multiple named slot containers.
 */
export class CompositeContainer extends BaseContainer {
  private slots: Map<string, CompositeSlot> = new Map();

  constructor(config: ContainerConfig = {}) {
    super(config);
    this.sortableChildren = true;
  }

  /** Create a slot container */
  public createSlot(name: string, zIndex: number = 0): Container {
    if (this.slots.has(name)) {
      console.warn(`[CompositeContainer] Slot ${name} already exists`);
      return this.slots.get(name)!.container;
    }

    const container = new Container();
    container.label = `Slot_${name}`;
    container.zIndex = zIndex;

    const slot: CompositeSlot = { name, container, zIndex };
    this.slots.set(name, slot);
    this.addChild(container);
    this.sortChildren();

    return container;
  }

  /** Get a slot container */
  public getSlot(name: string): Container | undefined {
    return this.slots.get(name)?.container;
  }

  /** Remove a slot */
  public removeSlot(name: string): boolean {
    const slot = this.slots.get(name);
    if (!slot) return false;

    this.removeChild(slot.container);
    slot.container.destroy({ children: true });
    this.slots.delete(name);
    return true;
  }

  /** Clear a slot's children */
  public clearSlot(name: string): void {
    const slot = this.slots.get(name);
    if (slot) {
      slot.container.removeChildren();
    }
  }

  /** Clear all slots */
  public clearAllSlots(): void {
    for (const slot of this.slots.values()) {
      slot.container.removeChildren();
    }
  }

  /** Get all slot names */
  public getSlotNames(): string[] {
    return Array.from(this.slots.keys());
  }

  /** Check if slot exists */
  public hasSlot(name: string): boolean {
    return this.slots.has(name);
  }

  /** Destroy composite container */
  public override destroy(): void {
    for (const slot of this.slots.values()) {
      slot.container.destroy({ children: true });
    }
    this.slots.clear();
    super.destroy();
  }
}
