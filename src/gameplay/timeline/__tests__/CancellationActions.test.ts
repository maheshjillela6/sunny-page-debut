import { describe, it, expect, vi } from 'vitest';
import { CancellationTokenImpl } from '../TimelineTypes';
import { DelayAction } from '../DelayAction';
import { ParallelAction } from '../ParallelAction';

describe('timeline actions cancellation', () => {
  it('DelayAction resolves early when token cancels', async () => {
    vi.useFakeTimers();

    const token = new CancellationTokenImpl();
    const delay = new DelayAction(10_000, 'delay_test');

    const p = delay.execute(token);

    token.cancel();
    await vi.runAllTimersAsync();

    await expect(p).resolves.toBeUndefined();

    vi.useRealTimers();
  });

  it('ParallelAction propagates token to children', async () => {
    vi.useFakeTimers();

    const token = new CancellationTokenImpl();
    const slow = new DelayAction(10_000, 'slow');
    const fast = new DelayAction(10_000, 'fast');

    const parallel = new ParallelAction([slow, fast], 'parallel_test');

    const p = parallel.execute(token);
    token.cancel();
    await vi.runAllTimersAsync();

    await expect(p).resolves.toBeUndefined();

    vi.useRealTimers();
  });
});
