/**
 * MultiplierDisplay - Shows current multiplier
 */

import React from 'react';
import { Zap } from 'lucide-react';

interface MultiplierDisplayProps {
  multiplier: number;
}

export const MultiplierDisplay: React.FC<MultiplierDisplayProps> = ({ multiplier }) => {
  const isActive = multiplier > 1;

  return (
    <div
      className={`flex items-center gap-2 bg-card/80 backdrop-blur-sm rounded-lg px-4 py-2 border transition-all duration-300 ${
        isActive ? 'border-primary bg-primary/10' : 'border-border'
      }`}
    >
      <Zap className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
      <span className="text-sm text-muted-foreground">Multi</span>
      <span className={`font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>
        x{multiplier}
      </span>
    </div>
  );
};

export default MultiplierDisplay;
