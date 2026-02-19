/**
 * WalletModal - Wallet management modal
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  currency?: string;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  balance,
  currency = '$',
}) => {
  const { t } = useLocale();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            {t('modal.wallet')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="text-center py-6 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{t('modal.current_balance')}</p>
            <p className="text-4xl font-bold mt-2">
              {currency}{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4" />
              {t('modal.deposit')}
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" />
              {t('modal.withdraw')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletModal;
