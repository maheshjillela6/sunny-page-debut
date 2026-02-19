/**
 * GameShell - React component that hosts the Pixi canvas
 * Handles loading sequence and session management
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRef as useStateRef } from 'react';
import { EngineKernel, EngineState } from '../../engine/core/EngineKernel';
import { EventBus } from '../../platform/events/EventBus';
import { GameSession } from '../../gameplay/state/GameSession';
import { LoadingProgress, LoadingPhase } from '../../engine/core/GameLoader';
import { ConfigurableGameHUD } from '../hud/ConfigurableGameHUD';
import { LoadingScreen } from './LoadingScreen';
import { UnfinishedSessionModal } from './UnfinishedSessionModal';
import { BigWinOverlay } from '../overlays/BigWinOverlay';
import { useLocale } from '@/ui/providers/LocaleProvider';
import { TurboState } from '@/gameplay/timing/TurboState';

interface GameShellProps {
  gameId: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onExit?: () => void;
}

export const GameShell: React.FC<GameShellProps> = ({
  gameId,
  onReady,
  onError,
  onExit,
}) => {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EngineKernel | null>(null);
  const initializingRef = useRef<boolean>(false);
  
  const [isReady, setIsReady] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState(10);
  const [lastWin, setLastWin] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentStrategy, setCurrentStrategy] = useState('');
  const [currentFeature, setCurrentFeature] = useState('baseGame');
  const [gameName, setGameName] = useState('');
  const [hasUnfinished, setHasUnfinished] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Win overlay state
  const [winOverlay, setWinOverlay] = useState<{ amount: number; type: 'big' | 'mega' | 'epic' } | null>(null);

  // Turbo state
  const [turboActive, setTurboActive] = useState(false);
  
  // Loading state
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    phase: LoadingPhase.IDLE,
    phaseProgress: 0,
    totalProgress: 0,
    message: 'Initializing...',
  });

  useEffect(() => {
    const eventBus = EventBus.getInstance();
    
    // Listen for loading progress
    const onLoadingProgress = (progress: LoadingProgress) => {
      setLoadingProgress(progress);
    };
    eventBus.on('game:loading:progress', onLoadingProgress);

    // Listen for game errors
    const onGameError = (payload: { error: string; type: string }) => {
      console.error(`[GameShell] Game error (${payload.type}):`, payload.error);
      if (payload.type === 'launch') {
        setError(`Failed to connect to game server: ${payload.error}`);
        setIsReady(false);
      } else if (payload.type === 'spin') {
        // Show temporary error toast for spin errors
        setError(`Spin failed: ${payload.error}`);
        setTimeout(() => setError(null), 3000);
      }
    };
    eventBus.on('game:error', onGameError);

    const initEngine = async () => {
      if (!containerRef.current || initializingRef.current) return;
      
      // Prevent duplicate initialization (React Strict Mode / double renders)
      if (engineRef.current) {
        console.log('[GameShell] Engine already exists, skipping initialization');
        return;
      }
      
      initializingRef.current = true;

      try {
        const engine = EngineKernel.getInstance();
        engineRef.current = engine;

        console.log('[GameShell] Initializing engine for game:', gameId);

        await engine.initialize({
          containerId: 'game-canvas-container',
          gameId,
          debug: false,
          networkMode: 'mock', // Use mock adapter for local development
        });

        // Check if engine initialization was successful
        if (engine.getState() === EngineState.ERROR) {
          throw new Error('Engine initialization failed - check server connection');
        }

        engine.start();

        // Get session state
        const session = GameSession.getInstance();

        // Get game config info
        const manifest = engine.getGameManifest();
        if (manifest) {
          setGameName(manifest.manifest.name);
          const baseGameConfig = manifest.manifest.features.baseGame;
          if (baseGameConfig) {
            setCurrentStrategy(baseGameConfig.spinStrategy);
          }
        }

        // Initialize from session data
        setBalance(session.getWallet().getBalance());
        setBet(session.getWallet().getBet());
        setHasUnfinished(session.hasUnfinishedSession());

        // Setup event listeners - store subscription IDs for cleanup
        const spinStartId = eventBus.on('game:spin:start', () => {
          console.log('[GameShell] Spin started');
          setIsSpinning(true);
          setLastWin(0);
          setWinOverlay(null); // Clear any previous win overlay
        });

        const spinCompleteId = eventBus.on('game:spin:complete', (payload) => {
          console.log('[GameShell] Spin complete, win:', payload.totalWin);
          setIsSpinning(false);
          setLastWin(payload.totalWin);
        });
         
         // Listen for game errors that should reset spin state
         eventBus.on('game:error', (payload) => {
           if (payload.type === 'spin') {
             setIsSpinning(false);
           }
         });

        // Listen for win type events to show overlays
        eventBus.on('game:win', (payload) => {
          console.log(`[GameShell] Win detected: $${payload.amount.toFixed(2)}, type: ${payload.winType}, multiplier: ${payload.multiplier.toFixed(1)}x`);
          setLastWin(payload.amount);
          
          // Show big win overlay for big/mega/epic wins
          if (payload.winType === 'big' || payload.winType === 'mega' || payload.winType === 'epic') {
            setWinOverlay({ amount: payload.amount, type: payload.winType });
          }
        });
 
        // Also listen for spin result to update balance immediately
        const spinResultId = eventBus.on('game:spin:result', () => {
          // Balance update comes from wallet:balance:update event
        });

        eventBus.on('wallet:balance:update', (payload) => {
          setBalance(payload.newBalance);
        });

        eventBus.on('game:spin:strategy:changed', (payload) => {
          setCurrentStrategy(payload.strategyId);
        });

        eventBus.on('feature:start', (payload) => {
          setCurrentFeature(payload.featureType);
          const spinConfig = engine.getFeatureSpinStrategy(payload.featureType);
          if (spinConfig) {
            setCurrentStrategy(spinConfig.strategyId);
          }
        });

        eventBus.on('feature:end', () => {
          setCurrentFeature('baseGame');
          const spinConfig = engine.getFeatureSpinStrategy('baseGame');
          if (spinConfig) {
            setCurrentStrategy(spinConfig.strategyId);
          }
        });

        eventBus.on('session:initialized', (payload) => {
          setHasUnfinished(payload.hasUnfinished);
        });

        eventBus.on('session:reconnected', () => {
          setIsReconnecting(false);
          setHasUnfinished(false);
        });

        setIsReady(true);
        setError(null);
        console.log('[GameShell] Engine ready, server communication established');
        onReady?.();
      } catch (err) {
        const errorMsg = (err as Error).message;
        console.error('[GameShell] Failed to initialize:', errorMsg);
        setError(`Server connection failed: ${errorMsg}`);
        setIsReady(false);
        onError?.(err as Error);
      } finally {
        initializingRef.current = false;
      }
    };

    initEngine();

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      initializingRef.current = false;
    };
  }, [gameId, onReady, onError]);

  const handleSpin = useCallback(() => {
    if (engineRef.current && !isSpinning && balance >= bet) {
      engineRef.current.requestSpin();
    }
  }, [isSpinning, balance, bet]);

  const handleTurboToggle = useCallback(() => {
    TurboState.getInstance().toggle();
    setTurboActive(TurboState.getInstance().isActive());
  }, []);

  const handleBetIncrease = useCallback(() => {
    const session = GameSession.getInstance();
    const wallet = session.getWallet();
    if (wallet.increaseBet()) {
      setBet(wallet.getBet());
    }
  }, []);

  const handleBetDecrease = useCallback(() => {
    const session = GameSession.getInstance();
    const wallet = session.getWallet();
    if (wallet.decreaseBet()) {
      setBet(wallet.getBet());
    }
  }, []);

  const handleResumeSession = useCallback(() => {
    setIsReconnecting(true);
    const session = GameSession.getInstance();
    const unfinished = session.getUnfinished();
    
    if (unfinished.series && unfinished.series.length > 0) {
      // Resume via network service
      session.clearUnfinished();
      session.reconnect();
    }
    
    setHasUnfinished(false);
    setIsReconnecting(false);
  }, []);

  const handleCancelSession = useCallback(() => {
    const session = GameSession.getInstance();
    session.clearUnfinished();
    setHasUnfinished(false);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space' && !isSpinning && isReady && !hasUnfinished) {
      event.preventDefault();
      handleSpin();
    }
  }, [isSpinning, isReady, hasUnfinished, handleSpin]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleWinOverlayComplete = useCallback(() => {
    setWinOverlay(null);
  }, []);

  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      {/* Canvas Container */}
      <div
        id="game-canvas-container"
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Loading Screen */}
      {!isReady && !error && (
        <LoadingScreen 
          progress={loadingProgress}
          gameName={gameName || gameId}
        />
      )}

      {/* Unfinished Session Modal */}
      {hasUnfinished && isReady && (
        <UnfinishedSessionModal
          isReconnecting={isReconnecting}
          onResume={handleResumeSession}
          onCancel={handleCancelSession}
        />
      )}

      {/* HUD Overlay */}
      {isReady && !hasUnfinished && (
        <ConfigurableGameHUD
          gameId={gameId}
          gameName={gameName || gameId}
          currentFeature={currentFeature}
          currentStrategy={currentStrategy}
          balance={balance}
          bet={bet}
          lastWin={lastWin}
          isSpinning={isSpinning}
          turboActive={turboActive}
          onSpin={handleSpin}
          onExit={onExit}
          onTurboToggle={handleTurboToggle}
          onBetIncrease={handleBetIncrease}
          onBetDecrease={handleBetDecrease}
        />
      )}

      {/* Big/Mega/Epic Win Overlay */}
      {winOverlay && (
        <BigWinOverlay
          amount={winOverlay.amount}
          type={winOverlay.type}
          onComplete={handleWinOverlayComplete}
        />
      )}

      {/* Error State - Connection or Asset Loading Errors */}
      {error && !isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-50">
          <div className="text-center max-w-md p-6">
            <div className="text-6xl mb-4">
              {error.includes('assets') || error.includes('Required') ? '🖼️' : '⚠️'}
            </div>
            <p className="text-xl font-bold text-destructive mb-2">
              {error.includes('assets') || error.includes('Required') ? t('error.asset_loading') : t('error.connection_error')}
            </p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground">
              {error.includes('assets') || error.includes('Required')
                ? t('error.asset_loading_desc')
                : t('error.connection_error_desc')}
            </p>
            <button 
              onClick={onExit}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              {t('ui.return_to_lobby')}
            </button>
          </div>
        </div>
      )}
      
      {/* Temporary Error Toast (for spin errors) */}
      {error && isReady && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-md shadow-lg">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameShell;
