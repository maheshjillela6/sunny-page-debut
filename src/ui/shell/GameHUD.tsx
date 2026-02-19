/**
 * GameHUD - Heads-up display overlay for game controls
 */

import React from 'react';
import { Button } from '@/components/ui/button';

interface GameHUDProps {
  gameName: string;
  currentFeature: string;
  currentStrategy: string;
  balance: number;
  bet: number;
  lastWin: number;
  isSpinning: boolean;
  onSpin: () => void;
  onExit?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  gameName,
  currentFeature,
  currentStrategy,
  balance,
  bet,
  lastWin,
  isSpinning,
  onSpin,
  onExit,
}) => {
  const formatStrategyName = (id: string): string => {
    return id
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatFeatureName = (feature: string): string => {
    if (feature === 'baseGame') return 'Base Game';
    return feature
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <>
      {/* Top Bar - Game Info & Current Strategy */}
      <div className="absolute top-4 left-0 right-0 flex justify-between items-start px-4 pointer-events-none z-10">
        {/* Game Title & Exit */}
        <div className="flex items-center gap-2">
          {onExit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onExit}
              className="pointer-events-auto h-10 w-10 bg-card/90 backdrop-blur-sm border border-border"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Button>
          )}
          <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border pointer-events-auto">
            <div className="text-lg font-bold text-primary">
              {gameName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            <div className="text-xs text-muted-foreground">
              Feature: {formatFeatureName(currentFeature)}
            </div>
          </div>
        </div>

        {/* Current Spin Strategy (from config) */}
        <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border pointer-events-auto">
          <div className="text-xs text-muted-foreground">Spin Style</div>
          <div className="text-sm font-medium text-accent">
            {formatStrategyName(currentStrategy)}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-10">
        <div className="flex items-center justify-between p-4 pointer-events-auto">
          {/* Balance Display */}
          <div className="flex items-center gap-4 bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border">
            <div className="text-sm text-muted-foreground">Balance</div>
            <div className="text-xl font-bold text-primary">${balance.toFixed(2)}</div>
          </div>

          {/* Win Display */}
          <div className={`flex items-center gap-4 bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border ${lastWin > 0 ? 'border-accent shadow-lg shadow-accent/20' : 'border-border'} transition-all duration-500`}>
            <div className="text-sm text-muted-foreground">Win</div>
            <div className={`text-xl font-bold transition-all duration-300 ${lastWin > 0 ? 'text-accent scale-110' : 'text-foreground'}`}>
              ${lastWin.toFixed(2)}
            </div>
          </div>

          {/* Bet Display */}
          <div className="flex items-center gap-4 bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border">
            <div className="text-sm text-muted-foreground">Bet</div>
            <div className="text-xl font-bold text-foreground">${bet.toFixed(2)}</div>
          </div>
        </div>

        {/* Spin Button */}
        <div className="flex justify-center pb-6 pointer-events-auto">
          <Button
            onClick={onSpin}
            disabled={isSpinning || balance < bet}
            size="lg"
            className="w-28 h-28 rounded-full text-lg font-bold bg-primary hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
          >
            {isSpinning ? (
              <div className="animate-spin w-8 h-8 border-4 border-primary-foreground border-t-transparent rounded-full" />
            ) : (
              'SPIN'
            )}
          </Button>
        </div>
      </div>
    </>
  );
};

export default GameHUD;
