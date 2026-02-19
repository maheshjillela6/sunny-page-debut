/**
 * FlowEvents - Event definitions for flow system
 */

export interface FlowStartEvent {
  flowType: string;
  timestamp: number;
}

export interface FlowStepEvent {
  flowType: string;
  step: string;
  timestamp: number;
}

export interface FlowCompleteEvent {
  flowType: string;
  duration: number;
  timestamp: number;
}

export interface FlowCancelEvent {
  flowType: string;
  reason: string;
  timestamp: number;
}

export interface FlowErrorEvent {
  flowType: string;
  step: string;
  error: Error;
  timestamp: number;
}

export const FlowEvents = {
  FLOW_START: 'flow:start',
  FLOW_STEP: 'flow:step',
  FLOW_COMPLETE: 'flow:complete',
  FLOW_CANCEL: 'flow:cancel',
  FLOW_ERROR: 'flow:error',
} as const;

export type FlowEventType = typeof FlowEvents[keyof typeof FlowEvents];
