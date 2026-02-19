/**
 * BigWinOverlay - Full-screen big win celebration
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '@/ui/providers/LocaleProvider';

interface BigWinOverlayProps {
  amount: number;
  type: 'big' | 'mega' | 'epic';
  currency?: string;
  onComplete?: () => void;
}

export const BigWinOverlay: React.FC<BigWinOverlayProps> = ({
  amount,
  type,
  currency = '$',
  onComplete,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [displayAmount, setDisplayAmount] = useState(0);
  const { t } = useLocale();

  const typeConfig = {
    big: { labelKey: 'win.big_upper' as const, color: 'from-yellow-400 to-orange-500', duration: 3000 },
    mega: { labelKey: 'win.mega_upper' as const, color: 'from-purple-400 to-pink-500', duration: 4000 },
    epic: { labelKey: 'win.epic_upper' as const, color: 'from-cyan-400 to-blue-500', duration: 5000 },
  };

  const config = typeConfig[type];

  useEffect(() => {
    const duration = config.duration;
    const steps = 60;
    const increment = amount / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += increment;
      if (current >= amount) {
        setDisplayAmount(amount);
        clearInterval(interval);
      } else {
        setDisplayAmount(current);
      }
    }, duration / steps);

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration + 500);

    return () => {
      clearInterval(interval);
      clearTimeout(hideTimer);
    };
  }, [amount, config.duration, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        >
          <div className="text-center">
            <motion.h1
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className={`text-6xl md:text-8xl font-black bg-gradient-to-r ${config.color} bg-clip-text text-transparent drop-shadow-2xl`}
            >
              {t(config.labelKey)}
            </motion.h1>
            <motion.p
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-bold text-white mt-4"
            >
              {currency}{displayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BigWinOverlay;
