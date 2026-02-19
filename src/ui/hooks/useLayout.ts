/**
 * useLayout - Hook to manage responsive layout
 *
 * Pattern B: Virtual canvas coordinates + single scale factor.
 * All HUD positions are defined in virtual pixel space.
 * A single scale is derived from screen size and applied to
 * the container, so everything scales uniformly with no
 * per-breakpoint size tweaking.
 *
 * Virtual canvas:
 *   Landscape → 1280 × 720
 *   Portrait  → 720  × 1280
 */

import { useState, useEffect } from 'react';

// ── Virtual canvas sizes ─────────────────────────────────────────────────────
export const VIRTUAL_LANDSCAPE = { width: 1280, height: 720 } as const;
export const VIRTUAL_PORTRAIT  = { width: 720,  height: 1280 } as const;

// Breakpoint thresholds (single source of truth)
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

export interface LayoutState {
  /** Actual screen dimensions */
  width: number;
  height: number;
  /** Device category */
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Current orientation */
  orientation: 'portrait' | 'landscape';
  /** Virtual canvas size for the current orientation */
  virtualWidth: number;
  virtualHeight: number;
  /**
   * Uniform scale: multiply any virtual-space dimension by this
   * to get the real-pixel size on screen.
   */
  scale: number;
  /**
   * Top-left offset (px) to centre the scaled virtual canvas
   * inside the real screen — matches how PixiRuntime centres the canvas.
   */
  offsetX: number;
  offsetY: number;
}

function calculateLayout(): LayoutState {
  const width  = window.innerWidth;
  const height = window.innerHeight;

  const isMobile  = width < BREAKPOINTS.mobile;
  const isTablet  = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.tablet;
  const orientation: 'portrait' | 'landscape' = width > height ? 'landscape' : 'portrait';

  const virt = orientation === 'portrait' ? VIRTUAL_PORTRAIT : VIRTUAL_LANDSCAPE;

  const scale   = Math.min(width / virt.width, height / virt.height);
  const offsetX = (width  - virt.width  * scale) / 2;
  const offsetY = (height - virt.height * scale) / 2;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    orientation,
    virtualWidth:  virt.width,
    virtualHeight: virt.height,
    scale,
    offsetX,
    offsetY,
  };
}

export function useLayout(): LayoutState {
  const [layout, setLayout] = useState<LayoutState>(calculateLayout);

  useEffect(() => {
    const handleResize = () => setLayout(calculateLayout());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return layout;
}

export default useLayout;

