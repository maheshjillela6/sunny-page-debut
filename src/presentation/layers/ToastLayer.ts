/**
 * ToastLayer - Layer for toast notifications with enhanced visuals
 * Data-driven via /public/game-configs/games/<id>/layers/toast.layer.json
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { LayerContainer } from '../../runtime/pixi/containers/LayerContainer';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { vw } from '../../runtime/pixi/core/VirtualDims';
import { PixiFactory } from '../../runtime/pixi/factory/PixiFactory';
import { TweenFactory } from '../../runtime/animation/TweenFactory';
import {
  LayerConfigManager,
  parsePixiColor,
  type ToastLayerConfig,
} from './config/LayerConfigManager';

interface ToastItem {
  container: Container;
  removeAt: number;
  targetY: number;
}

type ToastType = 'info' | 'success' | 'warning' | 'error';

export class ToastLayer extends LayerContainer {
  private toasts: ToastItem[] = [];
  private factory: PixiFactory;

  private cfg: ToastLayerConfig = {};
  private cfgManager = LayerConfigManager.getInstance();

  constructor() {
    super({
      name: 'ToastLayer',
      zIndex: StageLayer.TOAST,
    });

    this.factory = PixiFactory.getInstance();

    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      this.cfg = await this.cfgManager.getToastConfig();
    } catch (e) {
      console.error('[ToastLayer] Failed to load toast layer config:', e);
      this.cfg = {};
    }
  }

  private getToastColor(type: ToastType): number {
    const tc = this.cfg.typeColors ?? {};
    const colorMap: Record<ToastType, number> = {
      info: parsePixiColor(tc.info, 0x3b82f6),
      success: parsePixiColor(tc.success, 0x22c55e),
      warning: parsePixiColor(tc.warning, 0xf59e0b),
      error: parsePixiColor(tc.error, 0xef4444),
    };
    return colorMap[type];
  }

  public showToast(message: string, duration: number = 3000, type: ToastType = 'info'): void {
    const container = new Container();
    const color = this.getToastColor(type);

    const toastWidth = this.cfg.toastWidth ?? 300;
    const toastHeight = this.cfg.toastHeight ?? 50;
    const baseY = this.cfg.baseY ?? 20;
    const margin = this.cfg.margin ?? 10;

    const bgCfg = this.cfg.background ?? {};
    const background = this.factory.createRect(0, 0, toastWidth, toastHeight, {
      fill: parsePixiColor(bgCfg.fill, 0x1a1f2e),
      fillAlpha: bgCfg.fillAlpha ?? 0.95,
      radius: bgCfg.radius ?? 8,
    });
    container.addChild(background);

    // Left accent bar
    const abCfg = this.cfg.accentBar ?? {};
    const accent = this.factory.createRect(0, 0, abCfg.width ?? 4, toastHeight, {
      fill: color,
      radius: abCfg.radius ?? 2,
    });
    container.addChild(accent);

    // Border
    const bCfg = this.cfg.border ?? {};
    const border = this.factory.createRect(0, 0, toastWidth, toastHeight, {
      stroke: color,
      strokeWidth: bCfg.strokeWidth ?? 1,
      strokeAlpha: bCfg.strokeAlpha ?? 0.5,
      radius: bCfg.radius ?? 8,
    });
    container.addChild(border);

    // Text
    const tCfg = this.cfg.text ?? {};
    const style = new TextStyle({
      fontFamily: tCfg.fontFamily ?? 'Arial',
      fontSize: tCfg.fontSize ?? 14,
      fill: parsePixiColor(tCfg.fill, 0xffffff),
      wordWrap: true,
      wordWrapWidth: tCfg.wordWrapWidth ?? 270,
    });

    const text = new Text({ text: message, style });
    text.x = 15;
    text.y = toastHeight / 2 - 7;
    container.addChild(text);

    // Position — use dynamic vw()
    const targetY = baseY + this.toasts.length * (toastHeight + margin);
    container.x = (vw() - toastWidth) / 2;
    container.y = -toastHeight;
    container.alpha = 0;

    this.addChild(container);

    const toast: ToastItem = {
      container,
      removeAt: performance.now() + duration,
      targetY,
    };

    this.toasts.push(toast);
    this.animateIn(container, targetY);
  }

  private animateIn(container: Container, targetY: number): void {
    const animCfg = this.cfg.animation ?? {};
    const duration = (animCfg.showDurationMs ?? 300) / 1000;

    TweenFactory.to(container, {
      y: targetY,
      alpha: 1,
      duration: duration,
      ease: 'cubic.out',
    });
  }

  private animateOut(container: Container, onComplete: () => void): void {
    const animCfg = this.cfg.animation ?? {};
    const duration = (animCfg.hideDurationMs ?? 200) / 1000;

    TweenFactory.to(container, {
      alpha: 0,
      duration: duration,
      onComplete: onComplete,
    });
  }

  public update(): void {
    const now = performance.now();
    const toRemove: ToastItem[] = [];
    const toastHeight = this.cfg.toastHeight ?? 50;
    const margin = this.cfg.margin ?? 10;
    const baseY = this.cfg.baseY ?? 20;

    for (const toast of this.toasts) {
      if (now >= toast.removeAt) {
        toRemove.push(toast);
      }
    }

    for (const toast of toRemove) {
      this.animateOut(toast.container, () => {
        this.removeChild(toast.container);
        toast.container.destroy({ children: true });
      });

      const index = this.toasts.indexOf(toast);
      if (index > -1) {
        this.toasts.splice(index, 1);
      }
    }

    // Reposition remaining toasts
    this.toasts.forEach((toast, index) => {
      const newTargetY = baseY + index * (toastHeight + margin);
      if (toast.targetY !== newTargetY) {
        toast.targetY = newTargetY;
        // Simple lerp for repositioning, could also be tweened but update loop handles it
        toast.container.y += (newTargetY - toast.container.y) * 0.2;
      }
    });
  }

  public clearAll(): void {
    for (const toast of this.toasts) {
      TweenFactory.kill(toast.container);
      this.removeChild(toast.container);
      toast.container.destroy({ children: true });
    }
    this.toasts = [];
  }
}
