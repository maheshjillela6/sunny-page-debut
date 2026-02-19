/**
 * useEngine - Hook to access the game engine
 */

import { useState, useEffect, useCallback } from 'react';
import { EventBus } from '@/platform/events/EventBus';

interface EngineState {
  isReady: boolean;
  isSpinning: boolean;
  currentGame: string | null;
  error: Error | null;
}

export function useEngine() {
  const [state, setState] = useState<EngineState>({
    isReady: false,
    isSpinning: false,
    currentGame: null,
    error: null,
  });

  useEffect(() => {
    const eventBus = EventBus.getInstance();

    const handleReady = () => {
      setState((prev) => ({ ...prev, isReady: true }));
    };

    const handleSpinStart = () => {
      setState((prev) => ({ ...prev, isSpinning: true }));
    };

    const handleSpinComplete = () => {
      setState((prev) => ({ ...prev, isSpinning: false }));
    };

    const handleError = (payload: { error: Error }) => {
      setState((prev) => ({ ...prev, error: payload.error }));
    };

    eventBus.on('engine:ready', handleReady);
    eventBus.on('game:spin:start', handleSpinStart);
    eventBus.on('game:spin:complete', handleSpinComplete);
    eventBus.on('engine:error', handleError);

    return () => {
      eventBus.off('engine:ready');
      eventBus.off('game:spin:start');
      eventBus.off('game:spin:complete');
      eventBus.off('engine:error');
    };
  }, []);

  const requestSpin = useCallback(() => {
    const eventBus = EventBus.getInstance();
    eventBus.emit('game:spin:request', { bet: 1, lines: 25 });
  }, []);

  const setSpinStrategy = useCallback((strategyId: string) => {
    const eventBus = EventBus.getInstance();
    eventBus.emit('game:spin:strategy:change', { strategyId });
  }, []);

  return {
    ...state,
    requestSpin,
    setSpinStrategy,
  };
}

export default useEngine;
