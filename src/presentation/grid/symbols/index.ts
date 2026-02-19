/**
 * Symbol system barrel export.
 *
 * Re-exports all public types and classes so consumers can import from
 * a single path: `@/presentation/grid/symbols`.
 */

// ── Config types ────────────────────────────────────────────────────────────
export type {
  SymbolLifecycleState,
  SymbolLayerType,
  AnimationDriver,
  GraphicsShapeConfig,
  TweenAnimationConfig,
  SpineAnimationConfig,
  LayerStateRule,
  SymbolLayerConfig,
  SymbolCompositionConfig,
  GameSymbolRenderingConfig,
} from './config/SymbolCompositionTypes';

export { DEFAULT_LAYER_STATE, DEFAULT_HIGHLIGHT } from './config/SymbolCompositionTypes';

// ── Renderers ───────────────────────────────────────────────────────────────
export { SymbolLayerRenderer } from './renderers/SymbolLayerRenderer';
export { SymbolCompositionRenderer } from './renderers/SymbolCompositionRenderer';
export { SymbolRendererFactory } from './renderers/SymbolRendererFactory';

// ── Views ───────────────────────────────────────────────────────────────────
export { ConfigurableSymbolView } from './ConfigurableSymbolView';
export { ConfigurableSymbolPool } from './ConfigurableSymbolPool';

// ── Legacy (still available) ────────────────────────────────────────────────
export { SymbolView } from './SymbolView';
export { SymbolAnimator, SymbolAnimationType } from './SymbolAnimator';
export { SymbolContainer } from './SymbolContainer';
export { SymbolPool } from './SymbolPool';
export { SymbolOverlayContainer } from './SymbolOverlayContainer';
export { SymbolStateMachine, SymbolState } from './SymbolStateMachine';
