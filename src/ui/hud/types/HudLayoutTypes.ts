/**
 * HUD Layout Types - Shared types for the config-driven HUD system
 */

export type HudLayoutMode = 'icon' | 'image' | 'hybrid';
export type HudRendererType = 'react' | 'pixi';

export interface HudElementStyle {
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  labelFontSize?: number;
  iconSize?: number;
  borderRadius?: number;
  padding?: [number, number];
  opacity?: number;
  backdrop?: boolean;
  glowColor?: string;
  /** Uniform scale (1 = 100%). Overridden by scaleX/scaleY if set. */
  scale?: number;
  /** Horizontal scale (1 = 100%) */
  scaleX?: number;
  /** Vertical scale (1 = 100%) */
  scaleY?: number;
  /** Rotation in degrees (clockwise) */
  rotation?: number;
  /** Anchor X (0–1, default 0). Used by Pixi for pivot; ignored by React. */
  anchorX?: number;
  /** Anchor Y (0–1, default 0). Used by Pixi for pivot; ignored by React. */
  anchorY?: number;
}

export interface HudElementConfig {
  id: string;
  label?: string;
  icon?: string;
  image?: string;
  spinningImage?: string;
  /** Pixi sprite key – if provided, the element renders the sprite; if not found, falls back to Graphics */
  pixiSprite?: string;
  /** Pixi spinning sprite key (for spin button during spin) */
  pixiSpinningSprite?: string;
  visible: boolean;
  order: number;
  region: string;
  showControls?: boolean;
  style: HudElementStyle;
}

/** CSS-based region config (used by React renderer) */
export interface ReactRegionConfig {
  position: string;
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
  transform?: string;
  flexDirection: string;
  alignItems?: string;
  justifyContent?: string;
  gap?: number;
  padding?: (number | string)[];
  flexWrap?: string;
}

/** Pixi-based region config (used by Pixi renderer) */
export interface PixiRegionConfig {
  /** X position in virtual canvas pixels */
  x: number;
  /** Y position in virtual canvas pixels */
  y: number;
  /** Anchor X (0=left, 0.5=center, 1=right) */
  anchorX?: number;
  /** Anchor Y (0=top, 0.5=center, 1=bottom) */
  anchorY?: number;
  flexDirection: string;
  alignItems?: string;
  gap?: number;
}

/** Dual-renderer region config in shared template */
export interface DualRegionConfig {
  react: ReactRegionConfig;
  pixi: PixiRegionConfig;
}

/** Resolved region config — after renderer selection, this is a flat config for the active renderer */
export type HudRegionConfig = ReactRegionConfig;

/** Region config as stored in the shared template (dual keys) */
export type SharedRegionConfig = DualRegionConfig;

export interface HudResponsiveOverride {
  regions?: Record<string, Partial<DualRegionConfig>>;
  elements?: Record<string, Partial<HudElementConfig>>;
}

/**
 * Shared template layout config — loaded from game-configs/shared/hud/{mode}.layout.json
 */
export interface HudLayoutConfig {
  layoutMode: HudLayoutMode;
  imageFallback: boolean;
  imageBasePath: string;
  elements: Record<string, HudElementConfig>;
  regions: Record<string, DualRegionConfig>;
  responsive: Record<string, HudResponsiveOverride>;
}

/**
 * Game-specific HUD config — loaded from game-configs/games/{gameId}/hud-layout.json
 * References a shared template and provides overrides.
 */
export interface GameHudConfig {
  /** Which shared template to use: "icon", "image", or "hybrid" */
  template: HudLayoutMode;
  /** Which renderer to use: "react" (HTML/CSS) or "pixi" (PixiJS Graphics/Sprites) */
  renderer?: HudRendererType;
  /** Override the image base path for this game (required for image/hybrid modes) */
  imageBasePath?: string;
  /** Game-specific element overrides (merged on top of template) */
  elements?: Record<string, Partial<HudElementConfig>>;
  /** Game-specific region overrides (can override react, pixi, or both) */
  regions?: Record<string, Partial<DualRegionConfig>>;
  /** Game-specific responsive overrides (merged on top of template responsive) */
  responsive?: Record<string, HudResponsiveOverride>;
}

/** Resolved element after responsive merges */
export interface ResolvedHudElement extends HudElementConfig {
  resolvedImageSrc?: string;
  resolvedSpinningImageSrc?: string;
  useImage: boolean;
  useIcon: boolean;
}

export interface ResolvedHudLayout {
  mode: HudLayoutMode;
  renderer: HudRendererType;
  elements: Record<string, ResolvedHudElement>;
  /** React renderer gets ReactRegionConfig, Pixi renderer gets PixiRegionConfig */
  reactRegions: Record<string, ReactRegionConfig>;
  pixiRegions: Record<string, PixiRegionConfig>;
}
