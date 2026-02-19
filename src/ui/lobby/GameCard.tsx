/**
 * GameCard - Individual game card component
 * Opens games in new browser tabs with game slug URL
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, ExternalLink } from 'lucide-react';
import { useLocale } from '@/ui/providers/LocaleProvider';

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
  };
}

interface GameCardProps {
  game: GameInfo;
  onSelect?: (gameId: string) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onSelect }) => {
  const { t } = useLocale();

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const gameUrl = `${window.location.origin}/game/${game.id}`;
    window.open(gameUrl, `slot_game_${game.id}`, 'noopener,noreferrer');
    onSelect?.(game.id);
  };

  return (
    <Card
      className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden"
      onClick={handlePlay}
    >
      <div className="h-32 relative" style={{ backgroundColor: game.theme.backgroundColor }}>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{game.name}</CardTitle>
        <CardDescription className="text-sm">{game.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full gap-2"
          style={{ backgroundColor: game.theme.primaryColor }}
        >
          <Play className="w-4 h-4" />
          {t('ui.play_now')}
          <ExternalLink className="w-3 h-3 opacity-70" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default GameCard;
