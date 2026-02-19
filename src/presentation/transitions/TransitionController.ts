/**
 * TransitionController - Controls screen transitions
 */

import { Container } from 'pixi.js';
import { TransitionLayer } from '../layers/TransitionLayer';
import { FadeTransition } from './FadeTransition';
import { EventBus } from '../../platform/events/EventBus';

export type TransitionType = 'fade' | 'portal' | 'zoom' | 'slide';

export class TransitionController {
  private static instance: TransitionController | null = null;

  private transitionLayer: TransitionLayer | null = null;
  private currentTransition: TransitionType = 'fade';
  private isTransitioning: boolean = false;
  private eventBus: EventBus;

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): TransitionController {
    if (!TransitionController.instance) {
      TransitionController.instance = new TransitionController();
    }
    return TransitionController.instance;
  }

  public initialize(transitionLayer: TransitionLayer): void {
    this.transitionLayer = transitionLayer;
  }

  public async transition(
    type: TransitionType,
    duration: number = 300
  ): Promise<void> {
    if (this.isTransitioning || !this.transitionLayer) return;

    this.isTransitioning = true;
    this.currentTransition = type;

    await this.transitionLayer.fadeIn(duration / 2);
    await this.transitionLayer.fadeOut(duration / 2);

    this.isTransitioning = false;
  }

  public async fadeIn(duration: number = 300): Promise<void> {
    if (!this.transitionLayer) return;
    await this.transitionLayer.fadeIn(duration);
  }

  public async fadeOut(duration: number = 300): Promise<void> {
    if (!this.transitionLayer) return;
    await this.transitionLayer.fadeOut(duration);
  }

  public isActive(): boolean {
    return this.isTransitioning;
  }

  public destroy(): void {
    TransitionController.instance = null;
  }
}
