/**
 * LobbyScreen - Main lobby UI with game selection and network configuration
 * Lists games from content folder, uses environment-based network config
 */

import React, { useEffect, useState, useMemo } from 'react';
import { GameGrid } from './GameGrid';
import { NetworkSettingsPanel } from '../settings/NetworkSettingsPanel';
import { getMergedEnvConfig } from '@/config/env.config';
import { NetworkManager } from '@/platform/networking/NetworkManager';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useLocale } from '@/ui/providers/LocaleProvider';
import { LanguageSelector } from '@/ui/controls/LanguageSelector';

interface GameInfo {
  id: string;
  name: string;
  description: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
  };
}

// Game IDs available in the content folder
const CONTENT_GAME_IDS = ['neon-nights', 'egyptian-adventure', 'dragon-fortune'] as const;

const GAME_THEMES: Record<string, GameInfo['theme']> = {
  'neon-nights': { primaryColor: '#8b5cf6', accentColor: '#06b6d4', backgroundColor: '#0f0f23' },
  'egyptian-adventure': { primaryColor: '#d4a017', accentColor: '#1e3a5f', backgroundColor: '#0d1b2a' },
  'dragon-fortune': { primaryColor: '#dc2626', accentColor: '#f59e0b', backgroundColor: '#1a0a0a' },
};

const gameIdToKey = (id: string) => id.replace(/-/g, '_');

interface LobbyScreenProps {
  onGameSelect?: (gameId: string) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onGameSelect }) => {
  const { t, isLoaded } = useLocale();
  const [isConnected, setIsConnected] = useState(false);
  const [networkMode, setNetworkMode] = useState<string>('mock');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const games: GameInfo[] = useMemo(() => {
    if (!isLoaded) return [];
    return CONTENT_GAME_IDS.map((id) => {
      const key = gameIdToKey(id);
      return {
        id,
        name: t(`lobby.game.${key}.name`),
        description: t(`lobby.game.${key}.description`),
        theme: GAME_THEMES[id],
      };
    });
  }, [t, isLoaded]);

  useEffect(() => {
    const initNetwork = async () => {
      const networkManager = NetworkManager.getInstance();
      const envConfig = getMergedEnvConfig();
      
      try {
        await networkManager.initialize({ 
          defaultAdapter: envConfig.network.adapterType,
          useEnvConfig: true,
        });
        await networkManager.connect();
        setIsConnected(networkManager.isConnected());
        setNetworkMode(envConfig.network.adapterType);
      } catch (error) {
        console.error('[LobbyScreen] Network init failed:', error);
        setIsConnected(false);
      }
    };

    initNetwork();
  }, []);

  const handleGameSelect = (gameId: string) => {
    console.log('[LobbyScreen] Game selected:', gameId);
  };

  const handleNetworkSettingsChange = async () => {
    const envConfig = getMergedEnvConfig();
    setNetworkMode(envConfig.network.adapterType);
    
    const networkManager = NetworkManager.getInstance();
    setIsConnected(networkManager.isConnected());
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('lobby.title')}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('lobby.subtitle')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <LanguageSelector />
            
            <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Settings className="w-5 h-5" />
                  <span className={`absolute top-0 right-0 w-2 h-2 rounded-full ${isConnected ? 'bg-primary' : 'bg-muted'}`} />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[500px] sm:w-[600px]">
                <div className="mt-6">
                  <NetworkSettingsPanel 
                    onSettingsChange={handleNetworkSettingsChange}
                    isConnected={isConnected}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {networkMode !== 'mock' && (
          <div className={`mb-6 p-3 rounded-lg border ${isConnected ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-sm">
                {isConnected 
                  ? t('ui.connected_to', { server: networkMode.toUpperCase() })
                  : t('ui.connecting_to', { server: networkMode.toUpperCase() })
                }
              </span>
            </div>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{t('lobby.available_games')}</h2>
            <span className="text-sm text-muted-foreground">
              {t('lobby.games_count', { count: games.length })}
            </span>
          </div>
          <GameGrid games={games} onSelectGame={handleGameSelect} />
        </section>
      </main>
    </div>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon }) => (
  <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
    <div className="text-2xl mb-2">{icon}</div>
    <h3 className="font-medium text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

export default LobbyScreen;
