/**
 * HelpModal - Game help and paytable modal
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpCircle, Grid3X3, Coins, Star } from 'lucide-react';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface Symbol {
  id: string;
  name: string;
  color: string;
  payouts: number[];
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameName: string;
  symbols: Symbol[];
  paylineCount: number;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  gameName,
  symbols,
  paylineCount,
}) => {
  const { t } = useLocale();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            {t('modal.help_title', { game: gameName })}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="paytable">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="paytable">
              <Coins className="w-4 h-4 mr-2" />
              {t('modal.paytable')}
            </TabsTrigger>
            <TabsTrigger value="paylines">
              <Grid3X3 className="w-4 h-4 mr-2" />
              {t('modal.paylines')}
            </TabsTrigger>
            <TabsTrigger value="features">
              <Star className="w-4 h-4 mr-2" />
              {t('modal.features')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paytable">
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {symbols.map((symbol) => (
                  <div
                    key={symbol.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: symbol.color }}
                      >
                        {symbol.id}
                      </div>
                      <span>{symbol.name}</span>
                    </div>
                    <div className="flex gap-2 text-sm">
                      {symbol.payouts.map((payout, idx) => (
                        <span key={idx} className="px-2 py-1 bg-background rounded">
                          {idx + 3}x: {payout}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="paylines">
            <div className="text-center py-8">
              <p className="text-4xl font-bold text-primary">{paylineCount}</p>
              <p className="text-muted-foreground mt-2">{t('modal.active_paylines')}</p>
              <p className="text-sm text-muted-foreground mt-4">
                {t('modal.paylines_desc')}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="features">
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium">{t('modal.wild_symbol')}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('modal.wild_desc')}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium">{t('feature.freespins')}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('modal.freespins_desc')}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium">{t('feature.bonus')}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('modal.bonus_desc')}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default HelpModal;
