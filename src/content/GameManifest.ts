/**
 * GameManifest - Type definitions for game configuration files
 */

export interface SpinConfigPartial {
  maxSpeed?: number;
  acceleration?: number;
  deceleration?: number;
  bounceStrength?: number;
  staggerDelay?: number;
  anticipationDuration?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  spiralTightness?: number;
  zoomScale?: number;
}
export interface GameManifest {
  id: string;
  name: string;
  version: string;
  description: string;

  grid: GridManifest;
  symbols: SymbolsManifest;
  features: FeaturesManifest;
  paylines: PaylinesManifest;
  rtp: RTPManifest;
  assets: AssetsManifest;
  theme: ThemeManifest;
}

export interface GridManifest {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  spacing: number;
}

export interface SymbolsManifest {
  high: string[];
  low: string[];
  special: string[];
}

export interface FeatureConfig {
  spinStrategy: string;
  spinConfig: SpinConfigPartial;
  triggerSymbol?: string;
  triggerCount?: number;
  initialSpins?: number;
  stickyWilds?: boolean;
  picks?: number;
}

export interface FeaturesManifest {
  baseGame: FeatureConfig;
  freeSpins?: FeatureConfig;
  holdRespin?: FeatureConfig;
  [key: string]: FeatureConfig | undefined;
}

export interface PaylinesManifest {
  type: 'lines' | 'ways' | 'cluster' | 'megaways';
  count: number;
  patterns?: number[][];
}

export interface RTPManifest {
  base: number;
  withFeatures: number;
}

export interface AssetEntry {
  type: 'texture' | 'spritesheet' | 'audio' | 'font' | 'json' | 'spine';
  key: string;
  url: string;
  imageUrl?: string;
  dataUrl?: string;
}

export interface AssetsManifest {
  basePath: string;
  preload: AssetEntry[];
}

export interface ThemeManifest {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

export interface LayoutManifest {
  virtualWidth: number;
  virtualHeight: number;
  grid: {
    x: number;
    y: number;
    cols: number;
    rows: number;
    cellWidth: number;
    cellHeight: number;
    spacing: number;
  };
  hud: {
    topBar: HudBarConfig;
    bottomBar: HudBarConfig;
  };
  decorations?: DecorationConfig[];
  layers: Record<string, { zIndex: number }>;
}

export interface HudBarConfig {
  height: number;
  elements: HudElement[];
}

export interface HudElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  texture?: string;
}

export interface DecorationConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  texture: string;
}

export interface SymbolMapManifest {
  symbols: Record<string, SymbolDefinition>;
  reelStrips: Record<string, string[][]>;
}

export interface SymbolDefinition {
  id: string;
  name: string;
  type: 'high' | 'low' | 'special';
  color: string;
  payouts: number[];
  substitutes?: boolean;
  triggersFeature?: string;
  expandsOnFreeSpins?: boolean;
  animations: {
    idle: string;
    win: string;
    land?: string;
    expand?: string;
    trigger?: string;
  };
}
