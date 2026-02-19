/**
 * StageDebugInfo - Debug information overlay
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { StageManager } from './StageManager';
import { StageLayer } from './StageRoot';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../core/PixiRuntime';

/**
 * Debug overlay showing stage information.
 */
export class StageDebugInfo {
  private container: Container;
  private background: Graphics;
  private textContainer: Container;
  private texts: Text[] = [];
  private textStyle: TextStyle;

  constructor() {
    this.container = new Container();
    this.container.label = 'DebugInfo';

    this.textStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0x00ff00,
    });

    // Background
    this.background = new Graphics();
    this.background.rect(10, 10, 200, 150);
    this.background.fill({ color: 0x000000, alpha: 0.7 });
    this.container.addChild(this.background);

    // Text container
    this.textContainer = new Container();
    this.textContainer.x = 15;
    this.textContainer.y = 15;
    this.container.addChild(this.textContainer);
  }

  /** Get the debug container */
  public getContainer(): Container {
    return this.container;
  }

  /** Update debug info */
  public update(fps: number, layerCounts: Record<string, number>): void {
    // Clear existing texts
    for (const text of this.texts) {
      text.destroy();
    }
    this.texts = [];
    this.textContainer.removeChildren();

    let y = 0;
    const lineHeight = 14;

    // FPS
    const fpsText = new Text({ text: `FPS: ${fps.toFixed(1)}`, style: this.textStyle });
    fpsText.y = y;
    this.textContainer.addChild(fpsText);
    this.texts.push(fpsText);
    y += lineHeight;

    // Resolution
    const resText = new Text({ 
      text: `Virtual: ${VIRTUAL_WIDTH}x${VIRTUAL_HEIGHT}`, 
      style: this.textStyle 
    });
    resText.y = y;
    this.textContainer.addChild(resText);
    this.texts.push(resText);
    y += lineHeight;

    // Layer counts
    for (const [name, count] of Object.entries(layerCounts)) {
      const layerText = new Text({ 
        text: `${name}: ${count}`, 
        style: this.textStyle 
      });
      layerText.y = y;
      this.textContainer.addChild(layerText);
      this.texts.push(layerText);
      y += lineHeight;
    }

    // Update background size
    this.background.clear();
    this.background.rect(10, 10, 200, y + 20);
    this.background.fill({ color: 0x000000, alpha: 0.7 });
  }

  /** Show debug info */
  public show(): void {
    this.container.visible = true;
  }

  /** Hide debug info */
  public hide(): void {
    this.container.visible = false;
  }

  /** Destroy debug info */
  public destroy(): void {
    for (const text of this.texts) {
      text.destroy();
    }
    this.texts = [];
    this.container.destroy({ children: true });
  }
}
