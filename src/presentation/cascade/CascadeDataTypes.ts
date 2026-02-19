/**
 * CascadeDataTypes - Server-side cascade step data structures.
 *
 * Aligned with the steps-based API protocol:
 *   steps[0] = { type: 'RESULT', grid, wins, totalWin }
 *   steps[1..n] = { type: 'CASCADE', gridBefore, removedPositions, movements, refills, gridAfter, wins, stepWin, cumulativeWin }
 */

import type { SpinStep, ResultStep, CascadeStep as APICascadeStep, StepWinInfo } from '../../platform/networking/APIProtocol';

export interface CascadePosition {
  row: number;
  col: number;
}

/** Re-export API step types for convenience */
export type { SpinStep, ResultStep, StepWinInfo };
export type APICascadeStepType = APICascadeStep;

/** A single winning cluster/line within a cascade step */
export interface CascadeWin {
  winId: number;
  symbol: string;
  positions: CascadePosition[];
  amount: number;
  multiplier: number;
  matchCount: number;
}

/** Movement of a symbol from one position to another during collapse */
export interface CascadeMovement {
  from: CascadePosition;
  to: CascadePosition;
  symbol: string;
}

/** A new symbol entering the grid during refill */
export interface CascadeRefillEntry {
  position: CascadePosition;
  symbol: string;
  /** Source position for animation (e.g. above grid for drop) */
  sourceOffset?: { x: number; y: number };
}

/** A single cascade step in the sequence (presentation-side) */
export interface CascadeStep {
  /** Step index (0-based, matches API step.index) */
  stepIndex: number;
  /** Grid state at the start of this step */
  matrixBefore: string;
  /** Winning positions in this step */
  wins: CascadeWin[];
  /** Total win amount for this step */
  stepWin: number;
  /** Positions to remove (winning symbols) */
  removedPositions: CascadePosition[];
  /** Symbol movements during collapse */
  movements: CascadeMovement[];
  /** New symbols entering the grid */
  refills: CascadeRefillEntry[];
  /** Grid state after collapse + refill */
  matrixAfter: string;
  /** Cumulative multiplier at this step */
  multiplier: number;
  /** Cumulative total win across all steps so far */
  cumulativeWin: number;
}

/** Complete cascade sequence for a round */
export interface CascadeSequence {
  /** Total number of cascade steps */
  totalSteps: number;
  /** The ordered steps */
  steps: CascadeStep[];
  /** Total win from all cascade steps combined */
  totalWin: number;
  /** Final grid state after all cascades */
  finalMatrix: string;
  /** Final multiplier */
  finalMultiplier: number;
}

/**
 * Convert API steps (SpinStep[]) into a CascadeSequence for the presenter.
 */
export function buildCascadeSequenceFromSteps(apiSteps: SpinStep[]): CascadeSequence | null {
  const cascadeApiSteps = apiSteps.filter((s): s is APICascadeStep => s.type === 'CASCADE');

  if (cascadeApiSteps.length === 0) return null;

  const steps: CascadeStep[] = cascadeApiSteps.map((cs, idx) => ({
    stepIndex: cs.index,
    matrixBefore: cs.gridBefore.matrixString,
    wins: cs.wins.map((w, wIdx) => ({
      winId: wIdx,
      symbol: w.symbol,
      positions: w.positions,
      amount: w.amount,
      multiplier: w.multiplier || 1,
      matchCount: w.matchCount || w.positions.length,
    })),
    stepWin: cs.stepWin.amount,
    removedPositions: cs.removedPositions,
    movements: cs.movements || [],
    refills: cs.refills,
    matrixAfter: cs.gridAfter.matrixString,
    multiplier: cs.multiplier || 1,
    cumulativeWin: cs.cumulativeWin.amount,
  }));

  const lastStep = steps[steps.length - 1];

  return {
    totalSteps: steps.length,
    steps,
    totalWin: lastStep.cumulativeWin,
    finalMatrix: lastStep.matrixAfter,
    finalMultiplier: lastStep.multiplier,
  };
}
