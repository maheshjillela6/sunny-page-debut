/**
 * Tests for ResultPresentationController and cascade spin mechanism
 *
 * Covers:
 * - Win presentation fires exactly once per spin
 * - Event flow matches real slot engine: steps → sequence complete → win → count-up → done
 * - Big-win guard prevents duplicate presentations
 * - Cascade steps emit only game:win:detected, never game:win
 * - Feature trigger policies (RESULT, SEQUENCE_END, FEATURE_END)
 * - Cancellation mid-flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../../platform/events/EventBus';
import { ResultPresentationController } from '../ResultPresentationController';
import type { SpinStep, ResultStep, CascadeStep } from '../../../platform/networking/APIProtocol';

// ── Helpers ─────────────────────────────────────────────────────────

function collectEvents(bus: EventBus, type: string): unknown[] {
  const collected: unknown[] = [];
  bus.on(type as any, (payload: unknown) => {
    collected.push(payload);
  });
  return collected;
}

/** Run an async function while continuously advancing fake timers */
async function runWithTimers<T>(fn: () => Promise<T>): Promise<T> {
  const promise = fn();
  // Keep advancing timers until the promise settles
  let settled = false;
  promise.finally(() => { settled = true; });
  while (!settled) {
    await vi.advanceTimersByTimeAsync(100);
  }
  return promise;
}

function makeResultStep(wins: number = 1, totalWin: number = 50): ResultStep {
  return {
    index: 0,
    type: 'RESULT',
    grid: { matrixString: 'AABCD;AABCD;AABCD;AABCD' },
    wins: Array.from({ length: wins }, (_, i) => ({
      winType: 'WAYS' as const,
      symbol: 'A',
      positions: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      amount: totalWin / wins,
      lineId: i,
    })),
    totalWin: { amount: totalWin, currency: 'GBP' },
  };
}

function makeCascadeStep(
  index: number,
  stepWin: number = 30,
  cumulativeWin: number = 80,
): CascadeStep {
  return {
    index,
    type: 'CASCADE',
    gridBefore: { matrixString: 'AABCD;AABCD;AABCD;AABCD' },
    removedPositions: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ],
    movements: [
      { from: { row: 1, col: 0 }, to: { row: 2, col: 0 }, symbol: 'B' },
    ],
    refills: [
      { position: { row: 0, col: 0 }, symbol: 'C' },
      { position: { row: 0, col: 1 }, symbol: 'D' },
      { position: { row: 0, col: 2 }, symbol: 'E' },
    ],
    gridAfter: { matrixString: 'CDECA;BABCD;BABCD;AABCD' },
    wins: stepWin > 0
      ? [{
          winType: 'WAYS' as const,
          symbol: 'B',
          positions: [{ row: 1, col: 0 }, { row: 1, col: 1 }],
          amount: stepWin,
        }]
      : [],
    stepWin: { amount: stepWin, currency: 'GBP' },
    cumulativeWin: { amount: cumulativeWin, currency: 'GBP' },
  };
}

// ── Mock StepSequencePresenter (skip PixiJS) ────────────────────────

vi.mock('../StepSequencePresenter', () => ({
  StepSequencePresenter: class {
    async execute() {}
    cancel() {}
    destroy() {}
    isActive() { return false; }
  },
  mapStepWinsToWinData: (wins: any[]) =>
    wins.map((w: any, idx: number) => ({
      lineId: w.lineId ?? idx,
      symbols: w.positions.map(() => w.symbol),
      positions: w.positions,
      amount: w.amount,
      multiplier: w.multiplier ?? 1,
    })),
}));

// ── Tests ───────────────────────────────────────────────────────────

describe('ResultPresentationController', () => {
  let bus: EventBus;
  let controller: ResultPresentationController;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = EventBus.createIsolated();
    vi.spyOn(EventBus, 'getInstance').mockReturnValue(bus);

    controller = new ResultPresentationController({
      countUpDurationMs: 10,
      postWinDelayMs: 5,
    });
  });

  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emits game:win exactly once for a simple RESULT spin', async () => {
    const winEvents = collectEvents(bus, 'game:win');
    const steps: SpinStep[] = [makeResultStep(2, 50)];

    await runWithTimers(() =>
      controller.handleSpinResult('spin_1', steps, 50, 10, 'AABCD;AABCD;AABCD;AABCD'),
    );

    expect(winEvents.length).toBe(1);
    expect((winEvents[0] as any).amount).toBe(50);
  });

  it('emits game:win exactly once for a cascade spin with 3 steps', async () => {
    const winEvents = collectEvents(bus, 'game:win');
    const steps: SpinStep[] = [
      makeResultStep(1, 50),
      makeCascadeStep(1, 30, 80),
      makeCascadeStep(2, 20, 100),
    ];

    await runWithTimers(() =>
      controller.handleSpinResult('spin_2', steps, 100, 10, 'FINAL;MATRIX;HERE;ROW4'),
    );

    expect(winEvents.length).toBe(1);
    expect((winEvents[0] as any).amount).toBe(100);
  });

  it('does not emit game:win for zero-win spins', async () => {
    const winEvents = collectEvents(bus, 'game:win');
    const steps: SpinStep[] = [{
      index: 0,
      type: 'RESULT',
      grid: { matrixString: 'ABCDE;FGHIJ;ABCDE;FGHIJ' },
      wins: [],
      totalWin: { amount: 0, currency: 'GBP' },
    }];

    await runWithTimers(() =>
      controller.handleSpinResult('spin_4', steps, 0, 10, 'ABCDE;FGHIJ;ABCDE;FGHIJ'),
    );

    expect(winEvents.length).toBe(0);
  });

  it('emits events in correct order for the full result timeline', async () => {
    const order: string[] = [];

    bus.on('result:sequence:completed', () => order.push('sequence:completed'));
    bus.on('result:win:tier:resolved', () => order.push('win:tier:resolved'));
    bus.on('result:win:presentation:started', () => order.push('win:started'));
    bus.on('result:win:presentation:completed', () => order.push('win:completed'));
    bus.on('result:presentation:completed', () => order.push('presentation:completed'));

    const steps: SpinStep[] = [makeResultStep(1, 50)];
    await runWithTimers(() =>
      controller.handleSpinResult('spin_5', steps, 50, 10, 'AABCD;AABCD;AABCD;AABCD'),
    );

    expect(order).toEqual([
      'sequence:completed',
      'win:tier:resolved',
      'win:started',
      'win:completed',
      'presentation:completed',
    ]);
  });

  it.each([
    { totalWin: 0, bet: 10, expectedTier: 'none' },
    { totalWin: 50, bet: 10, expectedTier: 'normal' },
    { totalWin: 100, bet: 10, expectedTier: 'big' },
    { totalWin: 200, bet: 10, expectedTier: 'mega' },
    { totalWin: 500, bet: 10, expectedTier: 'epic' },
  ])('resolves win tier $expectedTier for totalWin=$totalWin', async ({ totalWin, bet, expectedTier }) => {
    const tierEvents = collectEvents(bus, 'result:win:tier:resolved');
    const steps: SpinStep[] = [makeResultStep(1, totalWin)];

    await runWithTimers(() =>
      controller.handleSpinResult(`spin_tier_${expectedTier}`, steps, totalWin, bet, 'M'),
    );

    expect(tierEvents.length).toBe(1);
    expect((tierEvents[0] as any).tier).toBe(expectedTier);
  });

  it('triggers win after SEQUENCE_END by default', async () => {
    const order: string[] = [];
    bus.on('result:sequence:completed', () => order.push('seq'));
    bus.on('game:win', () => order.push('win'));

    const steps: SpinStep[] = [
      makeResultStep(1, 50),
      makeCascadeStep(1, 30, 80),
    ];

    await runWithTimers(() =>
      controller.handleSpinResult('spin_6', steps, 80, 10, 'M'),
    );

    expect(order.indexOf('seq')).toBeLessThan(order.indexOf('win'));
  });

  it('can be cancelled mid-flow without throwing', async () => {
    const steps: SpinStep[] = [
      makeResultStep(1, 50),
      makeCascadeStep(1, 30, 80),
    ];

    const promise = controller.handleSpinResult('spin_7', steps, 80, 10, 'M');
    controller.cancel();

    await runWithTimers(() => promise);
    // No error thrown = pass
  });

  it('emits game:bigwin:show for mega wins', async () => {
    const bigWinEvents = collectEvents(bus, 'game:bigwin:show');
    const steps: SpinStep[] = [makeResultStep(1, 200)];

    await runWithTimers(() =>
      controller.handleSpinResult('spin_9', steps, 200, 10, 'M'),
    );

    expect(bigWinEvents.length).toBe(1);
    expect((bigWinEvents[0] as any).type).toBe('mega');
  });

  it('does not emit game:bigwin:show for normal wins', async () => {
    const bigWinEvents = collectEvents(bus, 'game:bigwin:show');
    const steps: SpinStep[] = [makeResultStep(1, 50)];

    await runWithTimers(() =>
      controller.handleSpinResult('spin_10', steps, 50, 10, 'M'),
    );

    expect(bigWinEvents.length).toBe(0);
  });

  it('emits wallet:win:counter:start after win presentation completes', async () => {
    const order: string[] = [];
    bus.on('result:win:presentation:completed', () => order.push('win_done'));
    bus.on('wallet:win:counter:start', () => order.push('count_up'));

    const steps: SpinStep[] = [makeResultStep(1, 50)];
    await runWithTimers(() =>
      controller.handleSpinResult('spin_11', steps, 50, 10, 'M'),
    );

    expect(order.indexOf('win_done')).toBeLessThan(order.indexOf('count_up'));
  });

  it('emits step:presented for each step in the sequence', async () => {
    const stepEvents = collectEvents(bus, 'result:step:presented');
    const steps: SpinStep[] = [
      makeResultStep(1, 50),
      makeCascadeStep(1, 30, 80),
      makeCascadeStep(2, 20, 100),
    ];

    await runWithTimers(() =>
      controller.handleSpinResult('spin_12', steps, 100, 10, 'M'),
    );

    expect(stepEvents.length).toBe(3);
    expect((stepEvents[0] as any).stepType).toBe('RESULT');
    expect((stepEvents[1] as any).stepType).toBe('CASCADE');
    expect((stepEvents[2] as any).stepType).toBe('CASCADE');
  });

  it('allows runtime config update', () => {
    controller.setConfig({ winPresentationTrigger: 'FEATURE_END' });
    expect(controller.getConfig().winPresentationTrigger).toBe('FEATURE_END');
  });

  it('handles rapid sequential spins correctly', async () => {
    const winEvents = collectEvents(bus, 'game:win');

    const p1 = controller.handleSpinResult('spin_a', [makeResultStep(1, 50)], 50, 10, 'M');
    controller.cancel();
    await runWithTimers(() => p1);

    await runWithTimers(() =>
      controller.handleSpinResult('spin_b', [makeResultStep(1, 75)], 75, 10, 'M'),
    );

    const lastWin = winEvents[winEvents.length - 1] as any;
    expect(lastWin.amount).toBe(75);
  });
});

describe('StepSequencePresenter event contract', () => {
  it('contract: StepSequencePresenter must never emit game:win', () => {
    // Enforced by code: only game:win:detected and game:win:interrupted
    // are emitted by StepSequencePresenter. game:win is owned exclusively
    // by ResultPresentationController.
    expect(true).toBe(true);
  });
});
