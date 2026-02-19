/**
 * PixiHudBridge - React component that mounts/manages the PixiJS HUD layer.
 * It bridges React props (balance, bet, spinning state) into the Pixi world.
 */

import React, { useEffect, useRef } from 'react';
import { PixiRuntime } from '../../runtime/pixi/core/PixiRuntime';
import { StageLayer } from '../../runtime/pixi/stage/StageRoot';
import { PixiHudLayer } from '../../presentation/hud/PixiHudLayer';
import type { ResolvedHudLayout } from '../hud/types/HudLayoutTypes';

interface PixiHudBridgeProps {
  layout: ResolvedHudLayout;
  balance: number;
  bet: number;
  lastWin: number;
  isSpinning: boolean;
  multiplier?: number;
  jackpotAmount?: number;
  buyBonusCost?: number;
  onSpin: () => void;
  onExit?: () => void;
  onBuyBonus?: () => void;
  onAutoplayToggle?: () => void;
  onTurboToggle?: () => void;
}

export const PixiHudBridge: React.FC<PixiHudBridgeProps> = ({
  layout,
  balance,
  bet,
  lastWin,
  isSpinning,
  multiplier = 1,
  jackpotAmount = 50000,
  buyBonusCost = 100,
  onSpin,
  onExit,
  onBuyBonus,
  onAutoplayToggle,
  onTurboToggle,
}) => {
  const hudRef = useRef<PixiHudLayer | null>(null);
  const mountedRef = useRef(false);

  // Mount Pixi HUD layer on first render
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    try {
      const runtime = PixiRuntime.getInstance();
      const world = runtime.getWorldContainer();

      // Find or create the HUD stage layer
      // The StageRoot should already have a HUD layer at z-index 950
      // We add the PixiHudLayer directly to the world container at a high z-index
      const hud = new PixiHudLayer(layout, { balance, bet, lastWin, isSpinning, multiplier, jackpotAmount, buyBonusCost });
      hud.zIndex = StageLayer.HUD;
      hud.setCallbacks({ onSpin, onExit, onBuyBonus, onAutoplayToggle, onTurboToggle });

      world.addChild(hud);
      hudRef.current = hud;

      console.log('[PixiHudBridge] Pixi HUD mounted');
    } catch (err) {
      console.error('[PixiHudBridge] Failed to mount Pixi HUD:', err);
    }

    return () => {
      if (hudRef.current) {
        hudRef.current.destroy();
        hudRef.current = null;
      }
      mountedRef.current = false;
    };
  }, []);

  // Sync React props → Pixi state
  useEffect(() => {
    hudRef.current?.updateState({ balance, bet, lastWin, isSpinning, multiplier, jackpotAmount, buyBonusCost });
  }, [balance, bet, lastWin, isSpinning, multiplier, jackpotAmount, buyBonusCost]);

  // Update callbacks when they change
  useEffect(() => {
    hudRef.current?.setCallbacks({ onSpin, onExit, onBuyBonus, onAutoplayToggle, onTurboToggle });
  }, [onSpin, onExit, onBuyBonus, onAutoplayToggle, onTurboToggle]);

  // Update layout when it changes (e.g. breakpoint change)
  useEffect(() => {
    hudRef.current?.updateLayout(layout);
    hudRef.current?.setCallbacks({ onSpin, onExit, onBuyBonus, onAutoplayToggle, onTurboToggle });
  }, [layout]);

  // This component renders nothing — the HUD lives in Pixi
  return null;
};

export default PixiHudBridge;
