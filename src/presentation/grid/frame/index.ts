/**
 * Grid Frame Plugin System - Public API
 */

export { FrameLayer, registerFramePlugin } from './FrameLayer';
export type { IGridFramePlugin } from './types/IGridFramePlugin';
export type {
  GridFrameConfig,
  CodeFrameConfig,
  ImageFrameConfig,
  FrameContainerConfig,
  FrameAnimationBindings,
  FrameAnimation,
  BackgroundVariant,
  FrameBorderVariant,
  ColumnSeparatorVariant,
  RowSeparatorVariant,
  EffectVariant,
  AnimationVariant,
  ImageFrameVariant,
} from './types/GridFrameConfig';
export { CodeBasedFramePlugin } from './plugins/CodeBasedFramePlugin';
export { ImageFramePlugin } from './plugins/ImageFramePlugin';
export { FrameSubContainer } from './containers/FrameSubContainer';
