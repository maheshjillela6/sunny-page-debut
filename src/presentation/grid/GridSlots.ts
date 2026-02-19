/**
 * GridSlots - Manages slot positions in grid
 */

import { SlotContainer } from '../../runtime/pixi/containers/SlotContainer';
import { GridConfig } from './GridManager';

export class GridSlots {
  private slots: SlotContainer[][] = [];
  private config: GridConfig;

  constructor(config: GridConfig) {
    this.config = config;
    this.createSlots();
  }

  private createSlots(): void {
    for (let row = 0; row < this.config.rows; row++) {
      this.slots[row] = [];
      for (let col = 0; col < this.config.cols; col++) {
        const slot = new SlotContainer(row, col);
        slot.x = col * (this.config.cellWidth + this.config.spacing);
        slot.y = row * (this.config.cellHeight + this.config.spacing);
        this.slots[row][col] = slot;
      }
    }
  }

  public getSlot(row: number, col: number): SlotContainer | undefined {
    return this.slots[row]?.[col];
  }

  public getAllSlots(): SlotContainer[] {
    return this.slots.flat();
  }

  public forEachSlot(callback: (slot: SlotContainer, row: number, col: number) => void): void {
    for (let row = 0; row < this.slots.length; row++) {
      for (let col = 0; col < this.slots[row].length; col++) {
        callback(this.slots[row][col], row, col);
      }
    }
  }

  public destroy(): void {
    for (const row of this.slots) {
      for (const slot of row) {
        slot.destroy();
      }
    }
    this.slots = [];
  }
}
