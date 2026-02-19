/**
 * BaseScreenSlots - Slot positions for base screen
 */

import { GridSlots } from '../../grid/GridSlots';
import { GridConfig } from '../../grid/GridManager';

export class BaseScreenSlots {
  private gridSlots: GridSlots;

  constructor(config: GridConfig) {
    this.gridSlots = new GridSlots(config);
  }

  public getGridSlots(): GridSlots {
    return this.gridSlots;
  }

  public destroy(): void {
    this.gridSlots.destroy();
  }
}
