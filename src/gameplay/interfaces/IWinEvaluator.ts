/**
 * IWinEvaluator - Interface for win evaluation strategies
 */

 import { Position } from '../models/RoundModel';
 
 // Use simplified WinInfo that matches what evaluators produce
 export interface EvaluatedWin {
   lineId: number;
   symbols: string[];
   positions: Position[];
   amount: number;
   multiplier: number;
 }

export interface EvaluationConfig {
  paylines?: number[][];
  waysCount?: number;
  clusterSize?: number;
  reelHeights?: number[];
}

export interface EvaluationResult {
   wins: EvaluatedWin[];
  totalWin: number;
  hasWin: boolean;
  winType: 'normal' | 'big' | 'mega' | 'epic';
}

export interface IWinEvaluator {
  readonly id: string;
  readonly type: 'lines' | 'ways' | 'cluster' | 'megaways';

  evaluate(
    matrix: string[][],
    bet: number,
    paytable: Map<string, number[]>,
    config?: EvaluationConfig
  ): EvaluationResult;

   getWinningPositions(wins: EvaluatedWin[]): Position[];
}

export default IWinEvaluator;
