/**
 * FlowTypes - Type definitions for flow system
 */

import { WinData } from '@/platform/events/EventMap';

export enum FlowType {
  SPIN = 'spin',
  FREE_SPINS = 'free_spins',
  BONUS = 'bonus',
  HOLD_RESPIN = 'hold_respin',
  WIN_PRESENTATION = 'win_presentation',
  FEATURE_INTRO = 'feature_intro',
  FEATURE_OUTRO = 'feature_outro',
}

export enum FlowStep {
  IDLE = 'idle',
  SPIN_START = 'spin_start',
  REELS_SPINNING = 'reels_spinning',
  REELS_STOPPING = 'reels_stopping',
  WIN_EVALUATION = 'win_evaluation',
  WIN_PRESENTATION = 'win_presentation',
  SPIN_COMPLETE = 'spin_complete',
  FEATURE_TRIGGER = 'feature_trigger',
  FEATURE_INTRO = 'feature_intro',
  FEATURE_PLAY = 'feature_play',
  FEATURE_OUTRO = 'feature_outro',
}

export interface FlowContext {
  roundId: string;
  bet: number;
  symbols: string[][];
  wins: WinData[];
  totalWin: number;
  features: string[];
  data: Record<string, unknown>;
}

export interface FlowConfig {
  type: FlowType;
  steps: FlowStep[];
  timing: FlowTiming;
  callbacks: FlowCallbacks;
}

export interface FlowTiming {
  minDuration: number;
  maxDuration: number;
  stepDelays: Record<FlowStep, number>;
}

export interface FlowCallbacks {
  onStart?: (context: FlowContext) => void;
  onStep?: (step: FlowStep, context: FlowContext) => void;
  onComplete?: (context: FlowContext) => void;
  onError?: (error: Error, context: FlowContext) => void;
}

export const DEFAULT_FLOW_TIMING: FlowTiming = {
  minDuration: 1000,
  maxDuration: 5000,
  stepDelays: {
    [FlowStep.IDLE]: 0,
    [FlowStep.SPIN_START]: 100,
    [FlowStep.REELS_SPINNING]: 1500,
    [FlowStep.REELS_STOPPING]: 500,
    [FlowStep.WIN_EVALUATION]: 300,
    [FlowStep.WIN_PRESENTATION]: 2000,
    [FlowStep.SPIN_COMPLETE]: 100,
    [FlowStep.FEATURE_TRIGGER]: 1000,
    [FlowStep.FEATURE_INTRO]: 2000,
    [FlowStep.FEATURE_PLAY]: 0,
    [FlowStep.FEATURE_OUTRO]: 2000,
  },
};
