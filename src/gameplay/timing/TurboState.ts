/**
 * TurboState - Singleton that tracks turbo mode on/off.
 *
 * The TimingProvider reads speedMultiplier from here and divides
 * all timing values accordingly so callers need zero changes.
 */

import { EventBus } from '@/platform/events/EventBus';

export class TurboState {
  private static instance: TurboState | null = null;

  private _active = false;
  private _speedMultiplier = 2; // default; overridden from config

  private constructor() {}

  public static getInstance(): TurboState {
    if (!TurboState.instance) TurboState.instance = new TurboState();
    return TurboState.instance;
  }

  /** Call once after timings config is loaded to pick up the configured multiplier */
  public setSpeedMultiplier(value: number): void {
    this._speedMultiplier = Math.max(1, value);
  }

  public getSpeedMultiplier(): number {
    return this._speedMultiplier;
  }

  public isActive(): boolean {
    return this._active;
  }

  public toggle(): void {
    this._active = !this._active;
    EventBus.getInstance().emit('ui:turbo:changed', { active: this._active, speedMultiplier: this._speedMultiplier });
    console.log(`[TurboState] Turbo ${this._active ? 'ON' : 'OFF'} (${this._speedMultiplier}x)`);
  }

  public setActive(value: boolean): void {
    if (this._active !== value) this.toggle();
  }

  /** Effective divisor to apply to a timing value */
  public divisor(): number {
    return this._active ? this._speedMultiplier : 1;
  }

  public static reset(): void {
    TurboState.instance = null;
  }
}
