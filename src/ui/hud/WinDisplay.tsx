/**
 * WinDisplay - Shows last win amount
 */

import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

interface WinDisplayProps {
  win: number;
  currency?: string;
}

export const WinDisplay: React.FC<WinDisplayProps> = ({ win, currency = '$' }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (win > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [win]);

  return (
    <div
      className={`flex items-center gap-2 bg-card/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-border transition-all duration-300 ${
        isAnimating ? 'scale-110 border-primary shadow-lg' : ''
      }`}
    >
      <Trophy className={`w-4 h-4 ${win > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
      <span className="text-sm text-muted-foreground">Win</span>
      <span className={`font-bold ${win > 0 ? 'text-yellow-500' : 'text-foreground'}`}>
        {currency}{win.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
};

export default WinDisplay;
