/**
 * GameController - Main game loop controller with backend-driven data
 * Uses NetworkManager for all server communication (REST/STOMP/Mock)
 *
 * Spin result flow is fully step-driven: after reels stop on round.matrixString,
 * the StepSequencePresenter walks through each step (RESULT / CASCADE) in order.
 * No client-side win evaluation. Total win popup shown only after all steps.
 */

import { EventBus } from '../../platform/events/EventBus';
import { GridManager } from '../../presentation/grid/GridManager';
import { SpinLoop } from './SpinLoop';
import { ScreenManager } from '../../presentation/screens/ScreenManager';
import { WinData } from '../../platform/events/EventMap';
import { SpinStrategyRegistry } from '../../modules/registry/SpinStrategyRegistry';
import { SpinDirection, SpinConfig } from '../interfaces/ISpinStrategy';
import { NetworkManager } from '@/platform/networking/NetworkManager';
import { PayloadMapper } from '@/platform/networking/PayloadMapper';
import { GameSession } from '@/gameplay/state/GameSession';
import { ResultPresentationController } from './ResultPresentationController';
import { Logger } from '@/platform/logger/Logger';

export enum GameState {
  IDLE = 'idle',
  SPINNING = 'spinning',
  WAITING_SERVER = 'waiting_server',
  SHOWING_WIN = 'showing_win',
  PRESENTING_STEPS = 'presenting_steps',
  FEATURE = 'feature',
}

export interface GameConfig {
  bet: number;
  lines: number;
  balance: number;
}

export class GameController {
  private static instance: GameController | null = null;

  private eventBus: EventBus;
  private gridManager: GridManager;
  private screenManager: ScreenManager;
  private spinLoop: SpinLoop;
  private networkManager: NetworkManager;
  private session: GameSession;
  private resultController: ResultPresentationController;
  private state: GameState = GameState.IDLE;
  private config: GameConfig = { bet: 10, lines: 1024, balance: 1000 };
  private currentRoundId: string = '';
  private totalWin: number = 0;
  private currentSpinStrategy: string = 'top_to_bottom';
  private gameId: string = 'neon-nights';
  private userId: string = 'player1';
  /** The last matrix committed to the grid — used to guard against stale re-renders */
  private lastCommittedMatrix: string = '';
  private logger: Logger;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.gridManager = GridManager.getInstance();
    this.screenManager = ScreenManager.getInstance();
    this.spinLoop = new SpinLoop();
    this.networkManager = NetworkManager.getInstance();
    this.session = GameSession.getInstance();
    this.resultController = new ResultPresentationController();
    this.logger = Logger.create('GameController');

    this.setupEventListeners();
  }

  public static getInstance(): GameController {
    if (!GameController.instance) {
      GameController.instance = new GameController();
    }
    return GameController.instance;
  }

  private setupEventListeners(): void {
    this.eventBus.on('game:spin:request', (payload) => {
      this.onSpinRequest(payload);
    });

    this.eventBus.on('ui:bet:change', (payload) => {
      this.config.bet = payload.newBet;
    });

    this.eventBus.on('game:spin:strategy:change', (payload) => {
      this.setSpinStrategy(payload.strategyId, payload.config);
    });
  }

  // ── Initialization ───────────────────────────────────────────────────

  public async initializeGame(gameId: string, userId: string = 'player1'): Promise<boolean> {
    this.gameId = gameId;
    this.userId = userId;

    try {
      this.logger.info(`Launching game: ${gameId} for user: ${userId}`);

      const response = await this.networkManager.gameLaunch(userId, gameId, 'desktop', 'en-GB');

      if (!response.success || !response.data) {
        const errorMsg = response.error || 'Game launch failed - no server response';
        this.logger.error('Game launch failed:', errorMsg);
        this.eventBus.emit('game:error', { error: errorMsg, type: 'launch' });
        return false;
      }

      const data = response.data;
      this.session.initFromLaunchResponse(data);
      this.config.balance = data.balance.amount;
      this.config.lines = data.reels?.waysCount || 1024;

      this.logger.info('Game initialized with server config:', {
        gameId: data.gameId,
        balance: data.balance.amount,
        grid: data.reels ? `${data.reels.cols}x${data.reels.rows}` : 'default',
        adapterType: this.networkManager.getAdapterType(),
      });

      this.eventBus.emit('game:initialized' as any, {
        gameId: data.gameId,
        gameName: data.gamename,
        balance: data.balance.amount,
      });

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Game initialization error:', errorMsg);
      this.eventBus.emit('game:error', { error: errorMsg, type: 'launch' });
      return false;
    }
  }

  public initFromSession(session: GameSession): void {
    const wallet = session.getWallet();
    const game = session.getGame();

    this.config.balance = wallet.getBalance();
    this.config.bet = wallet.getBet();
    this.config.lines = game.getWaysCount() || 1024;
    this.gameId = game.getGameId() || session.getCurrentGameId();
    this.userId = session.getUser().getUserId();

    this.logger.info('Initialized from session:', {
      gameId: this.gameId,
      balance: this.config.balance,
      bet: this.config.bet,
    });
  }

  // ── Spin strategies ──────────────────────────────────────────────────

  public setSpinStrategy(strategyId: string, spinConfig?: Partial<SpinConfig>): void {
    const registry = SpinStrategyRegistry.getInstance();
    if (!registry.has(strategyId)) {
      this.logger.warn(`Unknown strategy: ${strategyId}`);
      return;
    }
    this.currentSpinStrategy = strategyId;
    const grid = this.gridManager.getGridContainer();
    if (grid) grid.setSpinStrategy(strategyId, spinConfig);
    this.eventBus.emit('game:spin:strategy:changed', { strategyId });
  }

  public setSpinDirection(direction: SpinDirection, spinConfig?: Partial<SpinConfig>): void {
    const registry = SpinStrategyRegistry.getInstance();
    const strategy = registry.getByDirection(direction, spinConfig);
    if (strategy) this.setSpinStrategy(strategy.id, spinConfig);
  }

  public getSpinStrategy(): string { return this.currentSpinStrategy; }
  public getAvailableStrategies(): string[] { return SpinStrategyRegistry.getInstance().list(); }
  public getStrategyInfo(): Array<{ id: string; direction: SpinDirection }> { return SpinStrategyRegistry.getInstance().getInfo(); }

  // ── Main spin flow ───────────────────────────────────────────────────

  private async onSpinRequest(payload: { bet: number; lines: number }): Promise<void> {
    // Allow spin during step presentation — interrupt and start new spin
    if (this.state === GameState.PRESENTING_STEPS || this.state === GameState.SHOWING_WIN) {
      this.logger.info('Spin requested during presentation — interrupting');
      this.resultController.cancel();
      this.eventBus.emit('game:win:interrupted', undefined as any);
      this.state = GameState.IDLE;
    }

    if (this.state !== GameState.IDLE) {
      this.logger.debug(`Spin blocked - not idle, current state: ${this.state}`);
      return;
    }
    if (this.config.balance < payload.bet) {
      this.logger.warn('Spin blocked - insufficient balance');
      this.eventBus.emit('game:error', { error: 'Insufficient balance', type: 'spin' });
      return;
    }

    this.state = GameState.SPINNING;

    // Deduct bet optimistically
    const previousBalance = this.config.balance;
    this.config.balance -= payload.bet;

    this.eventBus.emit('wallet:balance:update', {
      previousBalance,
      newBalance: this.config.balance,
      change: -payload.bet,
    });

    this.eventBus.emit('game:spin:start', { bet: payload.bet, lines: payload.lines });
    this.spinLoop.startSpin();

    this.logger.debug(`Sending spin request to server (${this.networkManager.getAdapterType()})...`);

    try {
      const betData = {
        total: { amount: payload.bet, currency: 'GBP' },
        lines: payload.lines,
        coin: { amount: 1, currency: 'GBP' },
        coinsPerLine: 1,
      };

      const featureMode = this.session.getFeature().getMode();
      const mode = featureMode === 'BASE' ? 'BASE' : featureMode as 'FS' | 'HNS';

      const response = await this.networkManager.spin(
        this.userId, this.gameId, betData, mode, { turbo: false, auto: false },
      );

      if (!response.success || !response.data) {
        const errorMsg = response.error || 'Spin failed - no server response';
        this.logger.error('Spin request failed:', errorMsg);
        this.handleSpinError(previousBalance, errorMsg);
        return;
      }

      this.logger.debug('Spin response received:', {
        roundId: response.data.round?.roundId,
        win: response.data.win?.amount,
        steps: response.data.steps?.length,
        latency: response.latency,
      });

      const spinData = PayloadMapper.mapSpin(response.data);

      // Update balance from server
      this.config.balance = spinData.balance.amount;
      this.session.getWallet().setBalance(spinData.balance.amount);

      // Use round.matrixString for the initial reel stop — NOT the final state
      const initialMatrix = spinData.matrixString;
      const symbols = PayloadMapper.parseMatrix(initialMatrix);

      // Parse secondary grid symbols if present (dual-board games)
      const secondaryMatrixString = (response.data?.round as any)?.secondaryMatrixString;
      const secondarySymbols = secondaryMatrixString 
        ? PayloadMapper.parseMatrix(secondaryMatrixString) 
        : undefined;

      this.currentRoundId = spinData.roundId;
      this.totalWin = spinData.win.amount;

      // Store round data
      const round = this.session.getRound();
      round.startRound(spinData.roundId, 'BASE', { amount: payload.bet, currency: 'GBP' });

      // Store initial result
      round.setResult(
        spinData.matrixString,
        { amount: this.totalWin, currency: 'GBP' },
        [],
        spinData.waysCount || 1024,
      );

      // Emit spin result (only for reels to display round.matrixString)
      this.eventBus.emit('game:spin:result', {
        roundId: spinData.roundId,
        symbols,
        wins: [],        // Don't send wins here — step presenter handles them
        totalWin: 0,     // Don't show total yet
        features: spinData.featuresTriggered?.map((f: any) => f.featureType) || [],
      });

      // Stop reels with initial matrix (primary + secondary)
      this.spinLoop.stopSpin(symbols, secondarySymbols);

      // Update wallet balance (server-authoritative)
      this.eventBus.emit('wallet:balance:update', {
        previousBalance: this.config.balance,
        newBalance: this.config.balance,
        change: 0,
      });

      // Wait for reels to stop, then run step-by-step presentation
      const reelsStoppedId = this.eventBus.on('game:reels:stopped', () => {
        this.eventBus.off(reelsStoppedId);
        this.runStepPresentation(spinData.steps, this.totalWin, payload.bet, spinData);
      });

      // Handle triggered features
      if (spinData.series && spinData.featureQueue && spinData.featureQueue.length > 0) {
        this.handleFeatureTriggered(spinData.series, spinData.featureQueue);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown spin error';
      this.logger.error('Spin error:', errorMsg);
      this.handleSpinError(previousBalance, errorMsg);
    }
  }

  /**
   * Run the step-by-step presentation after reels stop.
   */
  private async runStepPresentation(
    steps: any[],
    totalWin: number,
    bet: number,
    spinData: any,
  ): Promise<void> {
    this.state = GameState.PRESENTING_STEPS;

    // Determine the final matrix: last CASCADE gridAfter, or RESULT grid, or round.matrixString
    const lastCascade = [...steps].reverse().find(s => s.type === 'CASCADE');
    const resultStep = steps.find(s => s.type === 'RESULT');
    const finalMatrixString = lastCascade?.gridAfter?.matrixString
      ?? resultStep?.grid?.matrixString
      ?? spinData.matrixString;

    // Delegate everything to the ResultPresentationController
    await this.resultController.handleSpinResult(
      spinData.roundId,
      steps,
      totalWin,
      bet,
      finalMatrixString,
    );

    // Apply final grid with full Y-position reset to fix cascade displacement
    this.applyFinalGrid(finalMatrixString);

    // Update the round model with the FINAL matrix (not the initial one)
    // This prevents any later reader from getting stale data
    const round = this.session.getRound();
    round.setResult(
      finalMatrixString,
      { amount: this.totalWin, currency: 'GBP' },
      [],
      spinData.waysCount || 1024,
    );

    this.logger.info(`Final matrix committed: ${finalMatrixString.substring(0, 30)}...`);

    this.completeRound();
  }

  /**
   * Apply final grid state with full position reset.
   * After cascade animations, symbol instances may be at arbitrary Y positions.
   * This resets every visible symbol to its canonical grid position, correct ID,
   * and idle visual state — ensuring no drift from cascade displacement.
   */
  private applyFinalGrid(matrixString: string): void {
    const grid = this.gridManager.getGridContainer();
    if (!grid) return;

    const gridConfig = grid.getConfig();
    const rows = matrixString.split(';');
    const reels = grid.getReels();

    this.logger.debug(`applyFinalGrid: ${matrixString}`);

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const symbolIds = this.parseMatrixRow(rows[rowIdx]);
      for (let col = 0; col < symbolIds.length; col++) {
        const reel = reels[col];
        if (!reel) continue;
        const symbol = reel.getSymbols()[1 + rowIdx]; // array index: 0=buffer, 1..rows=visible
        if (symbol) {
          symbol.setSymbolId(symbolIds[col]);
          symbol.visible = true;
          symbol.alpha = 1;
          symbol.scale.set(0.82);
          // Reset Y to canonical grid position (fixes cascade displacement)
          symbol.y = rowIdx * (gridConfig.cellHeight + gridConfig.spacing) + gridConfig.cellHeight / 2;
          symbol.x = gridConfig.cellWidth / 2;
          symbol.setState('idle', true);
        }
      }
    }

    this.lastCommittedMatrix = matrixString;
  }

  /** Parse a matrix row handling multi-char symbols like "10" */
  private parseMatrixRow(rowStr: string): string[] {
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

  private handleSpinError(previousBalance: number, errorMsg?: string): void {
    this.config.balance = previousBalance;
    this.eventBus.emit('wallet:balance:update', {
      previousBalance: this.config.balance,
      newBalance: previousBalance,
      change: 0,
    });
    this.eventBus.emit('game:error', { error: errorMsg || 'Spin failed', type: 'spin' });
    this.state = GameState.IDLE;
    this.spinLoop.forceStop();
  }

  private handleFeatureTriggered(series: any, featureQueue: any[]): void {
    const feature = this.session.getFeature();
    feature.startSeries(series);
    feature.setQueue(featureQueue);
    this.state = GameState.FEATURE;
    this.eventBus.emit('feature:triggered', { featureType: series.mode, data: series });
  }

  private completeRound(): void {
    // Log the matrix at idle entry for validation
    this.logger.info(`Completing round → IDLE. Committed matrix: ${this.lastCommittedMatrix.substring(0, 40)}...`);

    // Verify grid matches committed matrix
    this.validateGridMatchesMatrix();

    this.eventBus.emit('game:spin:complete', {
      roundId: this.currentRoundId,
      totalWin: this.totalWin,
      duration: 0,
    });

    this.totalWin = 0;

    const feature = this.session.getFeature();
    if (feature.isInFeature()) {
      this.state = GameState.FEATURE;
      this.logger.debug('State set to FEATURE');
    } else {
      this.state = GameState.IDLE;
      this.logger.info('State set to IDLE - ready for next spin');
    }
  }

  /** Validate that the visible grid symbols match the committed matrix */
  private validateGridMatchesMatrix(): void {
    if (!this.lastCommittedMatrix) return;
    const grid = this.gridManager.getGridContainer();
    if (!grid) return;

    const expectedRows = this.lastCommittedMatrix.split(';');
    const reels = grid.getReels();
    const mismatches: string[] = [];

    for (let row = 0; row < expectedRows.length; row++) {
      const expectedSymbols = this.parseMatrixRow(expectedRows[row]);
      for (let col = 0; col < expectedSymbols.length; col++) {
        const reel = reels[col];
        if (!reel) continue;
        const symbol = reel.getSymbols()[1 + row];
        if (symbol && symbol.getSymbolId() !== expectedSymbols[col]) {
          mismatches.push(`(${row},${col}): got '${symbol.getSymbolId()}' expected '${expectedSymbols[col]}'`);
        }
      }
    }

    if (mismatches.length > 0) {
      this.logger.error(`❌ Grid/matrix mismatch at idle entry! ${mismatches.length} cells differ: ${mismatches.join(', ')}`);
    } else {
      this.logger.info('✅ Grid matches committed matrix at idle entry');
    }
  }

  // ── (cascade config no longer needed — StepSequencePresenter drives phases directly) ──

  // ── Feature action (for free spins / HNS) ───────────────────────────

  public async executeFeatureAction(action: 'PLAY' | 'STOP' | 'DECLINE' | 'COLLECT' | 'SUMMARY' = 'PLAY'): Promise<boolean> {
    const feature = this.session.getFeature();
    const series = feature.getSeries();

    if (!series) {
      this.logger.warn('No active feature series');
      return false;
    }

    this.logger.info(`Executing feature action: ${action} for series: ${series.seriesId}`);

    try {
      const response = await this.networkManager.featureAction(
        this.gameId, series.seriesId, series.resumeToken, action,
      );

      if (!response.success || !response.data) {
        const errorMsg = response.error || 'Feature action failed';
        this.logger.error('Feature action failed:', errorMsg);
        this.eventBus.emit('game:error', { error: errorMsg, type: 'feature' });
        return false;
      }

      const data = PayloadMapper.mapFeatureAction(response.data);
      this.config.balance = data.balance.amount;
      this.session.getWallet().setBalance(data.balance.amount);

      feature.updateSeries({
        ...series,
        remainingSpins: data.series.remainingSpins,
        remainingRespins: data.series.remainingRespins,
      });

      if (data.step) {
        const symbols = PayloadMapper.parseMatrix(data.step.matrixString);
        this.eventBus.emit('game:spin:result', {
          roundId: data.step.roundId,
          symbols,
          wins: [],
          totalWin: data.step.win.amount,
          features: [],
        });
        this.spinLoop.stopSpin(symbols);

        if (data.step.retrigger && data.step.retrigger.spins > 0) {
          feature.retriggerFreeSpins(data.step.retrigger.spins);
        }
      }

      const remaining = data.series.remainingSpins || data.series.remainingRespins || 0;
      if (remaining <= 0 && !data.nextAction.allowed.includes('PLAY')) {
        feature.endSeries();
        this.state = GameState.IDLE;
        this.eventBus.emit('feature:end', {
          featureType: series.mode,
          totalWin: data.balance.amount - this.config.balance + (data.step?.win?.amount || 0),
        });
      }

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown feature error';
      this.logger.error('Feature action error:', errorMsg);
      this.eventBus.emit('game:error', { error: errorMsg, type: 'feature' });
      return false;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────

  public requestSpin(): void {
    this.eventBus.emit('game:spin:request', { bet: this.config.bet, lines: this.config.lines });
  }

  public getState(): GameState { return this.state; }
  public getConfig(): GameConfig { return { ...this.config }; }
  public setBalance(balance: number): void { this.config.balance = balance; }
  public setBet(bet: number): void { this.config.bet = bet; }
  public isIdle(): boolean { return this.state === GameState.IDLE; }
  public getSession(): GameSession { return this.session; }

  public destroy(): void {
    this.resultController.destroy();
    GameController.instance = null;
  }
}
