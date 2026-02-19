/**
 * SpinMechanismTypes - Core type definitions for pluggable spin-flow mechanisms
 * 
 * Each mechanism defines its own loop, persistence rules, completion conditions,
 * and step data consumption - all driven from game configuration.
 */

import { Position } from '@/gameplay/models/RoundModel';

// ============ Mechanism Identification ============

export type SpinMechanismId =
  | 'holdRespin'
  | 'lockSequence'
  | 'multiSpin'
  | 'collection'
  | 'modifier'
  | 'transformation'
  | string; // extensible

// ============ Step Data ============

/** A single step result consumed by a mechanism */
export interface MechanismStepData {
  stepIndex: number;
  stepId: string;
  matrixString: string;
  matrix: string[][];
  wins: MechanismWin[];
  totalStepWin: number;
  /** Symbols that landed with special behavior */
  specialSymbols?: SpecialSymbolLanding[];
  /** Positions to lock/persist */
  lockedPositions?: Position[];
  /** Values attached to positions */
  positionValues?: PositionValue[];
  /** Multiplier for this step */
  multiplier?: number;
  /** Modifiers applied this step */
  modifiers?: StepModifier[];
  /** Symbol transformations */
  transformations?: SymbolTransformation[];
  /** Whether this step triggers extension/reset */
  extendsSequence?: boolean;
  /** Custom data per mechanism */
  custom?: Record<string, unknown>;
}

export interface MechanismWin {
  symbol: string;
  positions: Position[];
  amount: number;
  matchCount: number;
}

export interface SpecialSymbolLanding {
  position: Position;
  symbolId: string;
  value?: number;
  effect?: string; // 'lock' | 'collect' | 'upgrade' | 'multiply' | 'expand'
}

export interface PositionValue {
  position: Position;
  value: number;
  symbol?: string;
  multiplier?: number;
}

export interface StepModifier {
  type: 'addSymbol' | 'removeSymbol' | 'changeReel' | 'addMultiplier' | 'expandGrid' | 'swapSymbols';
  target: string; // reel index, position, symbol id, etc.
  value: unknown;
}

export interface SymbolTransformation {
  from: { position: Position; symbol: string };
  to: { symbol: string; value?: number };
  effect?: string; // 'upgrade' | 'morph' | 'replace' | 'evolve'
}

// ============ Persistent State ============

/** State maintained between mechanism steps */
export interface MechanismPersistentState {
  mechanismId: SpinMechanismId;
  isActive: boolean;
  currentStep: number;
  totalSteps: number; // -1 = unbounded (ends on condition)
  iterationsRemaining: number;
  totalWin: number;
  /** Positions currently locked/held */
  lockedPositions: Map<string, PositionValue>; // key = "row,col"
  /** Accumulated collection value */
  collectedValue: number;
  /** Current multiplier */
  multiplier: number;
  /** Reels or positions that are active/unlocked */
  activePositions: Position[];
  /** Custom per-mechanism state */
  custom: Record<string, unknown>;
}

// ============ Mechanism Configuration ============

/** Base config shared by all mechanisms */
export interface MechanismConfig {
  id: SpinMechanismId;
  name: string;
  /** Max iterations before forced completion */
  maxIterations: number;
  /** Initial iteration count */
  initialIterations: number;
  /** What resets the iteration counter */
  resetCondition: ResetCondition;
  /** When the mechanism completes */
  completionCondition: CompletionCondition;
  /** Grid dimensions during this mechanism (can differ from base) */
  gridOverride?: { rows: number; cols: number };
  /** Symbols used during this mechanism */
  symbolSet?: string[];
  /** Base multiplier */
  baseMultiplier: number;
  /** Multiplier progression rule */
  multiplierProgression?: MultiplierProgression;
  /** Speed variant overrides */
  speedVariants?: Record<string, Partial<MechanismConfig>>;
  /** Mode-specific overrides (baseGame, freeSpins, etc.) */
  modeOverrides?: Record<string, Partial<MechanismConfig>>;
}

export interface ResetCondition {
  type: 'symbolLand' | 'winOccurs' | 'never' | 'custom';
  /** Symbol that triggers reset */
  symbol?: string;
  /** Reset iterations to this value */
  resetTo: number;
}

export interface CompletionCondition {
  type: 'iterationsExhausted' | 'boardFilled' | 'noNewLocks' | 'fixedCount' | 'collectionComplete' | 'noModifiers' | 'custom';
  /** For boardFilled: what percentage counts as full */
  fillThreshold?: number;
  /** For collectionComplete: target value */
  targetValue?: number;
  /** For fixedCount: exact number of steps */
  count?: number;
}

export interface MultiplierProgression {
  type: 'perStep' | 'perWin' | 'perLock' | 'fixed';
  increment: number;
  max: number;
}

// ============ Hold-Respin Specific ============

export interface HoldRespinMechanismConfig extends MechanismConfig {
  id: 'holdRespin';
  /** Symbol that gets held */
  holdSymbol: string;
  /** Initial respins */
  initialRespins: number;
  /** Grand jackpot on board fill */
  grandJackpotMultiplier: number;
  /** Symbol values (weighted random) */
  symbolValues: Array<{ value: number; weight: number }>;
}

// ============ Lock-Sequence Specific ============

export interface LockSequenceMechanismConfig extends MechanismConfig {
  id: 'lockSequence';
  /** Symbol that triggers locking */
  triggerSymbol: string;
  /** Lock mode: 'reel' locks entire reels, 'position' locks individual cells */
  lockMode: 'reel' | 'position';
  /** Locked positions persist symbols between spins */
  persistLocked: boolean;
}

// ============ Multi-Spin Specific ============

export interface MultiSpinMechanismConfig extends MechanismConfig {
  id: 'multiSpin';
  /** Number of spins in the sequence */
  spinCount: number;
  /** Rule changes per spin (indexed) */
  perSpinRules?: Array<{
    symbolPersistence?: string[];
    multiplierOverride?: number;
    reelConfigOverride?: { rows: number; cols: number };
  }>;
}

// ============ Collection Specific ============

export interface CollectionMechanismConfig extends MechanismConfig {
  id: 'collection';
  /** Symbol that adds to collection */
  collectSymbol: string;
  /** Symbol that consumes the collection */
  collectorSymbol?: string;
  /** Auto-consume at end if no collector */
  autoConsumeOnEnd: boolean;
  /** Minimum value to trigger consumption */
  consumeThreshold?: number;
}

// ============ Modifier Specific ============

export interface ModifierMechanismConfig extends MechanismConfig {
  id: 'modifier';
  /** Modifiers applied per step */
  modifierPool: Array<{
    type: StepModifier['type'];
    weight: number;
    minValue: number;
    maxValue: number;
  }>;
  /** Max modifiers per step */
  maxModifiersPerStep: number;
}

// ============ Transformation Specific ============

export interface TransformationMechanismConfig extends MechanismConfig {
  id: 'transformation';
  /** Upgrade path: symbol A → B → C */
  upgradePaths: Array<{
    from: string;
    to: string;
    condition: 'adjacentMatch' | 'winParticipation' | 'random' | 'stepBased';
  }>;
  /** Whether transformations are permanent for the sequence */
  permanentTransforms: boolean;
}

// ============ Mechanism Result ============

export interface MechanismStepResult {
  stepIndex: number;
  wins: MechanismWin[];
  stepWin: number;
  cumulativeWin: number;
  stateSnapshot: Partial<MechanismPersistentState>;
  isComplete: boolean;
  nextAction: 'continue' | 'complete' | 'extend';
}

export interface MechanismResult {
  mechanismId: SpinMechanismId;
  totalWin: number;
  totalSteps: number;
  stepResults: MechanismStepResult[];
  finalState: MechanismPersistentState;
}
