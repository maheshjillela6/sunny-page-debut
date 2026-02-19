/**
 * SlotContainer - Container for symbol positioning
 */

import { Container } from 'pixi.js';
import { BaseContainer, ContainerConfig } from './BaseContainer';

export interface SlotPosition {
  row: number;
  col: number;
  x: number;
  y: number;
}

/**
 * Container representing a single slot position on the grid.
 */
export class SlotContainer extends BaseContainer {
  private row: number;
  private col: number;
  private symbolContainer: Container;

  constructor(row: number, col: number, config: ContainerConfig = {}) {
    super(config);
    
    this.row = row;
    this.col = col;
    this.label = `Slot_${row}_${col}`;

    this.symbolContainer = new Container();
    this.symbolContainer.label = 'Symbol';
    this.addChild(this.symbolContainer);
  }

  /** Get row index */
  public getRow(): number {
    return this.row;
  }

  /** Get column index */
  public getCol(): number {
    return this.col;
  }

  /** Get slot position */
  public getPosition(): SlotPosition {
    return {
      row: this.row,
      col: this.col,
      x: this.x,
      y: this.y,
    };
  }

  /** Get symbol container */
  public getSymbolContainer(): Container {
    return this.symbolContainer;
  }

  /** Set symbol (add to container) */
  public setSymbol(symbol: Container): void {
    this.clearSymbol();
    this.symbolContainer.addChild(symbol);
  }

  /** Clear current symbol */
  public clearSymbol(): void {
    this.symbolContainer.removeChildren();
  }

  /** Check if has symbol */
  public hasSymbol(): boolean {
    return this.symbolContainer.children.length > 0;
  }

  /** Highlight slot */
  public highlight(): void {
    // Override in subclass for highlight effect
  }

  /** Remove highlight */
  public unhighlight(): void {
    // Override in subclass
  }
}
