/**
 * LoadingScreen - Displays game loading progress
 */

import React from 'react';
import { LoadingProgress, LoadingPhase } from '../../engine/core/GameLoader';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface LoadingScreenProps {
  progress: LoadingProgress;
  gameName: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress,
  gameName,
}) => {
  const { t } = useLocale();

  const getPhaseLabel = (phase: LoadingPhase): string => {
    switch (phase) {
      case LoadingPhase.CHECKING_SESSION:
        return t('loading.checking_session');
      case LoadingPhase.LAUNCHING_GAME:
        return t('loading.connecting');
      case LoadingPhase.LOADING_CONFIG:
        return t('loading.loading_config');
      case LoadingPhase.LOADING_ASSETS:
        return t('loading.loading_assets');
      case LoadingPhase.CREATING_STAGE:
        return t('loading.creating_stage');
      case LoadingPhase.READY:
        return t('loading.ready');
      case LoadingPhase.ERROR:
        return t('loading.error');
      default:
        return t('loading.initializing');
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
      <div className="flex flex-col items-center gap-6 max-w-md w-full px-8">
        {/* Game Title */}
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {gameName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </h1>

        {/* Loading Animation */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-primary/30 rounded-full" />
          <div 
            className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin"
            style={{ animationDuration: '1s' }}
          />
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 ease-out"
              style={{ width: `${progress.totalProgress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-muted-foreground">
              {getPhaseLabel(progress.phase)}
            </span>
            <span className="text-primary font-medium">
              {Math.round(progress.totalProgress)}%
            </span>
          </div>
        </div>

        {/* Status Message */}
        <p className="text-sm text-muted-foreground text-center">
          {progress.message}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
