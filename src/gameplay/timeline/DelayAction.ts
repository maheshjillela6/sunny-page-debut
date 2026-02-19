/**
 * DelayAction - Waits for a specified duration
 */

import { TimelineAction, CancellationToken } from './TimelineTypes';

export class DelayAction implements TimelineAction {
  private static nextId = 0;

  public readonly id: string;
  public readonly type = 'delay' as const;
  public readonly duration: number;
  public readonly priority: number;

  constructor(duration: number, id?: string) {
    this.id = id ?? `delay_${DelayAction.nextId++}`;
    this.duration = duration;
    this.priority = 0;
  }

  public async execute(token?: CancellationToken): Promise<void> {
    if (token?.isCancelled) return;

    return new Promise((resolve) => {
      const t = window.setTimeout(() => resolve(), this.duration);

      token?.onCancel(() => {
        window.clearTimeout(t);
        resolve();
      });
    });
  }

  public static create(durationMs: number): DelayAction {
    return new DelayAction(durationMs);
  }
}
