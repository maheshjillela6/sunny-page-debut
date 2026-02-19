/**
 * BaseScreenLayout - Layout configuration for base screen
 * Now uses ConfigManager for all configuration values
 */

import { ConfigManager } from '../../../content/ConfigManager';
import { vw, vh } from '../../../runtime/pixi/core/VirtualDims';

export interface BaseScreenLayoutConfig {
  grid: {
    cols: number;
    rows: number;
    cellWidth: number;
    cellHeight: number;
    spacing: number;
    x: number;
    y: number;
  };
  hud: {
    topBarHeight: number;
    bottomBarHeight: number;
  };
}

export class BaseScreenLayout {
  /**
   * Create layout from ConfigManager (preferred method)
   * Uses game-specific config > global > defaults hierarchy
   */
  public static createFromConfig(): BaseScreenLayoutConfig {
    const configManager = ConfigManager.getInstance();
    const layoutConfig = configManager.getLayoutConfig();
    const gridConfig = configManager.getGridConfig();
    
    // Get grid dimensions from config
    const cols = gridConfig?.cols ?? 5;
    const rows = gridConfig?.rows ?? 3;
    const cellWidth = gridConfig?.cellWidth ?? 120;
    const cellHeight = gridConfig?.cellHeight ?? 120;
    const spacing = gridConfig?.spacing ?? 8;
    
    // Calculate grid dimensions
    const gridWidth = cols * cellWidth + (cols - 1) * spacing;
    const gridHeight = rows * cellHeight + (rows - 1) * spacing;
    
    // Get position from layout config or center the grid using dynamic dims
    const x = layoutConfig?.grid?.x ?? Math.round((vw() - gridWidth) / 2);
    const y = layoutConfig?.grid?.y ?? Math.round((vh() - gridHeight) / 2 + 30);
    
    // Get HUD heights from layout config
    const topBarHeight = layoutConfig?.hud?.topBar?.height ?? 60;
    const bottomBarHeight = layoutConfig?.hud?.bottomBar?.height ?? 100;

    return {
      grid: {
        cols,
        rows,
        cellWidth,
        cellHeight,
        spacing,
        x,
        y,
      },
      hud: {
        topBarHeight,
        bottomBarHeight,
      },
    };
  }

  /**
   * Create default layout (fallback when no config loaded)
   */
  public static createDefault(): BaseScreenLayoutConfig {
    const gridWidth = 5 * 120 + 4 * 8;
    const gridHeight = 3 * 120 + 2 * 8;

    return {
      grid: {
        cols: 5,
        rows: 3,
        cellWidth: 120,
        cellHeight: 120,
        spacing: 8,
        x: Math.round((vw() - gridWidth) / 2),
        y: Math.round((vh() - gridHeight) / 2 + 30),
      },
      hud: {
        topBarHeight: 60,
        bottomBarHeight: 80,
      },
    };
  }
}
