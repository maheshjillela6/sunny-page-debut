/**
 * useHudConfig - Hook to load, resolve, and apply responsive HUD layout config
 *
 * Hierarchy (same pattern as ConfigManager):
 *   1. Shared template:  /game-configs/shared/hud/{template}.layout.json
 *   2. Game overrides:   /game-configs/games/{gameId}/hud-layout.json
 *   3. Responsive merge:  breakpoint cascading on the merged result
 */

import { useState, useEffect, useMemo } from 'react';
import { appendVersionToUrl } from '@/config/version.config';
import { useLayout } from './useLayout';
import type {
  HudLayoutConfig,
  GameHudConfig,
  ResolvedHudElement,
  ResolvedHudLayout,
  DualRegionConfig,
  ReactRegionConfig,
  PixiRegionConfig,
  HudElementConfig,
  HudLayoutMode,
  HudRendererType,
} from '../hud/types/HudLayoutTypes';

// ── Caches (cleared on HMR to pick up config edits) ────────────────────────
let templateCache = new Map<string, HudLayoutConfig>();
let gameConfigCache = new Map<string, GameHudConfig>();

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    templateCache = new Map();
    gameConfigCache = new Map();
  });
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(appendVersionToUrl(url), { cache: 'no-cache' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchTemplate(mode: HudLayoutMode): Promise<HudLayoutConfig | null> {
  if (templateCache.has(mode)) return templateCache.get(mode)!;
  const config = await fetchJson<HudLayoutConfig>(`/game-configs/shared/hud/${mode}.layout.json`);
  if (config) templateCache.set(mode, config);
  return config;
}

async function fetchGameHudConfig(gameId: string): Promise<GameHudConfig | null> {
  if (gameConfigCache.has(gameId)) return gameConfigCache.get(gameId)!;
  const config = await fetchJson<GameHudConfig>(`/game-configs/games/${gameId}/hud-layout.json`);
  if (config) gameConfigCache.set(gameId, config);
  return config;
}

// ── Deep merge ──────────────────────────────────────────────────────────────
function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T>): T {
  const result = { ...base } as any;
  for (const key of Object.keys(override)) {
    const val = (override as any)[key];
    if (
      val && typeof val === 'object' && !Array.isArray(val) &&
      typeof result[key] === 'object' && !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

// ── Breakpoint resolution ───────────────────────────────────────────────────
function getBreakpointKeys(
  isMobile: boolean,
  isTablet: boolean,
  orientation: 'portrait' | 'landscape'
): string[] {
  const sizeKey = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  return [sizeKey, orientation, `${sizeKey}-${orientation}`];
}

// ── Merge template + game overrides into a single HudLayoutConfig ───────────
function mergeTemplateWithGame(template: HudLayoutConfig, game: GameHudConfig): HudLayoutConfig {
  // Deep-clone the template so we never mutate the cache
  const merged: HudLayoutConfig = JSON.parse(JSON.stringify(template));

  // Override imageBasePath if the game provides one
  if (game.imageBasePath) {
    merged.imageBasePath = game.imageBasePath;
  }

  // Merge element overrides
  if (game.elements) {
    for (const [id, override] of Object.entries(game.elements)) {
      if (merged.elements[id]) {
        merged.elements[id] = deepMerge(merged.elements[id], override as Partial<HudElementConfig>);
      }
    }
  }

  // Merge region overrides (also add new regions)
  if (game.regions) {
    for (const [id, override] of Object.entries(game.regions)) {
      if (merged.regions[id]) {
        merged.regions[id] = deepMerge(merged.regions[id], override as Partial<DualRegionConfig>);
      } else {
        merged.regions[id] = override as DualRegionConfig;
      }
    }
  }

  // Merge responsive overrides
  if (game.responsive) {
    for (const [breakpoint, override] of Object.entries(game.responsive)) {
      if (!merged.responsive[breakpoint]) {
        merged.responsive[breakpoint] = override;
      } else {
        // Merge regions inside the breakpoint
        if (override.regions) {
          if (!merged.responsive[breakpoint].regions) {
            merged.responsive[breakpoint].regions = override.regions;
          } else {
            for (const [rId, rOverride] of Object.entries(override.regions)) {
              merged.responsive[breakpoint].regions![rId] = merged.responsive[breakpoint].regions![rId]
                ? deepMerge(merged.responsive[breakpoint].regions![rId], rOverride)
                : rOverride;
            }
          }
        }
        // Merge elements inside the breakpoint
        if (override.elements) {
          if (!merged.responsive[breakpoint].elements) {
            merged.responsive[breakpoint].elements = override.elements;
          } else {
            for (const [eId, eOverride] of Object.entries(override.elements)) {
              merged.responsive[breakpoint].elements![eId] = merged.responsive[breakpoint].elements![eId]
                ? deepMerge(merged.responsive[breakpoint].elements![eId] as HudElementConfig, eOverride as Partial<HudElementConfig>)
                : eOverride;
            }
          }
        }
      }
    }
  }

  return merged;
}

// ── Resolve layout with responsive overrides ────────────────────────────────
function resolveLayout(config: HudLayoutConfig, breakpointKeys: string[], renderer: HudRendererType): ResolvedHudLayout {
  const mode = config.layoutMode;

  let dualRegions: Record<string, DualRegionConfig> = JSON.parse(JSON.stringify(config.regions));
  let elements: Record<string, HudElementConfig> = JSON.parse(JSON.stringify(config.elements));

  // Apply responsive cascading: general → specific
  for (const key of breakpointKeys) {
    if (!config.responsive[key]) continue;
    const overrides = config.responsive[key];

    if (overrides.regions) {
      for (const [regionId, regionOverride] of Object.entries(overrides.regions)) {
        if (dualRegions[regionId]) {
          dualRegions[regionId] = deepMerge(dualRegions[regionId], regionOverride as Partial<DualRegionConfig>);
        } else {
          dualRegions[regionId] = regionOverride as DualRegionConfig;
        }
      }
    }

    if (overrides.elements) {
      for (const [elemId, elemOverride] of Object.entries(overrides.elements)) {
        if (elements[elemId]) {
          elements[elemId] = deepMerge(elements[elemId], elemOverride as Partial<HudElementConfig>);
        }
      }
    }
  }

  // Extract renderer-specific regions
  const reactRegions: Record<string, ReactRegionConfig> = {};
  const pixiRegions: Record<string, PixiRegionConfig> = {};
  for (const [id, dual] of Object.entries(dualRegions)) {
    if (dual.react) reactRegions[id] = dual.react;
    if (dual.pixi) pixiRegions[id] = dual.pixi;
  }

  // Resolve each element
  const resolvedElements: Record<string, ResolvedHudElement> = {};
  for (const [id, elem] of Object.entries(elements)) {
    const imagePath = elem.image && config.imageBasePath
      ? `/${config.imageBasePath}/${elem.image}`
      : undefined;
    const spinningImagePath = (elem as any).spinningImage && config.imageBasePath
      ? `/${config.imageBasePath}/${(elem as any).spinningImage}`
      : undefined;

    const useImage = mode === 'image' || mode === 'hybrid';
    const useIcon = mode === 'icon' || mode === 'hybrid' || (mode === 'image' && config.imageFallback);

    resolvedElements[id] = {
      ...elem,
      resolvedImageSrc: imagePath,
      resolvedSpinningImageSrc: spinningImagePath,
      useImage,
      useIcon,
    };
  }

  return { mode, renderer, elements: resolvedElements, reactRegions, pixiRegions };
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useHudConfig(gameId: string) {
  const layout = useLayout();
  const [mergedConfig, setMergedConfig] = useState<HudLayoutConfig | null>(null);
  const [rendererType, setRendererType] = useState<HudRendererType>('react');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      // 1. Load game hud config to find template name
      const gameConfig = await fetchGameHudConfig(gameId);
      const templateName: HudLayoutMode = gameConfig?.template ?? 'icon';

      // 2. Load shared template
      const template = await fetchTemplate(templateName);

      if (cancelled) return;

      if (!template) {
        console.warn(`[useHudConfig] Could not load shared template: ${templateName}`);
        setMergedConfig(null);
        setLoading(false);
        return;
      }

      // 3. Merge game overrides on top of template
      const merged = gameConfig
        ? mergeTemplateWithGame(template, gameConfig)
        : template;

      setRendererType(gameConfig?.renderer ?? 'react');
      setMergedConfig(merged);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [gameId]);

  const breakpointKeys = getBreakpointKeys(layout.isMobile, layout.isTablet, layout.orientation);

  const resolved = useMemo<ResolvedHudLayout | null>(() => {
    if (!mergedConfig) return null;
    return resolveLayout(mergedConfig, breakpointKeys, rendererType);
  }, [mergedConfig, breakpointKeys.join(','), rendererType]);

  return { resolved, loading, layout, rawConfig: mergedConfig };
}

export default useHudConfig;
