import React, { useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameShell } from '@/ui/shell/GameShell';
import { SessionTokenManager } from '@/platform/networking/SessionTokenManager';
import { EngineProvider } from '@/ui/providers/EngineProvider';

export const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (gameId) {
      const name = gameId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      document.title = `${name} | SlotEngine`;
    }
  }, [gameId]);

  const handleExit = useCallback(() => {
    // If opened in a new tab, close the tab. Otherwise, go home.
    if (window.opener) {
      window.close();
    } else {
      navigate('/');
    }
  }, [navigate]);

  if (!gameId) return <div>Invalid Game ID</div>;

  return (
    <div className="w-screen h-screen overflow-hidden bg-background">
      <EngineProvider gameId={gameId}>
        <GameShell 
          gameId={gameId}
          onExit={handleExit}
        />
      </EngineProvider>
    </div>
  );
};

export default GamePage;