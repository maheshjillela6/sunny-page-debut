/**
 * useWallet - Hook to manage wallet state
 */

import { useState, useEffect, useCallback } from 'react';
import { EventBus } from '@/platform/events/EventBus';

interface WalletState {
  balance: number;
  bet: number;
  lastWin: number;
  totalWagered: number;
  totalWon: number;
}

const BET_STEPS = [0.10, 0.25, 0.50, 1.00, 2.00, 5.00, 10.00, 25.00, 50.00, 100.00];

export function useWallet(initialBalance: number = 1000) {
  const [wallet, setWallet] = useState<WalletState>({
    balance: initialBalance,
    bet: 1.00,
    lastWin: 0,
    totalWagered: 0,
    totalWon: 0,
  });

  useEffect(() => {
    const eventBus = EventBus.getInstance();

    const handleSpinStart = () => {
      setWallet((prev) => ({
        ...prev,
        balance: prev.balance - prev.bet,
        totalWagered: prev.totalWagered + prev.bet,
        lastWin: 0,
      }));
    };

    const handleWin = (payload: { amount: number }) => {
      setWallet((prev) => ({
        ...prev,
        balance: prev.balance + payload.amount,
        lastWin: payload.amount,
        totalWon: prev.totalWon + payload.amount,
      }));
    };

    eventBus.on('game:spin:start', handleSpinStart);
    eventBus.on('game:win', handleWin);

    return () => {
      eventBus.off('game:spin:start');
      eventBus.off('game:win');
    };
  }, []);

  const setBet = useCallback((bet: number) => {
    setWallet((prev) => ({ ...prev, bet }));
  }, []);

  const addBalance = useCallback((amount: number) => {
    setWallet((prev) => ({ ...prev, balance: prev.balance + amount }));
  }, []);

  const canSpin = wallet.balance >= wallet.bet;

  return {
    ...wallet,
    betSteps: BET_STEPS,
    minBet: BET_STEPS[0],
    maxBet: BET_STEPS[BET_STEPS.length - 1],
    canSpin,
    setBet,
    addBalance,
  };
}

export default useWallet;
