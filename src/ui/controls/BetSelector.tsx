/**
 * BetSelector - Bet amount selection component
 */

import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BetSelectorProps {
  bet: number;
  minBet: number;
  maxBet: number;
  betSteps: number[];
  onBetChange: (bet: number) => void;
}

export const BetSelector: React.FC<BetSelectorProps> = ({
  bet,
  minBet,
  maxBet,
  betSteps,
  onBetChange,
}) => {
  const currentIndex = betSteps.indexOf(bet);

  const handleIncrease = () => {
    if (currentIndex < betSteps.length - 1) {
      onBetChange(betSteps[currentIndex + 1]);
    }
  };

  const handleDecrease = () => {
    if (currentIndex > 0) {
      onBetChange(betSteps[currentIndex - 1]);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleDecrease}
        disabled={bet <= minBet}
      >
        <ChevronDown className="w-4 h-4" />
      </Button>
      <div className="w-20 text-center font-bold">
        ${bet.toFixed(2)}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleIncrease}
        disabled={bet >= maxBet}
      >
        <ChevronUp className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default BetSelector;
