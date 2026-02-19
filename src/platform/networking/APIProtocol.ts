/**
 * APIProtocol - Complete TypeScript definitions for game API protocol
 * Matches the backend JSON protocol for gameLaunch, spin, buyBonus, featureAction, reconnect
 */

// ============ Common Types ============

export interface MoneyValue {
  amount: number;
  currency: string;
}

export interface RequestMeta {
  apiVersion: string;
  requestId: string;
  clientTime: string;
}

export interface ResponseMeta {
  apiVersion: string;
  requestId: string;
  serverTime: string;
}

export interface AuthData {
  sessionToken: string;
}

export interface ClientInfo {
  device: 'desktop' | 'mobile' | 'tablet';
  locale: string;
}

export interface Position {
  row: number;
  col: number;
}

// ============ Game Launch ============

export interface GameLaunchRequest {
  type: 'gameLaunch';
  meta: RequestMeta;
  auth: AuthData;
  data: {
    userId: string;
    gameId: string;
    clientInfo: ClientInfo;
  };
}

export interface ReelsConfig {
  rows: number;
  cols: number;
  paylinesType: 'LINES' | 'WAYS' | 'CLUSTER' | 'MEGAWAYS';
  waysCount: number;
}

export interface GameConfig {
  rtp: number;
  volatility: 'low' | 'medium' | 'high';
  maxWinXBet: number;
  featuresAvailable: FeatureCode[];
}

export type FeatureCode =
  | 'FREE_SPINS' | 'HOLD_RESPIN' | 'GAMBLE' | 'MYSTERY' | 'EXPAND'
  | 'TUMBLE' | 'MULTIPLIERS' | 'BONUS_WHEEL' | 'JACKPOT' | 'MEGAWAYS'
  | 'MULTI_GAME' | 'MULTI_LINE' | 'MULTI_COIN' | 'RETRIGGER';

export interface PreviousRound {
  roundId: string;
  matrixString: string;
  win: MoneyValue;
}

export interface GameState {
  screen: 'lobby' | 'game' | 'reconnect' | 'loading';
  availableActions: string[];
}

export interface UnfinishedSession {
  exists: boolean;
  reason?: 'CLIENT_DISCONNECT' | 'SERVER_ERROR' | 'TIMEOUT';
  resumeEndpoint?: string;
  serverStateHash?: string;
  series?: UnfinishedSeries[];
}

export interface UnfinishedSeries {
  seriesId: string;
  mode: 'FS' | 'HNS' | 'BONUS';
  remainingSpins?: number;
  remainingRespins?: number;
  resumeToken: string;
  lastKnown?: {
    roundId: string;
    matrixString: string;
    win: MoneyValue;
  };
  hns?: {
    startLives: number;
    livesLeft: number;
    lockedItems: LockedItem[];
    corPositions: string;
    corValues: string;
  };
}

export interface GameLaunchResponse {
  type: 'gameLaunch';
  meta: ResponseMeta;
  data: {
    userId: string;
    gameId: string;
    gamename: string;
    gameType: 'SLOT' | 'TABLE' | 'INSTANT';
    currency: string;
    balance: MoneyValue;
    reels: ReelsConfig;
    config: GameConfig;
    previousRound?: PreviousRound;
    state: GameState;
    pendingSeries: SeriesData[];
    unfinished?: UnfinishedSession;
    extensions?: Record<string, unknown>;
  };
}

// ============ Spin ============

export interface BetData {
  total: MoneyValue;
  lines: number;
  coin: MoneyValue;
  coinsPerLine: number;
}

export interface SpinVariant {
  jurisdictionCode: string;
  operatorCode: string;
}

export interface SpinOptions {
  turbo?: boolean;
  auto?: boolean;
}

export interface SpinRequest {
  type: 'spin';
  meta: RequestMeta;
  auth: AuthData;
  data: {
    userId: string;
    gameId: string;
    mode: 'BASE' | 'FS' | 'HNS';
    bet: BetData;
    variant?: SpinVariant;
    options?: SpinOptions;
  };
}

export interface RoundData {
  roundId: string;
  roundSeq: number;
  mode: 'BASE' | 'FS' | 'HNS';
  matrixString: string;
  waysCount?: number;
}

export interface StepWinInfo {
  winType: 'LINE' | 'WAYS' | 'CLUSTER';
  symbol: string;
  positions: Position[];
  amount: number;
  multiplier?: number;
  lineId?: number;
  matchCount?: number;
}

/** First step in a spin – initial grid + evaluated wins */
export interface ResultStep {
  index: number;
  type: 'RESULT';
  grid: { matrixString: string };
  wins: StepWinInfo[];
  totalWin: MoneyValue;
}

/** Subsequent cascade step – removal, collapse, refill, re-evaluation */
export interface CascadeStep {
  index: number;
  type: 'CASCADE';
  gridBefore: { matrixString: string };
  removedPositions: Position[];
  movements?: Array<{
    from: Position;
    to: Position;
    symbol: string;
  }>;
  refills: Array<{
    position: Position;
    symbol: string;
  }>;
  gridAfter: { matrixString: string };
  wins: StepWinInfo[];
  stepWin: MoneyValue;
  cumulativeWin: MoneyValue;
  multiplier?: number;
}

export type SpinStep = ResultStep | CascadeStep;

// Legacy aliases kept for backward compat with existing code
export type WinInfo = StepWinInfo;
export interface TumbleInfo {
  index: number;
  matrixStringBefore?: string;
  matrixStringAfter: string;
  win: MoneyValue;
  multiplierApplied: number;
  winPositions?: Position[];
  wins?: Array<{
    symbol: string;
    positions: Position[];
    amount: number;
    matchCount: number;
  }>;
  removedPositions?: Position[];
  movements?: Array<{
    from: Position;
    to: Position;
    symbol: string;
  }>;
  refills?: Array<{
    position: Position;
    symbol: string;
  }>;
  cumulativeWin?: number;
}

export interface MultiplierInfo {
  global: number;
  sources: Array<{
    type: string;
    value: number;
  }>;
}

export interface MysteryInfo {
  positions: Position[];
  revealedSymbol: string;
}

export interface ExpandingInfo {
  symbol: string;
  reelsExpanded: number[];
}

export interface JackpotPool {
  id: string;
  type: 'progressive' | 'fixed';
  displayAmount: number;
}

export interface JackpotInfo {
  contribution: MoneyValue;
  pools: JackpotPool[];
  draw: 'none' | 'pending' | 'won';
  wonPoolId?: string;
  wonAmount?: number;
}

export interface FeatureTriggered {
  featureType: FeatureCode;
  awarded?: number;
  triggerReason?: string;
  offer?: GambleOffer;
  seed?: BonusWheelSeed;
}

export interface GambleOffer {
  mode: 'DOUBLE' | 'HALF';
  pWin: number;
  stake: MoneyValue;
  maxPayout: MoneyValue;
}

export interface BonusWheelSeed {
  segments: string[];
  bias: 'uniform' | 'weighted';
}

export interface FeatureQueue {
  featureType: string;
  state: 'PENDING' | 'ACTIVE' | 'COMPLETE';
  priority: number;
}

export interface SeriesData {
  seriesId: string;
  mode: 'FS' | 'HNS' | 'BONUS';
  spinsAwarded?: number;
  remainingSpins?: number;
  remainingRespins?: number;
  resumeToken: string;
  retrigger?: { spins: number };
}

export interface NextAction {
  endpoint: string;
  allowed: string[];
}

export interface SpinResponse {
  type: 'spin';
  meta: ResponseMeta;
  data: {
    userId: string;
    gameId: string;
    gamename: string;
    gameType: 'SLOT';
    currency: string;
    balance: MoneyValue;
    round: RoundData;
    stake: MoneyValue;
    win: MoneyValue;
    /** Step-based results: first step is RESULT, subsequent are CASCADE */
    steps: SpinStep[];
    multipliers?: MultiplierInfo;
    mystery?: MysteryInfo;
    expanding?: ExpandingInfo;
    jackpot?: JackpotInfo;
    featuresTriggered?: FeatureTriggered[];
    featureQueue?: FeatureQueue[];
    series?: SeriesData;
    nextAction: NextAction;
    unfinished: { exists: boolean };
    extensions?: Record<string, unknown>;
  };
}

// ============ Buy Bonus ============

export interface BuyBonusRequest {
  type: 'buyBonus';
  meta: RequestMeta;
  auth: AuthData;
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

export interface LockedItem {
  row: number;
  col: number;
  amount: number;
  symbol?: string;
  multiplier?: number;
}

export interface HNSData {
  startLives: number;
  livesLeft?: number;
  lockedItems: LockedItem[];
  corPositions?: string;
  corValues?: string;
  totalCollected?: number;
}

export interface PurchaseData {
  purchaseId: string;
  featureCode: string;
  charged: MoneyValue;
}

export interface BuyBonusResponse {
  type: 'buyBonus';
  meta: ResponseMeta;
  data: {
    userId: string;
    gameId: string;
    gamename: string;
    gameType: 'SLOT';
    currency: string;
    balance: MoneyValue;
    purchase: PurchaseData;
    round: Partial<RoundData>;
    hns?: HNSData;
    series: SeriesData;
    featureQueue: FeatureQueue[];
    nextAction: NextAction;
    unfinished: { exists: boolean };
    extensions?: Record<string, unknown>;
  };
}

// ============ Feature Action ============

export interface FeatureActionRequest {
  type: 'featureAction';
  meta: RequestMeta;
  auth: AuthData;
  data: {
    gameId: string;
    seriesId: string;
    resumeToken: string;
    action: {
      type: 'PLAY' | 'STOP' | 'DECLINE' | 'COLLECT' | 'SUMMARY';
    };
  };
}

export interface StepData {
  stepId: string;
  roundId: string;
  matrixString: string;
  win: MoneyValue;
  multipliers?: MultiplierInfo;
  retrigger?: { spins: number };
}

export interface FeatureActionResponse {
  type: 'featureAction';
  meta: ResponseMeta;
  data: {
    userId: string;
    gameId: string;
    gamename: string;
    gameType: 'SLOT';
    currency: string;
    balance: MoneyValue;
    series: SeriesData;
    step?: StepData;
    hns?: HNSData;
    jackpot?: JackpotInfo;
    nextAction: NextAction;
    unfinished: { exists: boolean };
    extensions?: Record<string, unknown>;
  };
}

// ============ Reconnect / Balance ============

export interface BalanceRequest {
  type: 'balance';
  meta: RequestMeta;
  auth: AuthData;
  data: {
    userId: string;
    gameId: string;
  };
}

export interface BalanceResponse {
  type: 'balance';
  meta: ResponseMeta;
  data: {
    userId: string;
    gameId: string;
    gamename: string;
    gameType: 'SLOT';
    currency: string;
    balance: MoneyValue;
    unfinished?: UnfinishedSession;
    nextAction?: NextAction;
  };
}

// ============ Type Guards ============

export function isGameLaunchResponse(response: unknown): response is GameLaunchResponse {
  return typeof response === 'object' && response !== null && (response as any).type === 'gameLaunch';
}

export function isSpinResponse(response: unknown): response is SpinResponse {
  return typeof response === 'object' && response !== null && (response as any).type === 'spin';
}

export function isBuyBonusResponse(response: unknown): response is BuyBonusResponse {
  return typeof response === 'object' && response !== null && (response as any).type === 'buyBonus';
}

export function isFeatureActionResponse(response: unknown): response is FeatureActionResponse {
  return typeof response === 'object' && response !== null && (response as any).type === 'featureAction';
}

export function isBalanceResponse(response: unknown): response is BalanceResponse {
  return typeof response === 'object' && response !== null && (response as any).type === 'balance';
}

// ============ Request Builders ============

export function createRequestMeta(): RequestMeta {
  return {
    apiVersion: '1.0.0',
    requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    clientTime: new Date().toISOString(),
  };
}

export function createGameLaunchRequest(
  sessionToken: string,
  userId: string,
  gameId: string,
  device: ClientInfo['device'] = 'desktop',
  locale: string = 'en-GB'
): GameLaunchRequest {
  return {
    type: 'gameLaunch',
    meta: createRequestMeta(),
    auth: { sessionToken },
    data: {
      userId,
      gameId,
      clientInfo: { device, locale },
    },
  };
}

export function createSpinRequest(
  sessionToken: string,
  userId: string,
  gameId: string,
  bet: BetData,
  mode: 'BASE' | 'FS' | 'HNS' = 'BASE',
  options?: SpinOptions
): SpinRequest {
  return {
    type: 'spin',
    meta: createRequestMeta(),
    auth: { sessionToken },
    data: {
      userId,
      gameId,
      mode,
      bet,
      variant: { jurisdictionCode: 'UKGC', operatorCode: 'OP-001' },
      options,
    },
  };
}

export function createFeatureActionRequest(
  sessionToken: string,
  gameId: string,
  seriesId: string,
  resumeToken: string,
  action: 'PLAY' | 'STOP' | 'DECLINE' | 'COLLECT' | 'SUMMARY'
): FeatureActionRequest {
  return {
    type: 'featureAction',
    meta: createRequestMeta(),
    auth: { sessionToken },
    data: {
      gameId,
      seriesId,
      resumeToken,
      action: { type: action },
    },
  };
}

export function createBuyBonusRequest(
  sessionToken: string,
  userId: string,
  gameId: string,
  featureCode: string,
  price: number,
  currency: string = 'GBP'
): BuyBonusRequest {
  return {
    type: 'buyBonus',
    meta: createRequestMeta(),
    auth: { sessionToken },
    data: {
      userId,
      gameId,
      bonus: {
        featureCode,
        price: { amount: price, currency },
      },
      coin: { amount: 1.00, currency },
    },
  };
}
