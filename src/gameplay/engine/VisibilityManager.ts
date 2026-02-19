/**
 * VisibilityManager - Handles document visibility changes
 */

import { EventBus } from '@/platform/events/EventBus';
import { PauseManager } from './PauseManager';

export class VisibilityManager {
  private static instance: VisibilityManager | null = null;

  private eventBus: EventBus;
  private pauseManager: PauseManager;
  private isVisible: boolean = true;
  private hiddenAt: number = 0;
  private totalHiddenTime: number = 0;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.pauseManager = PauseManager.getInstance();
    
    this.setupEventListeners();
  }

  public static getInstance(): VisibilityManager {
    if (!VisibilityManager.instance) {
      VisibilityManager.instance = new VisibilityManager();
    }
    return VisibilityManager.instance;
  }

  private setupEventListeners(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // iOS Safari specific handling
    window.addEventListener('pagehide', () => {
      this.handleHide();
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        this.handleShow();
      }
    });
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.handleHide();
    } else {
      this.handleShow();
    }
  }

  private handleHide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.hiddenAt = Date.now();

    this.pauseManager.pause('blur');
    this.eventBus.emit('renderer:visibility', { isVisible: false });

    console.log('[VisibilityManager] Page hidden');
  }

  private handleShow(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    const hiddenDuration = Date.now() - this.hiddenAt;
    this.totalHiddenTime += hiddenDuration;

    this.pauseManager.resume('blur');
    this.eventBus.emit('renderer:visibility', { isVisible: true });

    console.log(`[VisibilityManager] Page visible after ${hiddenDuration}ms`);

    // Check if session needs refresh after long absence
    if (hiddenDuration > 60000) {
      this.checkSessionValidity();
    }
  }

  private checkSessionValidity(): void {
    // Could trigger session refresh or reconnect
    console.log('[VisibilityManager] Checking session after long absence');
  }

  public isPageVisible(): boolean {
    return this.isVisible;
  }

  public getTotalHiddenTime(): number {
    return this.totalHiddenTime;
  }

  public destroy(): void {
    VisibilityManager.instance = null;
  }
}

export default VisibilityManager;
