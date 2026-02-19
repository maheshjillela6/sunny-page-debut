/**
 * VirtualDims - Utility to get responsive-aware virtual dimensions.
 *
 * Instead of importing the hardcoded VIRTUAL_WIDTH / VIRTUAL_HEIGHT constants,
 * layers and transitions should call `vw()` and `vh()` to get the current
 * virtual dimensions that reflect the active breakpoint.
 */

import { PixiRuntime, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './PixiRuntime';

/** Current responsive virtual width (falls back to default 1280) */
export function vw(): number {
  try {
    return PixiRuntime.getInstance().getVirtualWidth();
  } catch {
    return VIRTUAL_WIDTH;
  }
}

/** Current responsive virtual height (falls back to default 720) */
export function vh(): number {
  try {
    return PixiRuntime.getInstance().getVirtualHeight();
  } catch {
    return VIRTUAL_HEIGHT;
  }
}
