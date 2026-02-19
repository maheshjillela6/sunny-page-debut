/**
 * SequenceBuilder - Fluent API for building action sequences
 */

import { TimelineAction, ActionCallback, CancellationToken } from './TimelineTypes';
import { DelayAction } from './DelayAction';
import { ParallelAction } from './ParallelAction';
import { LoopAction } from './LoopAction';
import { ConditionalAction } from './ConditionalAction';

export class SequenceBuilder {
  private static nextId = 0;

  private actions: TimelineAction[] = [];
  private id: string;

  constructor(id?: string) {
    this.id = id ?? `sequence_${SequenceBuilder.nextId++}`;
  }

  /**
   * Add a callback action
   */
  public call(callback: ActionCallback, duration: number = 0): SequenceBuilder {
    this.actions.push({
      id: `callback_${this.actions.length}`,
      type: 'callback',
      execute: async (token?: CancellationToken) => {
        if (token?.isCancelled) return;
        await callback();
      },
      duration,
    });
    return this;
  }

  /**
   * Add a delay
   */
  public delay(durationMs: number): SequenceBuilder {
    this.actions.push(new DelayAction(durationMs));
    return this;
  }

  /**
   * Add actions to run in parallel
   */
  public parallel(actions: TimelineAction[]): SequenceBuilder {
    this.actions.push(new ParallelAction(actions));
    return this;
  }

  /**
   * Add a parallel block with callbacks
   */
  public parallelCalls(callbacks: ActionCallback[]): SequenceBuilder {
    this.actions.push(ParallelAction.fromCallbacks(callbacks));
    return this;
  }

  /**
   * Add a loop
   */
  public loop(count: number, builder: (seq: SequenceBuilder) => void): SequenceBuilder {
    const innerBuilder = new SequenceBuilder();
    builder(innerBuilder);
    this.actions.push(new LoopAction({
      count,
      actions: innerBuilder.build(),
    }));
    return this;
  }

  /**
   * Add a conditional branch
   */
  public if(
    condition: () => boolean,
    onTrue: (seq: SequenceBuilder) => void,
    onFalse?: (seq: SequenceBuilder) => void
  ): SequenceBuilder {
    const trueBuilder = new SequenceBuilder();
    onTrue(trueBuilder);

    let falseActions: TimelineAction[] = [];
    if (onFalse) {
      const falseBuilder = new SequenceBuilder();
      onFalse(falseBuilder);
      falseActions = falseBuilder.build();
    }

    this.actions.push(new ConditionalAction({
      condition,
      onTrue: trueBuilder.build(),
      onFalse: falseActions,
    }));
    return this;
  }

  /**
   * Add an existing action
   */
  public add(action: TimelineAction): SequenceBuilder {
    this.actions.push(action);
    return this;
  }

  /**
   * Add multiple actions
   */
  public addAll(actions: TimelineAction[]): SequenceBuilder {
    this.actions.push(...actions);
    return this;
  }

  /**
   * Wait for a promise
   */
  public await(promiseFactory: () => Promise<void>): SequenceBuilder {
    this.actions.push({
      id: `await_${this.actions.length}`,
      type: 'callback',
      execute: async (token?: CancellationToken) => {
        if (token?.isCancelled) return;
        await promiseFactory();
      },
      duration: 0,
    });
    return this;
  }

  /**
   * Build the sequence
   */
  public build(): TimelineAction[] {
    return [...this.actions];
  }

  /**
   * Get the sequence as a single action
   */
  public toAction(): TimelineAction {
    const actions = this.build();
    const totalDuration = actions.reduce((sum, a) => sum + (a.duration ?? 0), 0);

    return {
      id: this.id,
      type: 'sequence',
      duration: totalDuration,
      execute: async (token) => {
        for (const action of actions) {
          await action.execute(token);
        }
      },
    };
  }

  /**
   * Create a new builder
   */
  public static create(id?: string): SequenceBuilder {
    return new SequenceBuilder(id);
  }
}
