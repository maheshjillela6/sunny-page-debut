/**
 * FeatureOverlay - Feature trigger announcement overlay
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface FeatureOverlayProps {
  isVisible: boolean;
  featureName: string;
  description?: string;
  onDismiss?: () => void;
}

export const FeatureOverlay: React.FC<FeatureOverlayProps> = ({
  isVisible,
  featureName,
  description,
  onDismiss,
}) => {
  const { t } = useLocale();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.4 }}
            className="text-center"
          >
            <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {featureName}
            </h2>
            {description && (
              <p className="text-xl text-muted-foreground mt-4">{description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-8 animate-pulse">
              {t('ui.tap_to_continue')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FeatureOverlay;
