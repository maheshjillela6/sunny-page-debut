/**
 * ParallelAction - Executes multiple actions simultaneously
 */

import { TimelineAction, ActionCallback, CancellationToken } from './TimelineTypes';

export class ParallelAction implements TimelineAction {
  private static nextId = 0;

  public readonly id: string;
  public readonly type = 'parallel' as const;
  public readonly duration: number;
  public readonly priority: number;
  
  private actions: TimelineAction[];

  constructor(actions: TimelineAction[], id?: string) {
    this.id = id ?? `parallel_${ParallelAction.nextId++}`;
    this.actions = actions;
    this.duration = Math.max(...actions.map(a => a.duration ?? 0));
    this.priority = 0;
  }

  public async execute(token?: CancellationToken): Promise<void> {
    if (token?.isCancelled) return;
    await Promise.all(this.actions.map(action => action.execute(token)));
  }

  public getActions(): TimelineAction[] {
    return [...this.actions];
  }

  public addAction(action: TimelineAction): void {
    this.actions.push(action);
  }

  public static create(actions: TimelineAction[]): ParallelAction {
    return new ParallelAction(actions);
  }

  public static fromCallbacks(callbacks: ActionCallback[]): ParallelAction {
    const actions: TimelineAction[] = callbacks.map((cb, index) => ({
      id: `callback_${index}`,
      type: 'callback' as const,
      execute: async (token?: CancellationToken) => {
        if (token?.isCancelled) return;
        await cb();
      },
      duration: 0,
    }));
    return new ParallelAction(actions);
  }
}
