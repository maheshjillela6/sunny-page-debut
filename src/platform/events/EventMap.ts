/**
 * EventMap - Type definitions for all game events
 */

// ============ Engine Events ============
export interface EngineInitPayload {
  timestamp: number;
}

export interface EngineReadyPayload {
  timestamp: number;
}

export interface EngineErrorPayload {
  error: Error;
  context: string;
}

export interface EnginePausePayload {
  reason: string;
}

export interface EngineResumePayload {
  pausedDuration: number;
}

// ============ Game Events ============
export interface GameErrorPayload {
  error: string;
  type: 'launch' | 'spin' | 'feature' | 'connection' | 'unknown';
}

export interface SpinRequestPayload {
  bet: number;
  lines: number;
}

export interface SpinStartPayload {
  bet: number;
  lines?: number;
}

export interface SpinResultPayload {
  roundId: string;
  symbols: string[][];
  wins: WinData[];
  totalWin: number;
  features: string[];
}

export interface SpinCompletePayload {
  roundId: string;
  totalWin: number;
  duration: number;
}

export interface WinData {
  lineId: number;
  symbols: string[];
  positions: { row: number; col: number }[];
  amount: number;
  multiplier: number;
}

export interface ReelSpinStartPayload {
  reelIndex: number;
}

export interface ReelSpinStopPayload {
  reelIndex: number;
  symbols: string[];
}

export interface AllReelsStoppedPayload {
  symbols: string[][];
}

// ============ Feature Events ============
export interface FeatureTriggeredPayload {
  featureType: string;
  data: unknown;
}

export interface FeatureStartPayload {
  featureType: string;
  featureData?: unknown;
}

export interface FeatureEndPayload {
  featureType: string;
  totalWin: number;
  featureData?: unknown;
}

export interface FeatureUpdatePayload {
  featureType: string;
  featureData: unknown;
}

export interface FreeSpinsAwardedPayload {
  count: number;
  multiplier: number;
}

export interface FreeSpinStartPayload {
  spinNumber: number;
  remaining: number;
  multiplier: number;
}

export interface FreeSpinEndPayload {
  spinNumber: number;
  win: number;
}

export interface FreeSpinsTriggerPayload {
  spins: number;
  multiplier: number;
  triggerCount: number;
}

export interface FreeSpinsRetriggerPayload {
  additionalSpins: number;
}

export interface HoldRespinTriggerPayload {
  heldSymbols: Array<{ row: number; col: number; symbolId: string; value?: number }>;
}

export interface MultiplierChangePayload {
  previousMultiplier: number;
  newMultiplier: number;
}

export interface WildStickyAddPayload {
  row: number;
  col: number;
  duration: number;
  multiplier?: number;
}

export interface WildStickyRemovePayload {
  row: number;
  col: number;
}

export interface WildExpandStartPayload {
  col: number;
  sourceRow: number;
}

export interface WildExpandCompletePayload {
  col: number;
}

export interface BonusPickPayload {
  prizeId: string;
}

export interface BonusPrizeRevealedPayload {
  prize: {
    id: string;
    type: 'credits' | 'multiplier' | 'freespins' | 'jackpot' | 'collect';
    value: number;
    revealed: boolean;
  };
  totalWin: number;
  picksRemaining: number;
}

export interface GameWinDetectedPayload {
  wins: WinData[];
  totalWin: number;
}

export interface CascadeStartPayload {
  totalSteps: number;
  totalWin: number;
}

export interface CascadeStepStartPayload {
  stepIndex: number;
  wins: Array<{ symbol: string; positions: { row: number; col: number }[]; amount: number }>;
  multiplier: number;
}

export interface CascadeStepCompletePayload {
  stepIndex: number;
  cumulativeWin: number;
  multiplier: number;
}

export interface CascadePhasePayload {
  phase: 'winPresentation' | 'removal' | 'collapse' | 'refill';
  stepIndex: number;
}

export interface CascadeCompletePayload {
  cascadeCount: number;
}

// ============ UI Events ============
export interface BetChangePayload {
  previousBet: number;
  newBet: number;
}

export interface LinesChangePayload {
  previousLines: number;
  newLines: number;
}

export interface AutoPlayStartPayload {
  totalSpins: number;
  stopConditions: AutoPlayStopConditions;
}

export interface AutoPlayStopPayload {
  reason: string;
  spinsCompleted: number;
}

export interface AutoPlayStopConditions {
  onWin?: number;
  onLoss?: number;
  onFeature?: boolean;
}

export interface ButtonPressPayload {
  buttonId: string;
}

export interface ModalOpenPayload {
  modalId: string;
  data?: unknown;
}

export interface ModalClosePayload {
  modalId: string;
}

// ============ Network Events ============
export interface NetworkRequestPayload {
  requestId: string;
  endpoint: string;
  type?: 'rest' | 'stomp' | 'mock';
}

export interface NetworkResponsePayload {
  requestId: string;
  data: unknown;
  duration: number;
}

export interface NetworkErrorPayload {
  requestId: string;
  error: Error;
  retryCount: number;
}

export interface NetworkConnectedPayload {
  type: 'rest' | 'stomp' | 'mock';
}

export interface NetworkDisconnectedPayload {
  type: 'rest' | 'stomp' | 'mock';
}

// ============ Game Loading Events ============
export interface GameLoadedPayload {
  gameId: string;
  config: unknown;
  hasUnfinishedSession: boolean;
}

export interface GameLoadErrorPayload {
  gameId: string;
  error: string;
}

export interface GameLoadingProgressPayload {
  phase: string;
  phaseProgress: number;
  totalProgress: number;
  message: string;
}

export interface GameUpdatePayload {
  type?: string;
  data?: unknown;
}

// ============ Renderer Events ============
export interface ResizePayload {
  width: number;
  height: number;
  scale: number;
}

export interface OrientationChangePayload {
  orientation: 'landscape' | 'portrait';
}

export interface VisibilityChangePayload {
  isVisible: boolean;
}

// ============ Viewport Events ============
export interface ViewportResizePayload {
  screenWidth: number;
  screenHeight: number;
  virtualWidth: number;
  virtualHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  breakpoint: 'desktop' | 'tablet' | 'mobile' | 'mobileLandscape';
  orientation: 'landscape' | 'portrait';
}

export interface ViewportBreakpointChangedPayload {
  breakpoint: 'desktop' | 'tablet' | 'mobile' | 'mobileLandscape';
  orientation: 'landscape' | 'portrait';
  virtualWidth: number;
  virtualHeight: number;
}

// ============ Wallet Events ============
export interface BalanceUpdatePayload {
  previousBalance: number;
  newBalance: number;
  change: number;
}

export interface WinCounterStartPayload {
  targetValue: number;
  duration: number;
}

export interface WinCounterCompletePayload {
  finalValue: number;
}

// ============ Spin Strategy Events ============
export interface SpinStrategyChangePayload {
  strategyId: string;
  config?: {
    maxSpeed?: number;
    acceleration?: number;
    deceleration?: number;
    bounceStrength?: number;
    staggerDelay?: number;
  };
}

export interface SpinStrategyChangedPayload {
  strategyId: string;
}

// ============ Audio Events ============
export interface SoundPlayPayload {
  soundId: string;
  volume?: number;
  loop?: boolean;
}

export interface SoundStopPayload {
  soundId: string;
}

export interface MusicChangePayload {
  trackId: string;
  fade?: boolean;
}

// ============ Asset Events ============
export interface AssetLoadStartPayload {
  total: number;
}

export interface AssetLoadProgressPayload {
  loaded: number;
  total: number;
  percent: number;
  currentAsset: string;
  phase: 'textures' | 'atlases' | 'spine' | 'images' | 'spritesheets' | 'audio' | 'fonts' | 'json' | 'complete';
}

export interface AssetLoadCompletePayload {
  total: number;
}

export interface AssetLoadErrorPayload {
  error: string;
}

// ============ Win Events ============
export interface GameWinPayload {
  amount: number;
  multiplier: number;
  winType: 'normal' | 'big' | 'mega' | 'epic';
}

// ============ Session Events ============
export interface SessionReadyPayload {
  sessionId: string;
}

export interface SessionInitializedPayload {
  sessionId: string;
  gameId: string;
  hasUnfinished: boolean;
}

export interface SessionPlayingPayload {
  sessionId: string;
}

export interface SessionPausedPayload {
  sessionId: string;
}

export interface SessionResumedPayload {
  sessionId: string;
}

export interface SessionDisconnectedPayload {
  sessionId: string;
}

export interface SessionReconnectedPayload {
  sessionId: string;
}

export interface SessionErrorPayload {
  sessionId: string;
  error: string;
}

// ============ Round Events ============
export interface RoundStartedPayload {
  roundId: string;
  mode: string;
}

export interface RoundResultPayload {
  roundId: string;
  matrix: string[][];
  win: { amount: number; currency: string };
  wins: WinData[];
  steps?: any[];
}

export interface RoundTumblesPayload {
  roundId: string;
  tumbles: Array<{
    index: number;
    matrixStringAfter: string;
    win: { amount: number; currency: string };
    multiplierApplied: number;
  }>;
}

export interface RoundMultiplierPayload {
  roundId: string;
  multiplier: number;
  sources: Array<{ type: string; value: number }>;
}

export interface RoundPresentationStartPayload {
  roundId: string;
}

export interface RoundCompletePayload {
  roundId: string;
  totalWin: number;
  duration: number;
}

// ============ Wallet State Events ============
export interface WalletStateChangePayload {
  balance: number;
  bet: number;
}

// ============ Feature State Events ============
export interface FeatureFreespinsInitPayload {
  spinsAwarded: number;
}

export interface FeatureFreespinsSpinPayload {
  remaining: number;
  total: number;
}

export interface FeatureStickyAddPayload {
  position: { row: number; col: number };
}

export interface FeatureHNSInitPayload {
  lives: number;
  lockedCount: number;
}

export interface FeatureHNSLifePayload {
  livesLeft: number;
}

export interface FeatureHNSLockPayload {
  item: { row: number; col: number; amount: number };
}

export interface FeatureGambleOfferPayload {
  offer: {
    mode: string;
    pWin: number;
    stake: { amount: number; currency: string };
    maxPayout: { amount: number; currency: string };
  };
}

export interface FeatureWheelInitPayload {
  segments: string[];
}

export interface FeatureWheelResultPayload {
  result: string;
  multiplier?: number;
}

// ============ Result Presentation Events (facts only) ============

/** Emitted when the result presentation controller resolves the win tier */
export interface WinTierResolvedPayload {
  resultFlowId: string;
  spinId: string;
  tier: 'normal' | 'big' | 'mega' | 'epic' | 'none';
  totalWin: number;
  totalBet: number;
  multiplier: number;
}

/** Emitted when win presentation animation starts */
export interface WinPresentationStartedPayload {
  resultFlowId: string;
  spinId: string;
  tier: 'normal' | 'big' | 'mega' | 'epic';
}

/** Emitted when win presentation animation completes */
export interface WinPresentationCompletedPayload {
  resultFlowId: string;
  spinId: string;
  tier: 'normal' | 'big' | 'mega' | 'epic';
  totalWin: number;
}

/** Emitted when the entire result presentation is done (idle allowed) */
export interface ResultPresentationCompletedPayload {
  resultFlowId: string;
  spinId: string;
  totalWin: number;
}

/** Emitted when a single step has been fully presented */
export interface StepPresentedPayload {
  resultFlowId: string;
  spinId: string;
  stepIndex: number;
  stepType: 'RESULT' | 'CASCADE';
  cumulativeWin: number;
}

/** Emitted when all steps in the sequence have been presented */
export interface SequenceCompletedPayload {
  resultFlowId: string;
  spinId: string;
  totalSteps: number;
  cumulativeWin: number;
}

/** Emitted when all result data (features included) is finalized */
export interface ResultDataFinalizedPayload {
  resultFlowId: string;
  spinId: string;
  finalTotalWin: number;
  featureCompleted: boolean;
}

/** Emitted after cascade phases (remove/drop/refill) complete and grid state is committed */
export interface StepGridCommittedPayload {
  resultFlowId: string;
  spinId: string;
  stepIndex: number;
  stepType: 'RESULT' | 'CASCADE';
  matrixString: string;
}

// ============ Spin Mechanism Events ============
export interface MechanismStartPayload {
  mechanismId: string;
  config: Record<string, unknown>;
}

export interface MechanismStepStartPayload {
  mechanismId: string;
  stepIndex: number;
}

export interface MechanismStepCompletePayload {
  mechanismId: string;
  stepIndex: number;
  stepWin: number;
  cumulativeWin: number;
  isComplete: boolean;
}

export interface MechanismCompletePayload {
  mechanismId: string;
  totalWin: number;
  totalSteps: number;
}

export interface MechanismCancelPayload {
  mechanismId: string;
}

export interface MechanismStateUpdatePayload {
  mechanismId: string;
  state: Record<string, unknown>;
}

// ============ Complete Event Map ============
export interface EventMap {
  // Engine
  'engine:init': EngineInitPayload;
  'engine:ready': EngineReadyPayload;
  'engine:error': EngineErrorPayload;
  'engine:pause': EnginePausePayload;
  'engine:resume': EngineResumePayload;
  'engine:destroy': void;

  // Session
  'session:ready': SessionReadyPayload;
  'session:initialized': SessionInitializedPayload;
  'session:playing': SessionPlayingPayload;
  'session:paused': SessionPausedPayload;
  'session:resumed': SessionResumedPayload;
  'session:disconnected': SessionDisconnectedPayload;
  'session:reconnected': SessionReconnectedPayload;
  'session:error': SessionErrorPayload;

  // Round
  'round:started': RoundStartedPayload;
  'round:result': RoundResultPayload;
  'round:tumbles': RoundTumblesPayload;
  'round:multiplier': RoundMultiplierPayload;
  'round:presentation:start': RoundPresentationStartPayload;
  'round:complete': RoundCompletePayload;

  // Game Flow
  'game:error': GameErrorPayload;
  'game:spin:request': SpinRequestPayload;
  'game:spin:start': SpinStartPayload;
  'game:spin:result': SpinResultPayload;
  'game:spin:complete': SpinCompletePayload;
  'game:spin:strategy:change': SpinStrategyChangePayload;
  'game:spin:strategy:changed': SpinStrategyChangedPayload;
  'game:reel:spin:start': ReelSpinStartPayload;
  'game:reel:spin:stop': ReelSpinStopPayload;
  'game:reels:stopped': AllReelsStoppedPayload;
  'game:win': GameWinPayload;
  'game:win:detected': GameWinDetectedPayload;
  'game:win:interrupted': void;
  'game:bigwin:show': { amount: number; type: 'big' | 'mega' | 'epic' };
  'game:cascade:start': CascadeStartPayload;
  'game:cascade:step:start': CascadeStepStartPayload;
  'game:cascade:step:complete': CascadeStepCompletePayload;
  'game:cascade:phase': CascadePhasePayload;
  'game:cascade:complete': CascadeCompletePayload;

  // Features
  'feature:triggered': FeatureTriggeredPayload;
  'feature:start': FeatureStartPayload;
  'feature:end': FeatureEndPayload;
  'feature:update': FeatureUpdatePayload;
  'feature:freespins:awarded': FreeSpinsAwardedPayload;
  'feature:freespin:start': FreeSpinStartPayload;
  'feature:freespin:end': FreeSpinEndPayload;
  'feature:freespins:trigger': FreeSpinsTriggerPayload;
  'feature:freespins:spin:complete': void;
  'feature:freespins:retrigger': FreeSpinsRetriggerPayload;
  'feature:freespins:init': FeatureFreespinsInitPayload;
  'feature:freespins:spin': FeatureFreespinsSpinPayload;
  'feature:holdrespin:trigger': HoldRespinTriggerPayload;
  'feature:multiplier:change': MultiplierChangePayload;
  'feature:multiplier:reset': MultiplierChangePayload;
  'feature:wild:sticky:add': WildStickyAddPayload;
  'feature:wild:sticky:remove': WildStickyRemovePayload;
  'feature:wild:expand:start': WildExpandStartPayload;
  'feature:wild:expand:complete': WildExpandCompletePayload;
  'feature:sticky:add': FeatureStickyAddPayload;
  'feature:hns:init': FeatureHNSInitPayload;
  'feature:hns:life': FeatureHNSLifePayload;
  'feature:hns:lock': FeatureHNSLockPayload;
  'feature:gamble:offer': FeatureGambleOfferPayload;
  'feature:wheel:init': FeatureWheelInitPayload;
  'feature:wheel:result': FeatureWheelResultPayload;
  'bonus:pick': BonusPickPayload;
  'bonus:prize:revealed': BonusPrizeRevealedPayload;

  // UI
  'ui:bet:change': BetChangePayload;
  'ui:lines:change': LinesChangePayload;
  'ui:autoplay:start': AutoPlayStartPayload;
  'ui:autoplay:stop': AutoPlayStopPayload;
  'ui:button:press': ButtonPressPayload;
  'ui:modal:open': ModalOpenPayload;
  'ui:modal:close': ModalClosePayload;

  // Network
  'network:request': NetworkRequestPayload;
  'network:response': NetworkResponsePayload;
  'network:error': NetworkErrorPayload;
  'network:connected': NetworkConnectedPayload;
  'network:disconnected': NetworkDisconnectedPayload;

  // Game Loading
  'game:loaded': GameLoadedPayload;
  'game:load:error': GameLoadErrorPayload;
  'game:loading:progress': GameLoadingProgressPayload;
  'game:update': GameUpdatePayload;

  // Renderer
  'renderer:resize': ResizePayload;
  'renderer:orientation': OrientationChangePayload;
  'renderer:visibility': VisibilityChangePayload;

  // Viewport (responsive)
  'viewport:resize': ViewportResizePayload;
  'viewport:breakpoint:changed': ViewportBreakpointChangedPayload;

  // Wallet
  'wallet:balance:update': BalanceUpdatePayload;
  'wallet:win:counter:start': WinCounterStartPayload;
  'wallet:win:counter:complete': WinCounterCompletePayload;
  'wallet:state:change': WalletStateChangePayload;

  // Audio
  'audio:sound:play': SoundPlayPayload;
  'audio:sound:stop': SoundStopPayload;
  'audio:music:change': MusicChangePayload;
  'audio:mute': void;
  'audio:unmute': void;

  // Assets
  'assets:load:start': AssetLoadStartPayload;
  'assets:load:progress': AssetLoadProgressPayload;
  'assets:load:complete': AssetLoadCompletePayload;
  'assets:load:error': AssetLoadErrorPayload;

  // Config
  'config:loaded': { gameId: string };
  'config:error': { gameId: string; error: string };

  // STOMP events
  'stomp:connecting': { url: string };
  'stomp:connected': { version?: string; heartbeat?: string };
  'stomp:disconnected': { reason?: string };
  'stomp:reconnecting': { attempt: number };
  'stomp:message': { destination: string; payload: unknown };
  'stomp:error': { error: Error };

  // Spine asset events
  'asset:spine:loaded': { key: string };

  // Spin Mechanism events
  'mechanism:start': MechanismStartPayload;
  'mechanism:step:start': MechanismStepStartPayload;
  'mechanism:step:complete': MechanismStepCompletePayload;
  'mechanism:complete': MechanismCompletePayload;
  'mechanism:cancel': MechanismCancelPayload;
  'mechanism:state:update': MechanismStateUpdatePayload;

  // Balance and jackpot events
  'balance:update': { balance: number; currency: string };
  'jackpot:update': unknown;
  'jackpot:win': unknown;
  'session:timeout': unknown;

  // Turbo
  'ui:turbo:changed': { active: boolean; speedMultiplier: number };

  // Result Presentation (facts only — emitted by ResultPresentationController)
  'result:win:tier:resolved': WinTierResolvedPayload;
  'result:win:presentation:started': WinPresentationStartedPayload;
  'result:win:presentation:completed': WinPresentationCompletedPayload;
  'result:presentation:completed': ResultPresentationCompletedPayload;
  'result:step:presented': StepPresentedPayload;
  'result:sequence:completed': SequenceCompletedPayload;
  'result:data:finalized': ResultDataFinalizedPayload;
  'result:step:grid:committed': StepGridCommittedPayload;
}

export type GameEventType = keyof EventMap;
