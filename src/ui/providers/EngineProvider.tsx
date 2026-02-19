/**
 * EngineProvider - Provides engine context to components
 */

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { EngineKernel } from '@/engine/core/EngineKernel';
import { EventBus } from '@/platform/events/EventBus';

interface EngineContextValue {
  kernel: EngineKernel | null;
  isReady: boolean;
  isSpinning: boolean;
  currentGame: string | null;
}

const EngineContext = createContext<EngineContextValue>({
  kernel: null,
  isReady: false,
  isSpinning: false,
  currentGame: null,
});

interface EngineProviderProps {
  children: ReactNode;
  gameId?: string;
}

export const EngineProvider: React.FC<EngineProviderProps> = ({ children, gameId }) => {
  const [kernel, setKernel] = useState<EngineKernel | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentGame, setCurrentGame] = useState<string | null>(null);

  useEffect(() => {
    const eventBus = EventBus.getInstance();

    const handleReady = () => setIsReady(true);
    const handleSpinStart = () => setIsSpinning(true);
    const handleSpinComplete = () => setIsSpinning(false);

    eventBus.on('engine:ready', handleReady);
    eventBus.on('game:spin:start', handleSpinStart);
    eventBus.on('game:spin:complete', handleSpinComplete);

    if (gameId) {
      setCurrentGame(gameId);
    }

    return () => {
      eventBus.off('engine:ready');
      eventBus.off('game:spin:start');
      eventBus.off('game:spin:complete');
    };
  }, [gameId]);

  return (
    <EngineContext.Provider value={{ kernel, isReady, isSpinning, currentGame }}>
      {children}
    </EngineContext.Provider>
  );
};

export function useEngineContext() {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error('useEngineContext must be used within an EngineProvider');
  }
  return context;
}

export default EngineProvider;
