/**
 * HistoryModal - Game history modal
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, TrendingUp, TrendingDown } from 'lucide-react';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface HistoryEntry {
  id: string;
  timestamp: number;
  bet: number;
  win: number;
  symbols: string[][];
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  currency?: string;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  currency = '$',
}) => {
  const { t } = useLocale();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {t('modal.game_history')}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-80">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('modal.no_history')}
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                    <p className="text-sm">
                      {t('hud.bet')}: {currency}{entry.bet.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.win > entry.bet ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : entry.win < entry.bet ? (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    ) : null}
                    <span
                      className={`font-bold ${
                        entry.win > 0 ? 'text-green-500' : 'text-muted-foreground'
                      }`}
                    >
                      {currency}{entry.win.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default HistoryModal;
