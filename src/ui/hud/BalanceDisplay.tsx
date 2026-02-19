/**
 * BalanceDisplay - Shows player balance
 */

import React from 'react';
import { Wallet } from 'lucide-react';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface BalanceDisplayProps {
  balance: number;
  currency?: string;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
  currency = '$',
}) => {
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-border">
      <Wallet className="w-4 h-4 text-primary" />
      <span className="text-sm text-muted-foreground">{t('hud.balance')}</span>
      <span className="font-bold text-foreground">
        {currency}{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
};

export default BalanceDisplay;
