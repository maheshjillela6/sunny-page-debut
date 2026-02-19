/**
 * IGameFeature - Interface for game feature plugins
 */

import { FeatureMode } from '../models/FeatureModel';
import { MoneyValue } from '../models/WalletModel';

export interface FeatureTriggerCondition {
  symbol: string;
  count: number;
  positions?: { row: number; col: number }[];
}

export interface FeatureConfig {
  id: string;
  name: string;
  mode: FeatureMode;
  triggerCondition: FeatureTriggerCondition;
  initialValue?: number; // spins, respins, picks, etc.
  multiplier?: number;
  stickyEnabled?: boolean;
  retriggerEnabled?: boolean;
}

export interface IGameFeature {
  readonly id: string;
  readonly name: string;
  readonly mode: FeatureMode;

  initialize(config: FeatureConfig): void;
  
  checkTrigger(matrix: string[][]): { triggered: boolean; positions: { row: number; col: number }[] };
  
  start(config: FeatureConfig): void;
  
  update(deltaTime: number): void;
  
  handleStep(stepData: any): { win: MoneyValue; complete: boolean };
  
  end(): { totalWin: MoneyValue };
  
  isActive(): boolean;
  
  getProgress(): { current: number; total: number };
  
  destroy(): void;
}

export default IGameFeature;
