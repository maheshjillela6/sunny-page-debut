/**
 * MaskContainer - Container with masking support
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import { BaseContainer, ContainerConfig } from './BaseContainer';

export interface MaskConfig extends ContainerConfig {
  maskWidth?: number;
  maskHeight?: number;
  maskX?: number;
  maskY?: number;
  rounded?: number;
}

/**
 * Container with built-in rectangular or rounded mask.
 */
export class MaskContainer extends BaseContainer {
  private maskGraphics: Graphics;
  private contentContainer: Container;
  private maskConfig: MaskConfig;

  constructor(config: MaskConfig = {}) {
    super(config);

    this.maskConfig = config;
    this.contentContainer = new Container();
    this.contentContainer.label = 'MaskContent';
    
    this.maskGraphics = new Graphics();
    this.updateMask();

    super.addChild(this.contentContainer);
    super.addChild(this.maskGraphics);
    this.contentContainer.mask = this.maskGraphics;
  }

  /** Update the mask dimensions */
  private updateMask(): void {
    const width = this.maskConfig.maskWidth ?? 100;
    const height = this.maskConfig.maskHeight ?? 100;
    const x = this.maskConfig.maskX ?? 0;
    const y = this.maskConfig.maskY ?? 0;
    const rounded = this.maskConfig.rounded ?? 0;

    this.maskGraphics.clear();
    
    if (rounded > 0) {
      this.maskGraphics.roundRect(x, y, width, height, rounded);
    } else {
      this.maskGraphics.rect(x, y, width, height);
    }
    
    this.maskGraphics.fill({ color: 0xffffff });
  }

  /** Set mask dimensions */
  public setMaskSize(width: number, height: number): void {
    this.maskConfig.maskWidth = width;
    this.maskConfig.maskHeight = height;
    this.updateMask();
  }

  /** Set mask position */
  public setMaskPosition(x: number, y: number): void {
    this.maskConfig.maskX = x;
    this.maskConfig.maskY = y;
    this.updateMask();
  }

  /** Set mask rounding */
  public setMaskRounding(rounded: number): void {
    this.maskConfig.rounded = rounded;
    this.updateMask();
  }

  /** Get the content container */
  public getContent(): Container {
    return this.contentContainer;
  }

  /** Add child to content container */
  public addContent(child: Container): void {
    this.contentContainer.addChild(child);
  }

  /** Remove child from content container */
  public removeContent(child: Container): void {
    this.contentContainer.removeChild(child);
  }

  /** Destroy mask container */
  public override destroy(): void {
    this.maskGraphics.destroy();
    this.contentContainer.destroy({ children: true });
    super.destroy();
  }
}
