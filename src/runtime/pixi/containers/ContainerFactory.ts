/**
 * ContainerFactory - Factory for creating containers
 */

import { Container } from 'pixi.js';
import { BaseContainer, ContainerConfig } from './BaseContainer';
import { LayerContainer, LayerConfig } from './LayerContainer';
import { MaskContainer, MaskConfig } from './MaskContainer';
import { FXContainer, FXConfig } from './FXContainer';
import { CompositeContainer } from './CompositeContainer';
import { SlotContainer } from './SlotContainer';

export type ContainerType = 'base' | 'layer' | 'mask' | 'fx' | 'composite' | 'slot';

/**
 * Factory for creating different container types.
 */
export class ContainerFactory {
  /**
   * Create a container by type
   */
  public static create(
    type: ContainerType,
    config: ContainerConfig | LayerConfig | MaskConfig | FXConfig = {}
  ): BaseContainer {
    switch (type) {
      case 'base':
        return new BaseContainer(config);
      case 'layer':
        return new LayerContainer(config as LayerConfig);
      case 'mask':
        return new MaskContainer(config as MaskConfig);
      case 'fx':
        return new FXContainer(config as FXConfig);
      case 'composite':
        return new CompositeContainer(config);
      default:
        return new BaseContainer(config);
    }
  }

  /**
   * Create a slot container
   */
  public static createSlot(row: number, col: number, config: ContainerConfig = {}): SlotContainer {
    return new SlotContainer(row, col, config);
  }

  /**
   * Create a basic Pixi container
   */
  public static createRaw(name?: string): Container {
    const container = new Container();
    if (name) container.label = name;
    return container;
  }
}
