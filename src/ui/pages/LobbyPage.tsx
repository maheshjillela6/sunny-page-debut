import React, { useEffect, useState } from 'react';
import { LobbyScreen } from '@/ui/lobby/LobbyScreen';
import { SessionTokenManager } from '@/platform/networking/SessionTokenManager';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/ui/providers/LocaleProvider';

export const LobbyPage: React.FC = () => {
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [existingGameId, setExistingGameId] = useState<string | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    const tokenManager = SessionTokenManager.getInstance();
    const stored = tokenManager.getStoredSession();

    if (stored && tokenManager.isSessionValid()) {
      setHasExistingSession(true);
      setExistingGameId(stored.gameId);
    }
  }, []);

  const handleContinueSession = () => {
    if (existingGameId) {
      window.open(`${window.location.origin}/game/${existingGameId}`, '_blank');
    }
  };

  const handleClearSession = () => {
    SessionTokenManager.getInstance().clearAll();
    setHasExistingSession(false);
    setExistingGameId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {hasExistingSession && (
        <div className="bg-primary/10 border-b border-primary/20 p-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <p className="text-primary font-medium">{t('ui.active_session')}</p>
              <p className="text-sm text-muted-foreground">{t('ui.resume')} {existingGameId?.replace(/-/g, ' ')}</p>
            </div>
            <div className="flex gap-3">
              <Button size="sm" onClick={handleContinueSession}>{t('ui.resume')}</Button>
              <Button size="sm" variant="outline" onClick={handleClearSession}>{t('ui.clear')}</Button>
            </div>
          </div>
        </div>
      )}
      <LobbyScreen />
    </div>
  );
};

export default LobbyPage;
