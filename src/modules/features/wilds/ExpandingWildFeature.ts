/**
 * ExpandingWildFeature - Wilds that expand to fill reel
 */

import { SlotPlugin, PluginPriority } from '../../../engine/plugin/SlotPlugin';
import { EventBus } from '../../../platform/events/EventBus';

export interface ExpandingWild {
  col: number;
  sourceRow: number;
  isExpanding: boolean;
  isExpanded: boolean;
}

export interface ExpandingWildState {
  isActive: boolean;
  expandingWilds: ExpandingWild[];
  gridRows: number;
}

export class ExpandingWildFeature extends SlotPlugin {
  private eventBus: EventBus;
  private state: ExpandingWildState;

  constructor() {
    super({
      id: 'feature-expandingwild',
      version: '1.0.0',
      priority: PluginPriority.HIGH,
      dependencies: [],
      enabled: true,
    });

    this.eventBus = EventBus.getInstance();
    this.state = this.createInitialState();
  }

  private createInitialState(): ExpandingWildState {
    return {
      isActive: false,
      expandingWilds: [],
      gridRows: 3,
    };
  }

  public async onLoad(): Promise<void> {
    this.setupEventListeners();
  }

  public async onUnload(): Promise<void> {
    this.reset();
  }

  public onEnable(): void {
    console.log('[ExpandingWildFeature] Enabled');
  }

  public onDisable(): void {
    this.reset();
    console.log('[ExpandingWildFeature] Disabled');
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:reels:stopped', (payload) => {
      this.checkForExpandingWilds(payload.symbols);
    });

    this.eventBus.on('game:spin:start', () => {
      this.reset();
    });
  }

  private checkForExpandingWilds(symbols: string[][]): void {
    const cols = symbols[0]?.length ?? 0;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < symbols.length; row++) {
        if (symbols[row][col] === 'W' || symbols[row][col] === 'WILD') {
          if (!this.hasExpandingWildAt(col)) {
            this.triggerExpand(col, row);
          }
        }
      }
    }
  }

  public triggerExpand(col: number, sourceRow: number): void {
    const wild: ExpandingWild = {
      col,
      sourceRow,
      isExpanding: true,
      isExpanded: false,
    };

    this.state.expandingWilds.push(wild);
    this.state.isActive = true;

    this.eventBus.emit('feature:wild:expand:start', {
      col,
      sourceRow,
    });

    // Simulate expansion animation completion
    setTimeout(() => {
      this.completeExpansion(col);
    }, 300);
  }

  private completeExpansion(col: number): void {
    const wild = this.state.expandingWilds.find(w => w.col === col);
    if (wild) {
      wild.isExpanding = false;
      wild.isExpanded = true;

      this.eventBus.emit('feature:wild:expand:complete', { col });
    }
  }

  public hasExpandingWildAt(col: number): boolean {
    return this.state.expandingWilds.some(w => w.col === col);
  }

  public isColumnWild(col: number): boolean {
    const wild = this.state.expandingWilds.find(w => w.col === col);
    return wild?.isExpanded ?? false;
  }

  public applyToGrid(symbols: string[][]): string[][] {
    const result = symbols.map(row => [...row]);
    
    for (const wild of this.state.expandingWilds) {
      if (wild.isExpanded) {
        for (let row = 0; row < result.length; row++) {
          if (result[row][wild.col] !== undefined) {
            result[row][wild.col] = 'W';
          }
        }
      }
    }
    
    return result;
  }

  public getExpandedColumns(): number[] {
    return this.state.expandingWilds
      .filter(w => w.isExpanded)
      .map(w => w.col);
  }

  public reset(): void {
    this.state = this.createInitialState();
  }

  public getState(): ExpandingWildState {
    return {
      ...this.state,
      expandingWilds: this.state.expandingWilds.map(w => ({ ...w })),
    };
  }

  public isActive(): boolean {
    return this.state.isActive;
  }
}
