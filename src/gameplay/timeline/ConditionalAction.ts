/**
 * ConditionalAction - Executes actions based on a condition
 */

import { TimelineAction, ConditionalOptions, CancellationToken } from './TimelineTypes';

export class ConditionalAction implements TimelineAction {
  private static nextId = 0;

  public readonly id: string;
  public readonly type = 'conditional' as const;
  public readonly duration: number;
  public readonly priority: number;
  
  private condition: () => boolean;
  private onTrue: TimelineAction[];
  private onFalse: TimelineAction[];
  private executedBranch: 'true' | 'false' | null = null;

  constructor(options: ConditionalOptions, id?: string) {
    this.id = id ?? `conditional_${ConditionalAction.nextId++}`;
    this.condition = options.condition;
    this.onTrue = options.onTrue;
    this.onFalse = options.onFalse ?? [];
    this.priority = 0;
    
    // Duration is max of both branches
    const trueDuration = this.onTrue.reduce((sum, a) => sum + (a.duration ?? 0), 0);
    const falseDuration = this.onFalse.reduce((sum, a) => sum + (a.duration ?? 0), 0);
    this.duration = Math.max(trueDuration, falseDuration);
  }

  public async execute(token?: CancellationToken): Promise<void> {
    if (token?.isCancelled) return;

    const result = this.condition();
    const actionsToExecute = result ? this.onTrue : this.onFalse;
    this.executedBranch = result ? 'true' : 'false';

    for (const action of actionsToExecute) {
      if (token?.isCancelled) return;
      await action.execute(token);
    }
  }

  public getExecutedBranch(): 'true' | 'false' | null {
    return this.executedBranch;
  }

  public static create(
    condition: () => boolean,
    onTrue: TimelineAction[],
    onFalse?: TimelineAction[]
  ): ConditionalAction {
    return new ConditionalAction({ condition, onTrue, onFalse });
  }
}
