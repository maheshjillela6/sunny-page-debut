/**
 * UnfinishedSessionModal - Modal for resuming unfinished game sessions
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface UnfinishedSessionModalProps {
  isReconnecting: boolean;
  onResume: () => void;
  onCancel: () => void;
}

export const UnfinishedSessionModal: React.FC<UnfinishedSessionModalProps> = ({
  isReconnecting,
  onResume,
  onCancel,
}) => {
  const { t } = useLocale();

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md text-center shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-primary" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        <h2 className="text-xl font-bold text-primary mb-2">
          {t('session.unfinished_title')}
        </h2>
        
        <p className="text-muted-foreground mb-6">
          {t('session.unfinished_desc')}
        </p>
        
        <div className="flex gap-4 justify-center">
          <Button
            onClick={onResume}
            disabled={isReconnecting}
            className="bg-primary hover:bg-primary/90 min-w-[100px]"
          >
            {isReconnecting ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                {t('session.resuming')}
              </div>
            ) : (
              t('ui.resume')
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isReconnecting}
            className="min-w-[100px]"
          >
            {t('session.start_fresh')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnfinishedSessionModal;
