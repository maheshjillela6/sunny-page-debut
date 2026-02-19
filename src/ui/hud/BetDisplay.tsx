/**
 * BetDisplay - Shows current bet amount
 */

import React from 'react';
import { Coins } from 'lucide-react';

interface BetDisplayProps {
  bet: number;
  currency?: string;
}

export const BetDisplay: React.FC<BetDisplayProps> = ({ bet, currency = '$' }) => {
  return (
    <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-border">
      <Coins className="w-4 h-4 text-amber-500" />
      <span className="text-sm text-muted-foreground">Bet</span>
      <span className="font-bold text-foreground">
        {currency}{bet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
};

export default BetDisplay;
