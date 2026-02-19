/**
 * Router - Application routing configuration with session persistence
 * Supports opening games in new tabs and session restoration on page refresh
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { LobbyPage } from '@/ui/pages/LobbyPage';
import { GamePage } from '@/ui/pages/GamePage';
import { DebugPage } from '@/ui/pages/DebugPage';
import NotFound from '@/pages/NotFound';
import { SessionTokenManager } from '@/platform/networking/SessionTokenManager';

/**
 * Game page wrapper that validates session on refresh
 */
const GamePageWithSession: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    if (!gameId) {
      setSessionChecked(true);
      setSessionValid(false);
      return;
    }

    const tokenManager = SessionTokenManager.getInstance();
    const stored = tokenManager.getStoredSession();

    // Check if we have a valid session for this game
    if (stored && stored.gameId === gameId && tokenManager.isSessionValid()) {
      console.log('[Router] Valid session found for game:', gameId);
      setSessionValid(true);
    } else if (stored && stored.gameId !== gameId) {
      // Different game - clear old session and start fresh
      console.log('[Router] Starting new game session for:', gameId);
      tokenManager.clearAll();
      setSessionValid(true); // Allow new game to start
    } else {
      // No session or expired - allow new game to start
      console.log('[Router] No existing session, starting fresh for:', gameId);
      setSessionValid(true);
    }

    setSessionChecked(true);
  }, [gameId]);

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <div className="text-muted-foreground">Restoring session...</div>
        </div>
      </div>
    );
  }

  if (!sessionValid && !gameId) {
    return <Navigate to="/" replace />;
  }

  return <GamePage />;
};

export const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/game/:gameId" element={<GamePageWithSession />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
