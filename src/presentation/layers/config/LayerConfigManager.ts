/**
 * LayerConfigManager - Loads and merges data-driven Pixi layer configs.
 *
 * Source of truth: /public/game-configs/**
 * Merge order: shared layer defaults -> per-game layer overrides
 */

import { ConfigManager } from '@/content/ConfigManager';
import { appendVersionToUrl } from '@/config/version.config';
import type { WinAnimationConfig } from '@/presentation/layers/win/WinAnimations';

export type HexColor = number | string;

export interface LayerConfigBundle {
  background?: BackgroundLayerConfig;
  win?: WinLayerConfig;
  feature?: FeatureLayerConfig;
  overlay?: OverlayLayerConfig;
  debug?: DebugLayerConfig;
  decorBack?: DecorBackLayerConfig;
  title?: TitleLayerConfig;
  toast?: ToastLayerConfig;
  transition?: TransitionLayerConfig;
  presentation?: PresentationLayerConfig;
  screen?: ScreenLayerConfig;
  gridFrame?: import('@/presentation/grid/frame/types/GridFrameConfig').GridFrameConfig;
}

// ── Background ──────────────────────────────────────────────────────────────

export interface BackgroundLayerConfig {
  base?: {
    candidates?: Array<
      | { type: 'spine'; key: string; fillScreen?: boolean; scale?: number; animation?: { name?: string; loop?: boolean } }
      | { type: 'image'; key: string; scaleMode?: 'cover' }
    >;
    fallback?: { type: 'graphics'; kind: 'solid'; color: HexColor };
  };
  ambient?: {
    items?: Array<{
      id: string;
      kind: 'ambient' | 'decorative';
      candidates: Array<
        | { type: 'spine'; key: string; scale?: number; animation?: { name?: string; loop?: boolean } }
        | { type: 'image'; key: string; scaleMode?: 'cover' }
        | {
            type: 'graphics';
            kind: 'starfield';
            config: {
              count: number;
              area?: { width?: number; height?: number };
              colors?: HexColor[];
              radiusMin?: number;
              radiusMax?: number;
              alphaMin?: number;
              alphaMax?: number;
              pulseDurationMs?: number;
            };
          }
      >;
      position: { x: number; y: number; anchor?: { x: number; y: number } };
    }>;
  };
}

// ── Win ─────────────────────────────────────────────────────────────────────

export interface WinLayerConfig {
  highlight?: {
    cellPaddingGlow?: number;
    cellPaddingBorder?: number;
    glowAlpha?: number;
    borderWidth?: number;
    radiusGlow?: number;
    radiusBorder?: number;
  };
  particles?: {
    bigWinThreshold?: number;
    megaWinThreshold?: number;
    lineWinBurst?: {
      count?: number;
      colors?: HexColor[];
      radiusMin?: number;
      radiusMax?: number;
      spreadX?: number;
      spreadY?: number;
      riseY?: number;
      durationMs?: number;
      alphaMin?: number;
      alphaMax?: number;
    };
    bigWinBurst?: {
      count?: number;
      colors?: HexColor[];
      radiusMin?: number;
      radiusMax?: number;
      spreadX?: number;
      spreadY?: number;
      riseY?: number;
      durationMs?: number;
    };
    megaWinBurst?: {
      count?: number;
      colors?: HexColor[];
      radiusMin?: number;
      radiusMax?: number;
      spreadX?: number;
      spreadY?: number;
      riseY?: number;
      durationMs?: number;
    };
  };
  winText?: {
    panel?: {
      fill?: HexColor;
      fillAlpha?: number;
      stroke?: HexColor;
      strokeWidth?: number;
      radius?: number;
    };
    amountText?: { fontFamily?: string; fontSize?: number; fill?: HexColor; fontWeight?: string };
    lineLabelText?: { fontFamily?: string; fontSize?: number; fill?: HexColor };
    lineAmountText?: { fontFamily?: string; fontSize?: number; fill?: HexColor; fontWeight?: string };
  };
}

// ── Feature ─────────────────────────────────────────────────────────────────

export interface FeatureLayerConfig {
  banner?: {
    width?: number;
    height?: number;
    y?: number;
    panel?: { fill?: HexColor; fillAlpha?: number; radius?: number };
    border?: { stroke?: HexColor; strokeWidth?: number; radius?: number };
    text?: { fontFamily?: string; fontSize?: number; fontWeight?: string; fill?: HexColor; letterSpacing?: number };
  };
  counter?: {
    x?: number;
    y?: number;
    panel?: { fill?: HexColor; fillAlpha?: number; radius?: number };
    border?: { stroke?: HexColor; strokeWidth?: number; radius?: number };
    labelText?: { fontFamily?: string; fontSize?: number; fill?: HexColor };
    valueText?: { fontFamily?: string; fontSize?: number; fontWeight?: string; fill?: HexColor };
  };
}

// ── Overlay ─────────────────────────────────────────────────────────────────

export interface OverlayLayerConfig {
  dimBackground?: {
    color?: HexColor;
    alpha?: number;
  };
  animation?: {
    showDurationMs?: number;
    hideDurationMs?: number;
    scaleFrom?: number;
  };
}

// ── Debug ───────────────────────────────────────────────────────────────────

export interface DebugLayerConfig {
  panel?: {
    fill?: HexColor;
    fillAlpha?: number;
    radius?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  fpsText?: { fontFamily?: string; fontSize?: number; fill?: HexColor };
  memText?: { fontFamily?: string; fontSize?: number; fill?: HexColor };
  stateText?: { fontFamily?: string; fontSize?: number; fill?: HexColor };
  grid?: {
    size?: number;
    color?: HexColor;
    alpha?: number;
    crosshairColor?: HexColor;
    crosshairAlpha?: number;
    crosshairSize?: number;
  };
}

// ── DecorBack ───────────────────────────────────────────────────────────────

export interface DecorBackLayerConfig {
  outerFrame?: {
    stroke?: HexColor;
    strokeWidth?: number;
    strokeAlpha?: number;
    radius?: number;
    margin?: number;
  };
  innerFrame?: {
    stroke?: HexColor;
    strokeWidth?: number;
    strokeAlpha?: number;
    radius?: number;
    margin?: number;
  };
  cornerAccent?: {
    fill?: HexColor;
    fillAlpha?: number;
    radius?: number;
    ringStroke?: HexColor;
    ringStrokeWidth?: number;
    ringStrokeAlpha?: number;
    ringRadius?: number;
  };
  sideLines?: {
    left?: { color?: HexColor; width?: number; alphaStart?: number; alphaStep?: number; count?: number; startY?: number; spacingY?: number; length?: number };
    right?: { color?: HexColor; width?: number; alphaStart?: number; alphaStep?: number; count?: number; startY?: number; spacingY?: number; length?: number };
  };
  diamonds?: {
    left?: { x?: number; y?: number; size?: number; fill?: HexColor; fillAlpha?: number; stroke?: HexColor; strokeWidth?: number };
    right?: { x?: number; y?: number; size?: number; fill?: HexColor; fillAlpha?: number; stroke?: HexColor; strokeWidth?: number };
  };
}

// ── Title ───────────────────────────────────────────────────────────────────

export interface TitleLayerConfig {
  logo?: {
    x?: number;
    y?: number;
    bgFill?: HexColor;
    bgFillAlpha?: number;
    bgRadius?: number;
    ringStroke?: HexColor;
    ringStrokeWidth?: number;
    ringRadius?: number;
    hexFill?: HexColor;
    hexFillAlpha?: number;
    hexRadius?: number;
  };
  titleBar?: {
    fill?: HexColor;
    fillAlpha?: number;
    stroke?: HexColor;
    strokeWidth?: number;
    strokeAlpha?: number;
    radius?: number;
    width?: number;
    height?: number;
    y?: number;
  };
  titleText?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fill?: HexColor;
    letterSpacing?: number;
    defaultText?: string;
  };
}

// ── Toast ───────────────────────────────────────────────────────────────────

export interface ToastLayerConfig {
  baseY?: number;
  toastWidth?: number;
  toastHeight?: number;
  margin?: number;
  background?: {
    fill?: HexColor;
    fillAlpha?: number;
    radius?: number;
  };
  accentBar?: {
    width?: number;
    radius?: number;
  };
  border?: {
    strokeWidth?: number;
    strokeAlpha?: number;
    radius?: number;
  };
  text?: {
    fontFamily?: string;
    fontSize?: number;
    fill?: HexColor;
    wordWrapWidth?: number;
  };
  typeColors?: {
    info?: HexColor;
    success?: HexColor;
    warning?: HexColor;
    error?: HexColor;
  };
  animation?: {
    showDurationMs?: number;
    hideDurationMs?: number;
  };
}

// ── Transition ──────────────────────────────────────────────────────────────

export interface TransitionLayerConfig {
  fadeColor?: HexColor;
  defaultFadeInMs?: number;
  defaultFadeOutMs?: number;
}

// ── Presentation ────────────────────────────────────────────────────────────

export interface WinAnimationBlock {
  /** List of animation configs. Exactly one should have enabled:true. */
  animations: WinAnimationConfig[];
}

export interface PresentationLayerConfig {
  enabled?: boolean;
  zIndex?: number;
  sublayers?: Array<{ name: string; zIndex?: number; elements?: any[] }>;
  /** Configurable win animation – pick one by setting enabled:true */
  winAnimation?: WinAnimationBlock;
  [key: string]: unknown;
}

// ── Screen ──────────────────────────────────────────────────────────────────

export interface ScreenLayerConfig {
  enabled?: boolean;
  zIndex?: number;
  sublayers?: Array<{ name: string; zIndex?: number; elements?: any[] }>;
  [key: string]: unknown;
}

// ── Utilities ───────────────────────────────────────────────────────────────

const PUBLIC_BASE = '/game-configs';

function isObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: any): T {
  if (!isObject(base) || !isObject(override)) return (override ?? base) as T;
  const out: any = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const prev = (out as any)[k];
    out[k] = isObject(prev) && isObject(v) ? deepMerge(prev, v) : v;
  }
  return out as T;
}

export function parsePixiColor(input: HexColor | undefined, fallback: number): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input !== 'string') return fallback;

  const s = input.trim().toLowerCase();
  if (s.startsWith('0x')) {
    const n = Number.parseInt(s.slice(2), 16);
    return Number.isFinite(n) ? n : fallback;
  }
  if (s.startsWith('#')) {
    const n = Number.parseInt(s.slice(1), 16);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(appendVersionToUrl(`${PUBLIC_BASE}${path}`), {
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`[LayerConfigManager] Fetch failed (${res.status}): ${path}`);
  return (await res.json()) as T;
}

// ── Manager ─────────────────────────────────────────────────────────────────

export class LayerConfigManager {
  private static instance: LayerConfigManager | null = null;
  private cache: Map<string, any> = new Map();
  private configManager = ConfigManager.getInstance();

  public static getInstance(): LayerConfigManager {
    if (!LayerConfigManager.instance) LayerConfigManager.instance = new LayerConfigManager();
    return LayerConfigManager.instance;
  }

  public clear(): void {
    this.cache.clear();
  }

  private getGameId(): string {
    const cfg = this.configManager.getConfig();
    const id = cfg?.manifest?.id;
    if (!id) throw new Error('[LayerConfigManager] No current game config loaded');
    return id;
  }

  private async getSharedDefaults(): Promise<LayerConfigBundle> {
    const cacheKey = 'shared:layers:defaults';
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const json = await fetchJson<LayerConfigBundle>('/shared/layers/defaults.json');
    this.cache.set(cacheKey, json);
    return json;
  }

  private async getGameLayer<T>(layerFile: string): Promise<T> {
    const gameId = this.getGameId();
    const cacheKey = `${gameId}:${layerFile}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    try {
      const json = await fetchJson<T>(`/games/${gameId}/layers/${layerFile}`);
      this.cache.set(cacheKey, json);
      return json;
    } catch {
      // Game-specific override is optional; return empty object
      const empty = {} as T;
      this.cache.set(cacheKey, empty);
      return empty;
    }
  }

  /**
   * Generic layer config getter.
   * Priority: game-specific layer JSON first → fallback to shared defaults.
   * Used by ConfigDrivenLayer for any layer without a dedicated getter.
   */
  public async getLayerConfig<T = Record<string, any>>(layerFileName: string): Promise<T> {
    const layerKey = layerFileName.replace('.layer.json', '');
    const shared = await this.getSharedDefaults();
    const sharedLayer = (shared as any)[layerKey] ?? {};
    const game = await this.getGameLayer<T>(layerFileName);
    return deepMerge(sharedLayer, game ?? {});
  }

  // ── Public getters ──────────────────────────────────────────────────────

  public async getBackgroundConfig(): Promise<BackgroundLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<BackgroundLayerConfig>('background.layer.json');
    return deepMerge(shared.background ?? {}, game ?? {});
  }

  public async getWinConfig(): Promise<WinLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<WinLayerConfig>('win.layer.json');
    return deepMerge(shared.win ?? {}, game ?? {});
  }

  public async getFeatureConfig(): Promise<FeatureLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<FeatureLayerConfig>('feature.layer.json');
    return deepMerge(shared.feature ?? {}, game ?? {});
  }

  public async getOverlayConfig(): Promise<OverlayLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<OverlayLayerConfig>('overlay.layer.json');
    return deepMerge(shared.overlay ?? {}, game ?? {});
  }

  public async getDebugConfig(): Promise<DebugLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<DebugLayerConfig>('debug.layer.json');
    return deepMerge(shared.debug ?? {}, game ?? {});
  }

  public async getDecorBackConfig(): Promise<DecorBackLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<DecorBackLayerConfig>('decorBack.layer.json');
    return deepMerge(shared.decorBack ?? {}, game ?? {});
  }

  public async getTitleConfig(): Promise<TitleLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<TitleLayerConfig>('title.layer.json');
    return deepMerge(shared.title ?? {}, game ?? {});
  }

  public async getToastConfig(): Promise<ToastLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<ToastLayerConfig>('toast.layer.json');
    return deepMerge(shared.toast ?? {}, game ?? {});
  }

  public async getTransitionConfig(): Promise<TransitionLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<TransitionLayerConfig>('transition.layer.json');
    return deepMerge(shared.transition ?? {}, game ?? {});
  }

  public async getPresentationConfig(): Promise<PresentationLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<PresentationLayerConfig>('presentation.layer.json');
    return deepMerge(shared.presentation ?? {}, game ?? {});
  }

  public async getScreenConfig(): Promise<ScreenLayerConfig> {
    const shared = await this.getSharedDefaults();
    const game = await this.getGameLayer<ScreenLayerConfig>('screen.layer.json');
    return deepMerge(shared.screen ?? {}, game ?? {});
  }
}
