/**
 * FlowSystem - Manages game flow sequences
 */

import { EventBus } from '@/platform/events/EventBus';
import { FlowEvents } from './FlowEvents';
import { FlowType, FlowStep, FlowContext } from './FlowTypes';

export class FlowSystem {
  private static instance: FlowSystem | null = null;

  private eventBus: EventBus;
  private currentFlow: FlowType | null = null;
  private currentStep: FlowStep | null = null;
  private flowQueue: FlowType[] = [];
  private context: FlowContext;
  private isRunning: boolean = false;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.context = this.createDefaultContext();
    this.setupEventListeners();
  }

  public static getInstance(): FlowSystem {
    if (!FlowSystem.instance) {
      FlowSystem.instance = new FlowSystem();
    }
    return FlowSystem.instance;
  }

  private createDefaultContext(): FlowContext {
    return {
      roundId: '',
      bet: 0,
      symbols: [],
      wins: [],
      totalWin: 0,
      features: [],
      data: {},
    };
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:start', (payload) => {
      this.context.bet = payload.bet;
    });

    this.eventBus.on('game:spin:result', (payload) => {
      this.context.symbols = payload.symbols;
      this.context.wins = payload.wins;
      this.context.totalWin = payload.totalWin;
      this.context.features = payload.features;
    });
  }

  public startFlow(flowType: FlowType): void {
    if (this.isRunning) {
      this.flowQueue.push(flowType);
      console.log(`[FlowSystem] Queued flow: ${flowType}`);
      return;
    }

    this.currentFlow = flowType;
    this.isRunning = true;
    console.log(`[FlowSystem] Starting flow: ${flowType}`);

    this.executeFlow(flowType);
  }

  private async executeFlow(flowType: FlowType): Promise<void> {
    switch (flowType) {
      case FlowType.SPIN:
        await this.executeSpinFlow();
        break;
      case FlowType.FREE_SPINS:
        await this.executeFreeSpinsFlow();
        break;
      case FlowType.BONUS:
        await this.executeBonusFlow();
        break;
      case FlowType.WIN_PRESENTATION:
        await this.executeWinPresentationFlow();
        break;
    }

    this.completeFlow();
  }

  private async executeSpinFlow(): Promise<void> {
    this.setStep(FlowStep.SPIN_START);
    await this.delay(100);

    this.setStep(FlowStep.REELS_SPINNING);
    await this.delay(1500);

    this.setStep(FlowStep.REELS_STOPPING);
    await this.delay(500);

    if (this.context.wins.length > 0) {
      this.setStep(FlowStep.WIN_EVALUATION);
      await this.delay(500);
    }

    this.setStep(FlowStep.SPIN_COMPLETE);
  }

  private async executeFreeSpinsFlow(): Promise<void> {
    this.setStep(FlowStep.FEATURE_TRIGGER);
    await this.delay(1000);

    this.setStep(FlowStep.FEATURE_INTRO);
    await this.delay(2000);

    this.setStep(FlowStep.FEATURE_PLAY);
  }

  private async executeBonusFlow(): Promise<void> {
    this.setStep(FlowStep.FEATURE_TRIGGER);
    await this.delay(1000);

    this.setStep(FlowStep.FEATURE_INTRO);
    await this.delay(2000);

    this.setStep(FlowStep.FEATURE_PLAY);
  }

  private async executeWinPresentationFlow(): Promise<void> {
    this.setStep(FlowStep.WIN_EVALUATION);
    await this.delay(500);

    this.setStep(FlowStep.WIN_PRESENTATION);
    await this.delay(2000);
  }

  private setStep(step: FlowStep): void {
    this.currentStep = step;
    console.log(`[FlowSystem] Step: ${step}`);
  }

  private completeFlow(): void {
    console.log(`[FlowSystem] Completed flow: ${this.currentFlow}`);
    
    this.currentFlow = null;
    this.currentStep = null;
    this.isRunning = false;

    if (this.flowQueue.length > 0) {
      const nextFlow = this.flowQueue.shift()!;
      this.startFlow(nextFlow);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public getCurrentFlow(): FlowType | null {
    return this.currentFlow;
  }

  public getCurrentStep(): FlowStep | null {
    return this.currentStep;
  }

  public getContext(): FlowContext {
    return { ...this.context };
  }

  public isFlowRunning(): boolean {
    return this.isRunning;
  }

  public cancelFlow(): void {
    this.isRunning = false;
    this.currentFlow = null;
    this.currentStep = null;
    this.flowQueue = [];
  }

  public reset(): void {
    this.cancelFlow();
    this.context = this.createDefaultContext();
  }
}

export default FlowSystem;
