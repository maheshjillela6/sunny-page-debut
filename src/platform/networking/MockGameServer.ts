/**
 * MockGameServer - Simulates backend responses with the provided API format
 */

// Simple UUID generator
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export interface MoneyValue {
  amount: number;
  currency: string;
}

export interface GameLaunchRequest {
  type: 'gameLaunch';
  meta: { apiVersion: string; requestId: string; clientTime: string };
  auth: { sessionToken: string };
  data: {
    userId: string;
    gameId: string;
    clientInfo: { device: string; locale: string };
  };
}

export interface SpinRequest {
  type: 'spin';
  meta: { apiVersion: string; requestId: string; clientTime: string };
  auth: { sessionToken: string };
  data: {
    userId: string;
    gameId: string;
    mode: 'BASE' | 'FS' | 'HNS';
    bet: {
      total: MoneyValue;
      lines: number;
      coin: MoneyValue;
      coinsPerLine: number;
    };
    variant?: { jurisdictionCode: string; operatorCode: string };
    options?: { turbo: boolean; auto: boolean };
  };
}

export interface FeatureActionRequest {
  type: 'featureAction';
  meta: { apiVersion: string; requestId: string; clientTime: string };
  auth: { sessionToken: string };
  data: {
    gameId: string;
    seriesId: string;
    resumeToken: string;
    action: { type: 'PLAY' | 'STOP' | 'DECLINE' };
  };
}

export interface BuyBonusRequest {
  type: 'buyBonus';
  meta: { apiVersion: string; requestId: string; clientTime: string };
  auth: { sessionToken: string };
  data: {
    userId: string;
    gameId: string;
    bonus: {
      featureCode: string;
      price: MoneyValue;
    };
    coin: MoneyValue;
  };
}

// Symbol sets for different games - MUST match symbols.config.json
const SYMBOL_SETS: Record<string, string[]> = {
  'neon-nights': ['A', 'B', 'C', 'D', 'E', 'F', 'W', 'S'],
  'egyptian-adventure': ['A', 'B', 'C', 'D', 'E', 'F', 'W', 'S'],
  'dragon-fortune': ['A', 'B', 'C', 'D', 'E', 'F', 'W', 'S'],
  default: ['A', 'B', 'C', 'D', 'E', 'F', 'W', 'S'],
};

export class MockGameServer {
  private static instance: MockGameServer | null = null;

  private balance: number = 28886.40;
  private currency: string = 'GBP';
  private currentSeriesId: string | null = null;
  private freeSpinsRemaining: number = 0;
  private hnsRespinsRemaining: number = 0;
  private roundSeq: number = 0;

  private constructor() {}

  public static getInstance(): MockGameServer {
    if (!MockGameServer.instance) {
      MockGameServer.instance = new MockGameServer();
    }
    return MockGameServer.instance;
  }

  public async gameLaunch(request: GameLaunchRequest): Promise<any> {
    await this.simulateLatency();
    
    const gameId = request.data.gameId;
    const gameConfigs: Record<string, any> = {
      'neon-nights': {
        gamename: 'neonights',
        reels: { rows: 3, cols: 5, paylinesType: 'LINES', paylineCount: 20 },
        config: {
          rtp: 96.5,
          volatility: 'high',
          maxWinXBet: 10000,
          featuresAvailable: ['FREE_SPINS', 'MULTIPLIERS', 'EXPAND', 'TUMBLE'],
        },
      },
      'egyptian-adventure': {
        gamename: 'egyptianadventure',
        reels: { rows: 4, cols: 5, paylinesType: 'WAYS', waysCount: 1024 },
        config: {
          rtp: 94.5,
          volatility: 'high',
          maxWinXBet: 10000,
          featuresAvailable: ['FREE_SPINS', 'HOLD_RESPIN', 'GAMBLE', 'MYSTERY', 'EXPAND', 'TUMBLE', 'MULTIPLIERS', 'BONUS_WHEEL', 'JACKPOT'],
        },
      },
      'dragon-fortune': {
        gamename: 'dragonfortune',
        reels: { rows: 4, cols: 5, paylinesType: 'LINES', paylineCount: 25 },
        secondaryReels: { rows: 3, cols: 3 },
        config: {
          rtp: 96.2,
          volatility: 'high',
          maxWinXBet: 15000,
          featuresAvailable: ['FREE_SPINS', 'MULTIPLIERS', 'EXPANDING_WILDS', 'DUAL_GRID_SYNC'],
        },
      },
    };

    const config = gameConfigs[gameId] || gameConfigs['neon-nights'];
    const previousMatrix = this.generateMatrix(config.reels.rows, config.reels.cols, gameId);
    const previousSecondaryMatrix = config.secondaryReels
      ? this.generateMatrix(config.secondaryReels.rows, config.secondaryReels.cols, gameId)
      : undefined;

    return {
      type: 'gameLaunch',
      meta: {
        apiVersion: '1.0.0',
        requestId: request.meta.requestId,
        serverTime: new Date().toISOString(),
      },
      data: {
        userId: request.data.userId,
        gameId: gameId,
        gamename: config.gamename,
        gameType: 'SLOT',
        currency: this.currency,
        balance: { amount: this.balance, currency: this.currency },
        reels: config.reels,
        ...(config.secondaryReels ? { secondaryReels: config.secondaryReels } : {}),
        config: config.config,
        previousRound: {
          roundId: generateUUID(),
          matrixString: previousMatrix,
          win: { amount: 0.34, currency: this.currency },
        },
        state: { screen: 'game', availableActions: ['spin', 'buyBonus'] },
        pendingSeries: [],
        extensions: {},
      },
    };
  }

  public async spin(request: SpinRequest): Promise<any> {
    await this.simulateLatency();

    const betAmount = request.data.bet.total.amount;
    this.balance -= betAmount;
    this.roundSeq++;

    const gameId = request.data.gameId;
    const gameConfigs: Record<string, any> = {
      'neon-nights': { rows: 3, cols: 5 },
      'egyptian-adventure': { rows: 4, cols: 5 },
      'dragon-fortune': { rows: 4, cols: 5, secondaryRows: 3, secondaryCols: 3 },
    };
    const gc = gameConfigs[gameId] || { rows: 3, cols: 5 };
    const rows = request.data.mode === 'BASE' ? gc.rows : 5;
    const cols = gc.cols || 5;

    const matrixString = this.generateMatrix(rows, cols, gameId);
    const { win, steps, multipliers, featuresTriggered, featureQueue, series } = this.evaluateSpinWithSteps(matrixString, betAmount, request.data.mode, gameId);

    // Generate secondary grid matrix for dual-board games
    let secondaryMatrix: string | undefined;
    if (gc.secondaryRows && gc.secondaryCols) {
      secondaryMatrix = this.generateMatrix(gc.secondaryRows, gc.secondaryCols, gameId);
    }

    this.balance += win;

    return {
      type: 'spin',
      meta: {
        apiVersion: '1.0.0',
        requestId: request.meta.requestId,
        serverTime: new Date().toISOString(),
      },
      data: {
        userId: request.data.userId,
        gameId: gameId,
        gamename: gameId,
        gameType: 'SLOT',
        currency: this.currency,
        balance: { amount: this.balance, currency: this.currency },
        round: {
          roundId: generateUUID(),
          roundSeq: this.roundSeq,
          mode: request.data.mode,
          matrixString,
          ...(secondaryMatrix ? { secondaryMatrixString: secondaryMatrix } : {}),
        },
        stake: { amount: betAmount, currency: this.currency },
        win: { amount: win, currency: this.currency },
        steps,
        multipliers,
        jackpot: {
          contribution: { amount: betAmount * 0.002, currency: this.currency },
          pools: [
            { id: 'JP-MINI', type: 'progressive', displayAmount: 25.00 + Math.random() * 5 },
            { id: 'JP-MAJOR', type: 'progressive', displayAmount: 2500.00 + Math.random() * 100 },
          ],
          draw: 'none',
        },
        featuresTriggered,
        featureQueue,
        series,
        nextAction: {
          endpoint: featureQueue.length > 0 ? '/api/feature/action' : '/api/game/spin',
          allowed: featureQueue.length > 0 ? ['PLAY', 'DECLINE'] : ['SPIN'],
        },
        unfinished: { exists: false },
      },
    };
  }

  public async featureAction(request: FeatureActionRequest): Promise<any> {
    await this.simulateLatency();

    if (this.freeSpinsRemaining > 0) {
      return this.handleFreeSpinAction(request);
    } else if (this.hnsRespinsRemaining > 0) {
      return this.handleHNSAction(request);
    }

    return this.handleFreeSpinAction(request);
  }

  private async handleFreeSpinAction(request: FeatureActionRequest): Promise<any> {
    this.freeSpinsRemaining--;
    const retriggerSpins = Math.random() > 0.9 ? 5 : 0;
    this.freeSpinsRemaining += retriggerSpins;

    const matrixString = this.generateMatrix(5, 5, 'neon-nights');
    const win = Math.random() * 10;
    this.balance += win;

    return {
      type: 'featureAction',
      meta: {
        apiVersion: '1.0.0',
        requestId: request.meta.requestId,
        serverTime: new Date().toISOString(),
      },
      data: {
        userId: 'player1',
        gameId: request.data.gameId,
        gamename: 'piratesfortune',
        gameType: 'SLOT',
        currency: this.currency,
        balance: { amount: this.balance, currency: this.currency },
        series: {
          seriesId: request.data.seriesId,
          mode: 'FS',
          spinsAwarded: 8 + retriggerSpins,
          remainingSpins: this.freeSpinsRemaining,
          resumeToken: request.data.resumeToken,
          retrigger: { spins: retriggerSpins },
        },
        step: {
          stepId: generateUUID(),
          roundId: generateUUID(),
          matrixString,
          win: { amount: win, currency: this.currency },
          multipliers: {
            global: 2.0,
            sources: [{ type: 'FS_PROGRESS', value: 2.0 }],
          },
          retrigger: { spins: retriggerSpins },
        },
        jackpot: {
          contribution: { amount: 0.02, currency: this.currency },
          pools: [
            { id: 'JP-MINI', type: 'progressive', displayAmount: 25.36 },
            { id: 'JP-MAJOR', type: 'progressive', displayAmount: 2501.30 },
          ],
          draw: 'none',
        },
        nextAction: {
          endpoint: '/api/feature/action',
          allowed: this.freeSpinsRemaining > 0 ? ['PLAY', 'STOP'] : ['SPIN'],
        },
        unfinished: { exists: false },
        extensions: {},
      },
    };
  }

  private async handleHNSAction(request: FeatureActionRequest): Promise<any> {
    this.hnsRespinsRemaining--;
    const newLock = Math.random() > 0.5;
    
    if (newLock) {
      this.hnsRespinsRemaining = 3;
    }

    const lockedItems = [
      { row: 0, col: 0, amount: 10.00 },
      { row: 1, col: 1, amount: 5.00 },
      { row: 2, col: 0, amount: 20.00 },
    ];

    if (newLock) {
      lockedItems.push({ row: Math.floor(Math.random() * 4), col: Math.floor(Math.random() * 5), amount: Math.floor(Math.random() * 50) + 5 });
    }

    return {
      type: 'featureAction',
      meta: {
        apiVersion: '1.0.0',
        requestId: request.meta.requestId,
        serverTime: new Date().toISOString(),
      },
      data: {
        userId: 'player1',
        gameId: request.data.gameId,
        currency: this.currency,
        balance: { amount: this.balance, currency: this.currency },
        series: {
          seriesId: request.data.seriesId,
          mode: 'HNS',
          remainingRespins: this.hnsRespinsRemaining,
          resumeToken: request.data.resumeToken,
        },
        hns: {
          startLives: 3,
          livesLeft: this.hnsRespinsRemaining,
          lockedItems,
          totalCollected: lockedItems.reduce((sum, item) => sum + item.amount, 0),
        },
        nextAction: {
          endpoint: '/api/feature/action',
          allowed: this.hnsRespinsRemaining > 0 ? ['PLAY'] : ['COLLECT'],
        },
        unfinished: { exists: false },
      },
    };
  }

  public async buyBonus(request: BuyBonusRequest): Promise<any> {
    await this.simulateLatency();

    const price = request.data.bonus.price.amount;
    this.balance -= price;
    this.hnsRespinsRemaining = 3;
    this.currentSeriesId = generateUUID();

    const matrixString = this.generateMatrix(4, 5, request.data.gameId);

    return {
      type: 'buyBonus',
      meta: {
        apiVersion: '1.0.0',
        requestId: request.meta.requestId,
        serverTime: new Date().toISOString(),
      },
      data: {
        userId: request.data.userId,
        gameId: request.data.gameId,
        gamename: 'piratesfortune',
        gameType: 'SLOT',
        currency: this.currency,
        balance: { amount: this.balance, currency: this.currency },
        purchase: {
          purchaseId: generateUUID(),
          featureCode: request.data.bonus.featureCode,
          charged: { amount: price, currency: this.currency },
        },
        round: {
          roundId: generateUUID(),
          mode: 'BASE',
          matrixString,
        },
        hns: {
          startLives: 3,
          lockedItems: [
            { row: 0, col: 0, amount: 10.00 },
            { row: 1, col: 1, amount: 5.00 },
            { row: 2, col: 0, amount: 20.00 },
          ],
          corPositions: '1,2,3,4,8,20,24',
          corValues: '20,30,70,20,90,30,5',
        },
        series: {
          seriesId: this.currentSeriesId,
          mode: 'HNS',
          remainingRespins: 3,
          resumeToken: `rt-hns-${generateUUID().substring(0, 6)}`,
        },
        featureQueue: [
          { featureType: 'HOLD_RESPIN', state: 'PENDING', priority: 100 },
        ],
        nextAction: { endpoint: '/api/feature/action', allowed: ['PLAY'] },
        unfinished: { exists: false },
        extensions: {},
      },
    };
  }

  /**
   * Generate a matrix with weighted symbol distribution
   * Uses reel strip weights to bias toward realistic outcomes
   */
  private generateMatrix(rows: number, cols: number, gameId: string): string {
    const symbols = SYMBOL_SETS[gameId] || SYMBOL_SETS.default;
    
    // Weight distribution: low symbols more common, specials rare
    const weights: Record<string, number> = {
      'A': 12, 'B': 14, 'C': 16, 'D': 20, 'E': 20, 'F': 20, 'W': 4, 'S': 2,
    };
    
    // Build weighted pool
    const pool: string[] = [];
    for (const sym of symbols) {
      const w = weights[sym] || 10;
      for (let i = 0; i < w; i++) pool.push(sym);
    }
    
    const matrix: string[][] = [];
    for (let r = 0; r < rows; r++) {
      matrix[r] = [];
      for (let c = 0; c < cols; c++) {
        matrix[r][c] = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    return matrix.map(row => row.join('')).join(';');
  }

  /**
   * Standard 20-payline definitions for 3x5 grid.
   * Each array maps flat indices (row*cols+col) to positions.
   * Adaptable: server can override these with different payline configs.
   */
  private static PAYLINE_DEFINITIONS: number[][] = [
    [0, 1, 2, 3, 4],         // payline 1: top row
    [5, 6, 7, 8, 9],         // payline 2: middle row
    [10, 11, 12, 13, 14],    // payline 3: bottom row
    [0, 6, 12, 8, 4],        // payline 4
    [10, 6, 2, 8, 14],       // payline 5
    [0, 1, 7, 13, 14],       // payline 6
    [10, 11, 7, 3, 4],       // payline 7
    [5, 1, 2, 3, 9],         // payline 8
    [5, 11, 12, 13, 9],      // payline 9
    [0, 6, 7, 8, 4],         // payline 10
    [10, 6, 7, 8, 14],       // payline 11
    [5, 1, 7, 13, 9],        // payline 12
    [5, 11, 7, 3, 9],        // payline 13
    [0, 6, 2, 8, 4],         // payline 14
    [10, 6, 12, 8, 14],      // payline 15
    [5, 1, 7, 3, 9],         // payline 16
    [5, 11, 7, 13, 9],       // payline 17
    [0, 1, 2, 8, 14],        // payline 18
    [10, 11, 12, 8, 4],      // payline 19
    [10, 6, 2, 3, 4],        // payline 20
  ];

  /**
   * Convert flat index to {row, col} for a given number of columns
   */
  private flatIndexToPos(index: number, cols: number): { row: number; col: number } {
    return { row: Math.floor(index / cols), col: index % cols };
  }

  /**
   * Evaluate spin and produce steps-based output (RESULT + CASCADE steps).
   */
  private evaluateSpinWithSteps(matrixString: string, betAmount: number, mode: string, gameId: string): {
    win: number;
    steps: any[];
    multipliers: any;
    featuresTriggered: any[];
    featureQueue: any[];
    series: any;
  } {
    const matrix = matrixString.split(';').map(row => row.split(''));
    const rows = matrix.length;
    const cols = matrix[0]?.length || 5;

    const paytable: Record<string, Record<number, number>> = {
      'A': { 3: 0.5, 4: 1.5, 5: 5.0 },
      'B': { 3: 0.4, 4: 1.2, 5: 4.0 },
      'C': { 3: 0.3, 4: 1.0, 5: 3.0 },
      'D': { 3: 0.2, 4: 0.5, 5: 1.5 },
      'E': { 3: 0.2, 4: 0.4, 5: 1.2 },
      'F': { 3: 0.15, 4: 0.3, 5: 1.0 },
      'W': { 3: 1.0, 4: 5.0, 5: 25.0 },
      'S': { 3: 2.0, 4: 10.0, 5: 50.0 },
    };

    const wildSymbol = 'W';
    const minMatch = 3;

    // === Step 0: RESULT - evaluate initial grid ===
    const initialWins = this.evaluatePaylineWins(matrix, betAmount, paytable, cols, wildSymbol, minMatch);
    let resultStepWin = initialWins.reduce((s: number, w: any) => s + w.amount, 0);

    const steps: any[] = [];

    // RESULT step
    steps.push({
      index: 0,
      type: 'RESULT',
      grid: { matrixString },
      wins: initialWins.map((w: any) => ({
        winType: 'LINE',
        symbol: w.symbol,
        positions: w.positions,
        amount: w.amount,
        multiplier: w.multiplier || 1,
        lineId: w.lineId,
        matchCount: w.matchCount,
      })),
      totalWin: { amount: resultStepWin, currency: this.currency },
    });

    // === CASCADE steps ===
    let totalWin = resultStepWin;
    let cumulativeWin = resultStepWin;
    let currentMatrix = matrix.map(row => [...row]);
    let currentWins = initialWins;
    let stepIndex = 1;
    const maxSteps = 15;
    const symbols = SYMBOL_SETS[gameId] || SYMBOL_SETS.default;

    const weights: Record<string, number> = {
      'A': 12, 'B': 14, 'C': 16, 'D': 20, 'E': 20, 'F': 20, 'W': 4, 'S': 2,
    };
    const pool: string[] = [];
    for (const sym of symbols) {
      const w = weights[sym] || 10;
      for (let i = 0; i < w; i++) pool.push(sym);
    }

    while (currentWins.length > 0 && stepIndex < maxSteps) {
      const matrixBefore = currentMatrix.map(r => r.join('')).join(';');

      // Collect removed positions
      const removedSet = new Map<string, { row: number; col: number }>();
      for (const win of currentWins) {
        for (const pos of win.positions) {
          removedSet.set(`${pos.row},${pos.col}`, pos);
        }
      }
      const removedPositions = Array.from(removedSet.values());

      // Remove winning symbols
      for (const pos of removedPositions) {
        currentMatrix[pos.row][pos.col] = '';
      }

      // Gravity collapse
      const movements: any[] = [];
      for (let c = 0; c < cols; c++) {
        let writeRow = rows - 1;
        for (let r = rows - 1; r >= 0; r--) {
          if (currentMatrix[r][c] !== '') {
            if (r !== writeRow) {
              movements.push({
                from: { row: r, col: c },
                to: { row: writeRow, col: c },
                symbol: currentMatrix[r][c],
              });
              currentMatrix[writeRow][c] = currentMatrix[r][c];
              currentMatrix[r][c] = '';
            }
            writeRow--;
          }
        }
      }

      // Refill
      const refills: any[] = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (currentMatrix[r][c] === '') {
            const newSymbol = pool[Math.floor(Math.random() * pool.length)];
            currentMatrix[r][c] = newSymbol;
            refills.push({ position: { row: r, col: c }, symbol: newSymbol });
          }
        }
      }

      const matrixAfter = currentMatrix.map(r => r.join('')).join(';');

      // Re-evaluate
      const newWins = this.evaluatePaylineWins(currentMatrix, betAmount, paytable, cols, wildSymbol, minMatch);
      const stepWin = newWins.reduce((s: number, w: any) => s + w.amount, 0);
      totalWin += stepWin;
      cumulativeWin += stepWin;

      steps.push({
        index: stepIndex,
        type: 'CASCADE',
        gridBefore: { matrixString: matrixBefore },
        removedPositions,
        movements,
        refills,
        gridAfter: { matrixString: matrixAfter },
        wins: newWins.map((w: any) => ({
          winType: 'LINE',
          symbol: w.symbol,
          positions: w.positions,
          amount: w.amount,
          multiplier: w.multiplier || 1,
          lineId: w.lineId,
          matchCount: w.matchCount,
        })),
        stepWin: { amount: stepWin, currency: this.currency },
        cumulativeWin: { amount: cumulativeWin, currency: this.currency },
        multiplier: 1 + stepIndex,
      });

      currentWins = newWins;
      stepIndex++;
    }

    // === Feature triggers ===
    const featuresTriggered: any[] = [];
    const featureQueue: any[] = [];
    let series: any = null;

    let scatterCount = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === 'S') scatterCount++;
      }
    }

    if (scatterCount >= 3) {
      this.freeSpinsRemaining = 8;
      this.currentSeriesId = generateUUID();
      featuresTriggered.push({
        featureType: 'FREE_SPINS',
        awarded: 8,
        triggerReason: `S>=${scatterCount}`,
      });
      featureQueue.push({
        featureType: 'FREE_SPINS',
        state: 'PENDING',
        priority: 30,
      });
      series = {
        seriesId: this.currentSeriesId,
        mode: 'FS',
        spinsAwarded: 8,
        remainingSpins: 8,
        resumeToken: `rt-fs-${generateUUID().substring(0, 6)}`,
        retrigger: { spins: 0 },
      };
    }

    const multipliers = { global: 1.0, sources: [] as any[] };

    return { win: totalWin, steps, multipliers, featuresTriggered, featureQueue, series };
  }

  /**
   * Evaluate payline wins on a matrix (reusable for initial + re-evaluation).
   */
  private evaluatePaylineWins(
    matrix: string[][],
    betAmount: number,
    paytable: Record<string, Record<number, number>>,
    cols: number,
    wildSymbol: string,
    minMatch: number,
  ): any[] {
    const rows = matrix.length;
    if (rows !== 3) return [];

    const paylines = MockGameServer.PAYLINE_DEFINITIONS;
    const wins: any[] = [];

    for (let lineIdx = 0; lineIdx < paylines.length; lineIdx++) {
      const payline = paylines[lineIdx];
      const positions = payline.map(idx => this.flatIndexToPos(idx, cols));
      const lineSymbols = positions.map(pos => matrix[pos.row]?.[pos.col] ?? '');

      let matchSymbol = '';
      for (const sym of lineSymbols) {
        if (sym !== wildSymbol && sym !== '') {
          matchSymbol = sym;
          break;
        }
      }
      if (!matchSymbol) matchSymbol = wildSymbol;

      let matchCount = 0;
      const matchedPositions: { row: number; col: number }[] = [];

      for (let i = 0; i < lineSymbols.length; i++) {
        const sym = lineSymbols[i];
        if (sym === matchSymbol || sym === wildSymbol) {
          matchCount++;
          matchedPositions.push(positions[i]);
        } else {
          break;
        }
      }

      if (matchCount < minMatch) continue;
      const symbolPay = paytable[matchSymbol];
      if (!symbolPay || !symbolPay[matchCount]) continue;

      const amount = symbolPay[matchCount] * betAmount;
      wins.push({
        lineId: lineIdx,
        symbol: matchSymbol,
        positions: matchedPositions,
        amount,
        multiplier: 1,
        matchCount,
      });
    }

    return wins;
  }


  private async simulateLatency(): Promise<void> {
    const latency = 50 + Math.random() * 100;
    return new Promise(resolve => setTimeout(resolve, latency));
  }

  // ============ Mechanism Step Generation ============

  /**
   * Generate a mechanism step result for hold-respin type mechanisms
   */
  public generateMechanismStep(
    mechanismId: string,
    stepIndex: number,
    gameId: string,
    persistentState: {
      lockedPositions?: Array<{ row: number; col: number; symbol: string; value: number }>;
      collectedValue?: number;
      multiplier?: number;
    } = {}
  ): any {
    const rows = 3;
    const cols = 5;
    const symbols = SYMBOL_SETS[gameId] || SYMBOL_SETS.default;

    switch (mechanismId) {
      case 'holdRespin':
        return this.generateHoldRespinStep(stepIndex, rows, cols, symbols, persistentState);
      case 'lockSequence':
        return this.generateLockSequenceStep(stepIndex, rows, cols, symbols, persistentState);
      case 'multiSpin':
        return this.generateMultiSpinStep(stepIndex, rows, cols, symbols, persistentState);
      case 'collection':
        return this.generateCollectionStep(stepIndex, rows, cols, symbols, persistentState);
      case 'modifier':
        return this.generateModifierStep(stepIndex, rows, cols, symbols, persistentState);
      case 'transformation':
        return this.generateTransformationStep(stepIndex, rows, cols, symbols, persistentState);
      default:
        return this.generateGenericMechanismStep(stepIndex, rows, cols, symbols);
    }
  }

  private generateHoldRespinStep(
    stepIndex: number,
    rows: number, cols: number,
    symbols: string[],
    state: any
  ): any {
    const locked = state.lockedPositions ?? [];
    const matrix: string[][] = [];

    // Build matrix: locked positions keep their symbol, rest are random
    for (let r = 0; r < rows; r++) {
      matrix[r] = [];
      for (let c = 0; c < cols; c++) {
        const lockedItem = locked.find((l: any) => l.row === r && l.col === c);
        if (lockedItem) {
          matrix[r][c] = lockedItem.symbol;
        } else {
          // ~25% chance of BONUS landing
          matrix[r][c] = Math.random() < 0.25 ? 'BONUS' : symbols[Math.floor(Math.random() * (symbols.length - 2))];
        }
      }
    }

    // Detect new bonus symbols
    const specialSymbols: any[] = [];
    const newLocked: any[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === 'BONUS' && !locked.find((l: any) => l.row === r && l.col === c)) {
          const value = [1, 2, 3, 5, 10, 25][Math.floor(Math.random() * 6)];
          specialSymbols.push({
            position: { row: r, col: c },
            symbolId: 'BONUS',
            value,
            effect: 'lock',
          });
          newLocked.push({ row: r, col: c, symbol: 'BONUS', value });
        }
      }
    }

    return {
      stepIndex,
      stepId: generateUUID(),
      matrixString: matrix.map(r => r.join('')).join(';'),
      matrix,
      wins: [],
      totalStepWin: 0,
      specialSymbols,
      lockedPositions: [...locked.map((l: any) => ({ row: l.row, col: l.col })), ...newLocked.map((l: any) => ({ row: l.row, col: l.col }))],
      positionValues: [...locked, ...newLocked].map((l: any) => ({
        position: { row: l.row, col: l.col },
        value: l.value,
        symbol: l.symbol,
      })),
      extendsSequence: newLocked.length > 0,
    };
  }

  private generateLockSequenceStep(
    stepIndex: number,
    rows: number, cols: number,
    symbols: string[],
    state: any
  ): any {
    const matrix: string[][] = [];
    for (let r = 0; r < rows; r++) {
      matrix[r] = [];
      for (let c = 0; c < cols; c++) {
        matrix[r][c] = Math.random() < 0.15 ? 'LOCK' : symbols[Math.floor(Math.random() * symbols.length)];
      }
    }

    const specialSymbols = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === 'LOCK') {
          specialSymbols.push({
            position: { row: r, col: c },
            symbolId: 'LOCK',
            effect: 'lock',
          });
        }
      }
    }

    return {
      stepIndex,
      stepId: generateUUID(),
      matrixString: matrix.map(r => r.join('')).join(';'),
      matrix,
      wins: [],
      totalStepWin: 0,
      specialSymbols,
      extendsSequence: specialSymbols.length > 0,
    };
  }

  private generateMultiSpinStep(
    stepIndex: number,
    rows: number, cols: number,
    symbols: string[],
    state: any
  ): any {
    const matrixString = this.generateMatrix(rows, cols, 'neon-nights');
    const matrix = matrixString.split(';').map(r => r.split(''));
    const multiplier = (state.multiplier ?? 1) + stepIndex;

    return {
      stepIndex,
      stepId: generateUUID(),
      matrixString,
      matrix,
      wins: [],
      totalStepWin: Math.random() * 5 * multiplier,
      multiplier,
      specialSymbols: [],
    };
  }

  private generateCollectionStep(
    stepIndex: number,
    rows: number, cols: number,
    symbols: string[],
    state: any
  ): any {
    const matrix: string[][] = [];
    for (let r = 0; r < rows; r++) {
      matrix[r] = [];
      for (let c = 0; c < cols; c++) {
        const roll = Math.random();
        if (roll < 0.1) matrix[r][c] = 'COIN';
        else if (roll < 0.12) matrix[r][c] = 'COLLECTOR';
        else matrix[r][c] = symbols[Math.floor(Math.random() * symbols.length)];
      }
    }

    const specialSymbols = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === 'COIN') {
          specialSymbols.push({
            position: { row: r, col: c },
            symbolId: 'COIN',
            value: [5, 10, 15, 20, 50][Math.floor(Math.random() * 5)],
            effect: 'collect',
          });
        } else if (matrix[r][c] === 'COLLECTOR') {
          specialSymbols.push({
            position: { row: r, col: c },
            symbolId: 'COLLECTOR',
            effect: 'consume',
          });
        }
      }
    }

    return {
      stepIndex,
      stepId: generateUUID(),
      matrixString: matrix.map(r => r.join('')).join(';'),
      matrix,
      wins: [],
      totalStepWin: 0,
      specialSymbols,
    };
  }

  private generateModifierStep(
    stepIndex: number,
    rows: number, cols: number,
    symbols: string[],
    _state: any
  ): any {
    const matrixString = this.generateMatrix(rows, cols, 'neon-nights');
    const matrix = matrixString.split(';').map(r => r.split(''));

    // Generate random modifiers (decreasing probability over steps)
    const modifiers: any[] = [];
    const modCount = Math.random() < (0.8 - stepIndex * 0.1) ? Math.ceil(Math.random() * 3) : 0;

    const modTypes = ['addMultiplier', 'addSymbol', 'removeSymbol', 'expandGrid', 'swapSymbols'];
    for (let i = 0; i < modCount; i++) {
      modifiers.push({
        type: modTypes[Math.floor(Math.random() * modTypes.length)],
        target: String(Math.floor(Math.random() * cols)),
        value: Math.ceil(Math.random() * 3),
      });
    }

    return {
      stepIndex,
      stepId: generateUUID(),
      matrixString,
      matrix,
      wins: [],
      totalStepWin: Math.random() * 3,
      modifiers,
      specialSymbols: [],
    };
  }

  private generateTransformationStep(
    stepIndex: number,
    rows: number, cols: number,
    symbols: string[],
    _state: any
  ): any {
    const matrixString = this.generateMatrix(rows, cols, 'neon-nights');
    const matrix = matrixString.split(';').map(r => r.split(''));

    const upgradePaths: Record<string, string> = { 'F': 'E', 'E': 'D', 'D': 'C', 'C': 'B', 'B': 'A' };
    const transformations: any[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sym = matrix[r][c];
        if (upgradePaths[sym] && Math.random() < 0.2) {
          transformations.push({
            from: { position: { row: r, col: c }, symbol: sym },
            to: { symbol: upgradePaths[sym] },
            effect: 'upgrade',
          });
        }
      }
    }

    return {
      stepIndex,
      stepId: generateUUID(),
      matrixString,
      matrix,
      wins: [],
      totalStepWin: Math.random() * 2,
      transformations,
      specialSymbols: [],
    };
  }

  private generateGenericMechanismStep(
    stepIndex: number,
    rows: number, cols: number,
    symbols: string[]
  ): any {
    const matrixString = this.generateMatrix(rows, cols, 'neon-nights');
    return {
      stepIndex,
      stepId: generateUUID(),
      matrixString,
      matrix: matrixString.split(';').map(r => r.split('')),
      wins: [],
      totalStepWin: 0,
      specialSymbols: [],
    };
  }

  public getBalance(userId?: string, gameId?: string): any {
    return {
      data: {
        balance: { amount: this.balance, currency: this.currency },
        userId: userId ?? 'player1',
        gameId: gameId ?? 'unknown',
      }
    };
  }

  public setBalance(amount: number): void {
    this.balance = amount;
  }

  public getBalanceAmount(): number {
    return this.balance;
  }

  public reset(): void {
    this.balance = 28886.40;
    this.currentSeriesId = null;
    this.freeSpinsRemaining = 0;
    this.hnsRespinsRemaining = 0;
    this.roundSeq = 0;
  }
}

export default MockGameServer;
