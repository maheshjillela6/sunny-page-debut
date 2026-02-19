/**
 * Cascade presentation system - public API
 */

export type {
  CascadeConfig,
  CascadeModeConfig,
  CascadeSpeedVariant,
  CascadeAnimationDriver,
  CascadeAnimationConfig,
  CascadeEasing,
  RemovalStyle,
  CollapseStyle,
  RefillStyle,
  WinPresentationStyle,
  PhaseOrdering,
  ElementOrdering,
  WinPresentationPhaseConfig,
  RemovalPhaseConfig,
  CollapsePhaseConfig,
  RefillPhaseConfig,
  CascadePhaseTimingConfig,
  SymbolCascadeOverride,
  LayerCascadeOverride,
} from './CascadeConfigTypes';

export type {
  CascadeSequence,
  CascadeStep,
  CascadeWin,
  CascadeMovement,
  CascadeRefillEntry,
  CascadePosition,
} from './CascadeDataTypes';

export { buildCascadeSequenceFromSteps } from './CascadeDataTypes';

export {
  resolveCascadeConfig,
  getSymbolOverride,
  type ResolvedCascadeConfig,
  type CascadeGameMode,
  type CascadeSpeed,
} from './CascadeConfigResolver';

export {
  CascadePresenter,
  type ICascadePhaseHandler,
  type CascadePhase,
} from './CascadePresenter';

export { CascadePhaseHandlerImpl } from './CascadePhaseHandlerImpl';
