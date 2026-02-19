/**
 * SpinButton - Main spin action button
 */

import React from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SpinButtonProps {
  onSpin: () => void;
  disabled?: boolean;
  isSpinning?: boolean;
}

export const SpinButton: React.FC<SpinButtonProps> = ({
  onSpin,
  disabled = false,
  isSpinning = false,
}) => {
  return (
    <Button
      size="lg"
      className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
      onClick={onSpin}
      disabled={disabled || isSpinning}
    >
      {isSpinning ? (
        <Loader2 className="w-8 h-8 animate-spin" />
      ) : (
        <Play className="w-8 h-8 ml-1" />
      )}
    </Button>
  );
};

export default SpinButton;
