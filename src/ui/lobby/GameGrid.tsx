/**
 * GameGrid - Grid layout for game cards
 */

import React from 'react';
import { GameCard, GameInfo } from './GameCard';

interface GameGridProps {
  games: GameInfo[];
  onSelectGame: (gameId: string) => void;
}

export const GameGrid: React.FC<GameGridProps> = ({ games, onSelectGame }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {games.map((game) => (
        <GameCard key={game.id} game={game} onSelect={onSelectGame} />
      ))}
    </div>
  );
};

export default GameGrid;
