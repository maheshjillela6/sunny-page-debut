/**
 * NotificationToast - In-game notification toast
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, AlertTriangle, CheckCircle } from 'lucide-react';

interface NotificationToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onDismiss?: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const typeConfig = {
    info: { icon: Info, bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500', iconColor: 'text-blue-400' },
    success: { icon: CheckCircle, bgColor: 'bg-green-500/20', borderColor: 'border-green-500', iconColor: 'text-green-400' },
    warning: { icon: AlertTriangle, bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500', iconColor: 'text-yellow-400' },
    error: { icon: X, bgColor: 'bg-red-500/20', borderColor: 'border-red-500', iconColor: 'text-red-400' },
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          className={`fixed top-4 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border ${config.bgColor} ${config.borderColor} backdrop-blur-sm`}
        >
          <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
          <span className="text-foreground">{message}</span>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationToast;
