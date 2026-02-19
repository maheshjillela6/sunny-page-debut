/**
 * TurboToggle - Toggle turbo spin mode
 */

import React from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface TurboToggleProps {
  isActive: boolean;
  onToggle: () => void;
}

export const TurboToggle: React.FC<TurboToggleProps> = ({ isActive, onToggle }) => {
  const { t } = useLocale();

  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
    >
      <Zap className={`w-4 h-4 mr-2 ${isActive ? 'text-yellow-400' : ''}`} />
      {t('ui.turbo')}
    </Button>
  );
};

export default TurboToggle;
