/**
 * AutoPlayButton - Toggle autoplay mode
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface AutoPlayButtonProps {
  isActive: boolean;
  onToggle: () => void;
  spinsRemaining?: number;
}

export const AutoPlayButton: React.FC<AutoPlayButtonProps> = ({
  isActive,
  onToggle,
  spinsRemaining,
}) => {
  const { t } = useLocale();

  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
      className="relative"
    >
      <RotateCcw className={`w-4 h-4 mr-2 ${isActive ? 'animate-spin' : ''}`} />
      {isActive && spinsRemaining !== undefined ? (
        <span>{t('ui.autoplay_remaining', { count: spinsRemaining })}</span>
      ) : (
        <span>{t('ui.auto')}</span>
      )}
    </Button>
  );
};

export default AutoPlayButton;
