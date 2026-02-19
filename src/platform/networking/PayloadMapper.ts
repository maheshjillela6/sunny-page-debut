/**
 * PayloadMapper - Maps API payloads to internal models and provides utilities
 */

import { 
  GameLaunchResponse, 
  SpinResponse, 
  FeatureActionResponse, 
  BuyBonusResponse,
  MoneyValue,
  StepWinInfo,
  TumbleInfo,
  MultiplierInfo,
  LockedItem,
  SeriesData,
  FeatureQueue,
  Position,
  SpinStep,
  ResultStep,
  CascadeStep,
} from './APIProtocol';

export class PayloadMapper {
  /**
   * Parse matrix string to 2D array.
   * Handles multi-char symbols like "10" by scanning for known patterns.
   */
  public static parseMatrix(matrixString: string): string[][] {
    if (!matrixString) return [];
    return matrixString.split(';').map(row => this.parseMatrixRow(row));
  }

  /** Parse a single matrix row, handling multi-char symbols like "10" */
  private static parseMatrixRow(rowStr: string): string[] {
    const symbols: string[] = [];
    let i = 0;
    while (i < rowStr.length) {
      if (rowStr[i] === '1' && i + 1 < rowStr.length && rowStr[i + 1] === '0') {
        symbols.push('10');
        i += 2;
      } else {
        symbols.push(rowStr[i]);
        i++;
      }
    }
    return symbols;
  }

  // Convert 2D array to matrix string
  public static matrixToString(matrix: string[][]): string {
    return matrix.map(row => row.join('')).join(';');
  }

  // Map game launch response data
  public static mapGameLaunch(response: GameLaunchResponse['data']) {
    return {
      userId: response.userId,
      gameId: response.gameId,
      gameName: response.gamename,
      gameType: response.gameType,
      currency: response.currency,
      balance: response.balance,
      reels: response.reels,
      config: response.config,
      previousRound: response.previousRound,
      state: response.state,
      pendingSeries: response.pendingSeries,
      unfinished: response.unfinished,
      hasUnfinished: response.unfinished?.exists ?? false,
    };
  }

  // Map spin response data (steps-based format)
  public static mapSpin(response: SpinResponse['data']) {
    const steps = response.steps || [];
    const resultStep = steps.find((s): s is ResultStep => s.type === 'RESULT');
    const cascadeSteps = steps.filter((s): s is CascadeStep => s.type === 'CASCADE');

    const matrixString = resultStep?.grid?.matrixString || response.round.matrixString;
    const initialWins = resultStep?.wins || [];

    return {
      roundId: response.round.roundId,
      roundSeq: response.round.roundSeq,
      mode: response.round.mode,
      matrixString,
      matrix: this.parseMatrix(matrixString),
      waysCount: response.round.waysCount || 1024,
      stake: response.stake,
      win: response.win,
      wins: initialWins,
      steps,
      cascadeSteps,
      hasCascade: cascadeSteps.length > 0,
      multipliers: response.multipliers || { global: 1, sources: [] },
      mystery: response.mystery,
      expanding: response.expanding,
      jackpot: response.jackpot,
      balance: response.balance,
      featuresTriggered: response.featuresTriggered || [],
      featureQueue: response.featureQueue || [],
      series: response.series,
      nextAction: response.nextAction,
      hasFeatures: (response.featuresTriggered?.length || 0) > 0,
    };
  }

  // Map feature action response data
  public static mapFeatureAction(response: FeatureActionResponse['data']) {
    return {
      balance: response.balance,
      series: response.series,
      step: response.step ? {
        stepId: response.step.stepId,
        roundId: response.step.roundId,
        matrixString: response.step.matrixString,
        matrix: this.parseMatrix(response.step.matrixString),
        win: response.step.win,
        multipliers: response.step.multipliers || { global: 1, sources: [] },
        retrigger: response.step.retrigger,
      } : undefined,
      hns: response.hns ? {
        startLives: response.hns.startLives,
        livesLeft: response.hns.livesLeft || 0,
        lockedItems: response.hns.lockedItems || [],
        totalCollected: response.hns.totalCollected || 0,
      } : undefined,
      jackpot: response.jackpot,
      nextAction: response.nextAction,
      isComplete: !response.nextAction.allowed.includes('PLAY'),
    };
  }

  // Map buy bonus response data
  public static mapBuyBonus(response: BuyBonusResponse['data']) {
    return {
      purchaseId: response.purchase.purchaseId,
      featureCode: response.purchase.featureCode,
      charged: response.purchase.charged,
      balance: response.balance,
      round: response.round,
      series: response.series,
      hns: response.hns ? {
        startLives: response.hns.startLives,
        lockedItems: response.hns.lockedItems || [],
        corPositions: response.hns.corPositions?.split(',').map(Number) || [],
        corValues: response.hns.corValues?.split(',').map(Number) || [],
      } : undefined,
      featureQueue: response.featureQueue,
      nextAction: response.nextAction,
    };
  }

  // Calculate total win from steps
  public static calculateTotalWin(
    baseWin: MoneyValue,
    steps: SpinStep[]
  ): number {
    // The total win is already in the response, but this can derive it from steps
    let total = 0;
    for (const step of steps) {
      if (step.type === 'RESULT') {
        total += step.totalWin.amount;
      } else if (step.type === 'CASCADE') {
        total += step.stepWin.amount;
      }
    }
    return total || baseWin.amount;
  }

  // Get winning positions from step wins
  public static getWinningPositions(wins: StepWinInfo[]): Position[] {
    const positions: Position[] = [];
    const seen = new Set<string>();

    for (const win of wins) {
      for (const pos of win.positions) {
        const key = `${pos.row},${pos.col}`;
        if (!seen.has(key)) {
          seen.add(key);
          positions.push(pos);
        }
      }
    }

    return positions;
  }

  // Check if a position is winning
  public static isWinningPosition(
    row: number,
    col: number,
    wins: StepWinInfo[]
  ): boolean {
    return wins.some(win =>
      win.positions.some(pos => pos.row === row && pos.col === col)
    );
  }

  // Format money value for display
  public static formatMoney(value: MoneyValue): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: value.currency,
    }).format(value.amount);
  }

  // Get multiplier display text
  public static formatMultiplier(multipliers: MultiplierInfo): string {
    if (multipliers.global <= 1) return '';
    return `x${multipliers.global}`;
  }

  // Get next feature from queue
  public static getNextPendingFeature(queue: FeatureQueue[]): FeatureQueue | null {
    return queue.find(f => f.state === 'PENDING') || null;
  }

  // Check if series is complete
  public static isSeriesComplete(series: SeriesData | null | undefined): boolean {
    if (!series) return true;
    
    if (series.remainingSpins !== undefined && series.remainingSpins <= 0) {
      return true;
    }
    if (series.remainingRespins !== undefined && series.remainingRespins <= 0) {
      return true;
    }
    
    return false;
  }
}

export default PayloadMapper;
