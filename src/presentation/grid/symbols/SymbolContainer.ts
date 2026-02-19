/**
 * SymbolContainer - Container for symbol groups
 */

import { Container } from 'pixi.js';
import { ConfigurableSymbolView } from './ConfigurableSymbolView';

export class SymbolContainer extends Container {
  private symbols: ConfigurableSymbolView[] = [];

  constructor() {
    super();
    this.label = 'SymbolContainer';
  }

  public addSymbol(symbol: ConfigurableSymbolView): void {
    this.symbols.push(symbol);
    this.addChild(symbol);
  }

  public removeSymbol(symbol: ConfigurableSymbolView): void {
    const index = this.symbols.indexOf(symbol);
    if (index > -1) {
      this.symbols.splice(index, 1);
      this.removeChild(symbol);
    }
  }

  public getSymbols(): ConfigurableSymbolView[] {
    return [...this.symbols];
  }

  public clearSymbols(): void {
    for (const symbol of this.symbols) {
      this.removeChild(symbol);
    }
    this.symbols = [];
  }

  public getSymbolAt(index: number): ConfigurableSymbolView | undefined {
    return this.symbols[index];
  }

  public getSymbolCount(): number {
    return this.symbols.length;
  }
}
