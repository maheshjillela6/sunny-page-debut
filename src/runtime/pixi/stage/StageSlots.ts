/**
 * StageSlots - Named slot positions on stage
 */

export interface SlotDefinition {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: { x: number; y: number };
}

/**
 * Manages named slot positions for element placement.
 */
export class StageSlots {
  private slots: Map<string, SlotDefinition> = new Map();

  /** Define a slot */
  public define(slot: SlotDefinition): void {
    this.slots.set(slot.name, slot);
  }

  /** Define multiple slots */
  public defineMany(slots: SlotDefinition[]): void {
    for (const slot of slots) {
      this.define(slot);
    }
  }

  /** Get a slot definition */
  public get(name: string): SlotDefinition | undefined {
    return this.slots.get(name);
  }

  /** Check if slot exists */
  public has(name: string): boolean {
    return this.slots.has(name);
  }

  /** Get all slot names */
  public getNames(): string[] {
    return Array.from(this.slots.keys());
  }

  /** Get all slots */
  public getAll(): SlotDefinition[] {
    return Array.from(this.slots.values());
  }

  /** Remove a slot */
  public remove(name: string): boolean {
    return this.slots.delete(name);
  }

  /** Clear all slots */
  public clear(): void {
    this.slots.clear();
  }

  /** Create default slot definitions */
  public static createDefaults(): SlotDefinition[] {
    return [
      { name: 'center', x: 640, y: 360, width: 1280, height: 720, anchor: { x: 0.5, y: 0.5 } },
      { name: 'top', x: 640, y: 50, width: 1280, height: 100, anchor: { x: 0.5, y: 0 } },
      { name: 'bottom', x: 640, y: 670, width: 1280, height: 100, anchor: { x: 0.5, y: 1 } },
      { name: 'left', x: 50, y: 360, width: 100, height: 720, anchor: { x: 0, y: 0.5 } },
      { name: 'right', x: 1230, y: 360, width: 100, height: 720, anchor: { x: 1, y: 0.5 } },
      { name: 'grid', x: 640, y: 360, width: 800, height: 500, anchor: { x: 0.5, y: 0.5 } },
    ];
  }
}
