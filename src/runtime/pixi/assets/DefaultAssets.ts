/**
 * DefaultAssets - Provides fallback assets when game-specific assets are not loaded
 */

import { Graphics, Container, Text, TextStyle, Texture } from 'pixi.js';
import { ConfigManager } from '@/content/ConfigManager';

export interface DefaultAssetConfig {
  backgroundColor: number;
  symbolColors: Record<string, number>;
  fontSize: number;
  fontColor: number;
  cornerRadius: number;
}

const DEFAULT_SYMBOL_COLORS: Record<string, number> = {
  'A': 0xe74c3c,
  'B': 0x3498db,
  'C': 0x2ecc71,
  'D': 0xf39c12,
  'E': 0x9b59b6,
  'F': 0x1abc9c,
  'G': 0xe67e22,
  'H': 0x16a085,
  'I': 0xc0392b,
  'J': 0x2980b9,
  'K': 0x27ae60,
  'L': 0xf1c40f,
  'M': 0x8e44ad,
  'N': 0xd35400,
  'O': 0x2c3e50,
  'P': 0x1abc9c,
  'Q': 0xe91e63,
  'R': 0x9c27b0,
  'S': 0x673ab7,
  'T': 0x3f51b5,
  'W': 0xf1c40f,
  'X': 0xff5722,
  'WILD': 0xf1c40f,
  'SCATTER': 0xe91e63,
  'BONUS': 0x9b59b6,
  'default': 0x2d3748,
};

const DEFAULT_CONFIG: DefaultAssetConfig = {
  backgroundColor: 0x2d3748,
  symbolColors: DEFAULT_SYMBOL_COLORS,
  fontSize: 48,
  fontColor: 0xffffff,
  cornerRadius: 12,
};

/**
 * DefaultAssets provides procedurally generated fallback assets
 */
export class DefaultAssets {
  private static instance: DefaultAssets | null = null;
  
  private configManager: ConfigManager;
  private config: DefaultAssetConfig;
  private generatedTextures: Map<string, Texture> = new Map();

  private constructor() {
    this.configManager = ConfigManager.getInstance();
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfigOverrides();
  }

  public static getInstance(): DefaultAssets {
    if (!DefaultAssets.instance) {
      DefaultAssets.instance = new DefaultAssets();
    }
    return DefaultAssets.instance;
  }

  private loadConfigOverrides(): void {
    const fallbackConfig = this.configManager.getValue<any>('assets.fallback', {});
    if (fallbackConfig.symbolColors) {
      this.config.symbolColors = { ...DEFAULT_SYMBOL_COLORS, ...fallbackConfig.symbolColors };
    }
  }

  /**
   * Create a default symbol container
   */
  public createSymbol(symbolId: string, size: number, fillRatio: number = 0.94): Container {
    const container = new Container();
    container.label = `DefaultSymbol_${symbolId}`;

    // Background — fills most of the cell area
    const bg = new Graphics();
    const color = this.getSymbolColor(symbolId);
    const innerSize = size * fillRatio;
    const offset = (size - innerSize) / 2;

    bg.roundRect(offset, offset, innerSize, innerSize, this.config.cornerRadius);
    bg.fill({ color });
    bg.stroke({ color: 0xffffff, width: 2, alpha: 0.3 });
    container.addChild(bg);

    // Gradient highlight
    const highlight = new Graphics();
    highlight.roundRect(offset + 4, offset + 4, innerSize - 8, innerSize / 3, 8);
    highlight.fill({ color: 0xffffff, alpha: 0.2 });
    container.addChild(highlight);

    // Symbol text (handle multi-character symbols)
    const displayText = symbolId.length > 2 ? symbolId.charAt(0) : symbolId;
    const fontSize = symbolId.length > 1 ? this.config.fontSize * 0.7 : this.config.fontSize;
    
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: fontSize,
      fontWeight: 'bold',
      fill: this.config.fontColor,
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 2,
        angle: Math.PI / 4,
        alpha: 0.5,
      },
    });

    const text = new Text({ text: displayText, style });
    text.anchor.set(0.5);
    text.x = size / 2;
    text.y = size / 2;
    container.addChild(text);

    return container;
  }

  /**
   * Create a default background
   */
  public createBackground(width: number, height: number): Container {
    const container = new Container();
    container.label = 'DefaultBackground';

    // Gradient background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0x0f0f23 });
    container.addChild(bg);

    // Add some subtle grid lines
    const grid = new Graphics();
    const gridSize = 50;
    grid.stroke({ color: 0x1a1a2e, width: 1, alpha: 0.5 });
    
    for (let x = 0; x <= width; x += gridSize) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.stroke();
    container.addChild(grid);

    // Add corner accents
    const accentColor = 0x8b5cf6;
    const accent = new Graphics();
    const accentSize = 100;
    
    // Top-left
    accent.moveTo(0, accentSize);
    accent.lineTo(0, 0);
    accent.lineTo(accentSize, 0);
    accent.stroke({ color: accentColor, width: 3, alpha: 0.5 });

    // Top-right
    accent.moveTo(width - accentSize, 0);
    accent.lineTo(width, 0);
    accent.lineTo(width, accentSize);
    accent.stroke();

    // Bottom-left
    accent.moveTo(0, height - accentSize);
    accent.lineTo(0, height);
    accent.lineTo(accentSize, height);
    accent.stroke();

    // Bottom-right
    accent.moveTo(width - accentSize, height);
    accent.lineTo(width, height);
    accent.lineTo(width, height - accentSize);
    accent.stroke();

    container.addChild(accent);

    return container;
  }

  /**
   * Create a default frame
   */
  public createFrame(width: number, height: number, padding: number = 20): Container {
    const container = new Container();
    container.label = 'DefaultFrame';

    const frame = new Graphics();
    const x = -padding;
    const y = -padding;
    const w = width + padding * 2;
    const h = height + padding * 2;

    // Outer border
    frame.roundRect(x, y, w, h, 16);
    frame.stroke({ color: 0x4a5568, width: 4 });

    // Inner border
    frame.roundRect(x + 4, y + 4, w - 8, h - 8, 12);
    frame.stroke({ color: 0x2d3748, width: 2 });

    // Corner decorations
    const cornerSize = 30;
    const corners = [
      { x: x, y: y },
      { x: x + w - cornerSize, y: y },
      { x: x, y: y + h - cornerSize },
      { x: x + w - cornerSize, y: y + h - cornerSize },
    ];

    for (const corner of corners) {
      frame.roundRect(corner.x, corner.y, cornerSize, cornerSize, 8);
      frame.fill({ color: 0x8b5cf6, alpha: 0.3 });
    }

    container.addChild(frame);
    return container;
  }

  /**
   * Create a default button
   */
  public createButton(width: number, height: number, label: string, color: number = 0x8b5cf6): Container {
    const container = new Container();
    container.label = `DefaultButton_${label}`;

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, height / 4);
    bg.fill({ color });
    bg.stroke({ color: 0xffffff, width: 2, alpha: 0.3 });
    container.addChild(bg);

    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xffffff,
    });

    const text = new Text({ text: label, style });
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    container.addChild(text);

    return container;
  }

  /**
   * Create a placeholder texture
   */
  public createPlaceholderTexture(width: number, height: number): Texture {
    const key = `placeholder_${width}x${height}`;
    
    if (this.generatedTextures.has(key)) {
      return this.generatedTextures.get(key)!;
    }

    // Return empty/white texture as placeholder
    return Texture.WHITE;
  }

  /**
   * Get color for symbol
   */
  public getSymbolColor(symbolId: string): number {
    const upperSymbol = symbolId.toUpperCase();
    return this.config.symbolColors[upperSymbol] ?? 
           this.config.symbolColors[symbolId] ?? 
           this.config.symbolColors['default'] ?? 
           0x2d3748;
  }

  /**
   * Create default win highlight
   */
  public createWinHighlight(width: number, height: number, color: number = 0xf1c40f): Container {
    const container = new Container();
    container.label = 'DefaultWinHighlight';

    const highlight = new Graphics();
    highlight.roundRect(-4, -4, width + 8, height + 8, 16);
    highlight.fill({ color, alpha: 0.3 });
    highlight.stroke({ color, width: 4 });

    container.addChild(highlight);
    return container;
  }

  /**
   * Clear generated textures
   */
  public clearCache(): void {
    for (const texture of this.generatedTextures.values()) {
      texture.destroy(true);
    }
    this.generatedTextures.clear();
  }

  public destroy(): void {
    this.clearCache();
    DefaultAssets.instance = null;
  }
}

export default DefaultAssets;
