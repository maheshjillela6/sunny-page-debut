/**
 * SymbolStateMachine - State machine for symbol behavior
 */

import { SymbolView } from './SymbolView';
import { SymbolAnimator, SymbolAnimationType } from './SymbolAnimator';

export enum SymbolState {
  IDLE = 'idle',
  SPINNING = 'spinning',
  STOPPING = 'stopping',
  LANDED = 'landed',
  WINNING = 'winning',
  ANTICIPATING = 'anticipating',
}

export class SymbolStateMachine {
  private symbol: SymbolView;
  private animator: SymbolAnimator;
  private currentState: SymbolState = SymbolState.IDLE;
  private stateTime: number = 0;

  constructor(symbol: SymbolView) {
    this.symbol = symbol;
    this.animator = new SymbolAnimator(symbol);
  }

  public setState(state: SymbolState): void {
    if (this.currentState === state) return;

    this.exitState(this.currentState);
    this.currentState = state;
    this.stateTime = 0;
    this.enterState(state);
  }

  private enterState(state: SymbolState): void {
    switch (state) {
      case SymbolState.WINNING:
        this.animator.playWin();
        break;
      case SymbolState.LANDED:
        this.animator.playLand();
        break;
      case SymbolState.ANTICIPATING:
        this.animator.playAnticipate();
        break;
    }
  }

  private exitState(state: SymbolState): void {
    this.animator.stop();
  }

  public update(deltaTime: number): void {
    this.stateTime += deltaTime;
    this.animator.update(deltaTime);
  }

  public getState(): SymbolState {
    return this.currentState;
  }

  public getStateTime(): number {
    return this.stateTime;
  }

  public reset(): void {
    this.setState(SymbolState.IDLE);
    this.stateTime = 0;
  }
}
