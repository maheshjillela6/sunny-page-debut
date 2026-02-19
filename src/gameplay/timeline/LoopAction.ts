/**
 * LoopAction - Repeats actions a specified number of times
 */

import { TimelineAction, LoopOptions, CancellationToken } from './TimelineTypes';

export class LoopAction implements TimelineAction {
  private static nextId = 0;

  public readonly id: string;
  public readonly type = 'loop' as const;
  public readonly duration: number;
  public readonly priority: number;
  
  private actions: TimelineAction[];
  private count: number;
  private onIteration?: (index: number) => void;
  private currentIteration: number = 0;

  constructor(options: LoopOptions, id?: string) {
    this.id = id ?? `loop_${LoopAction.nextId++}`;
    this.actions = options.actions;
    this.count = options.count;
    this.onIteration = options.onIteration;
    this.priority = 0;
    
    // Calculate total duration
    const singleDuration = this.actions.reduce((sum, a) => sum + (a.duration ?? 0), 0);
    this.duration = singleDuration * this.count;
  }

  public async execute(token?: CancellationToken): Promise<void> {
    for (let i = 0; i < this.count; i++) {
      if (token?.isCancelled) return;

      this.currentIteration = i;
      this.onIteration?.(i);
      
      for (const action of this.actions) {
        if (token?.isCancelled) return;
        await action.execute(token);
      }
    }
  }

  public getCurrentIteration(): number {
    return this.currentIteration;
  }

  public getRemainingIterations(): number {
    return this.count - this.currentIteration - 1;
  }

  public static create(count: number, actions: TimelineAction[]): LoopAction {
    return new LoopAction({ count, actions });
  }
}
