/**
 * ConfigurableGameHUD - Config-driven HUD with 3 layout modes:
 *   1. "icon"   – Lucide icons + code-based UI
 *   2. "image"  – Game-specific images (fallback to icons if images fail)
 *   3. "hybrid" – Both icons and images side-by-side
 *
 * Supports 2 renderer types:
 *   - "react" (default) – HTML/CSS overlay rendered by React
 *   - "pixi"  – Rendered inside the PixiJS canvas using Graphics/Sprites
 *
 * All positions, sizes, visibility, and responsive overrides come from
 * /game-configs/games/{gameId}/hud-layout.json
 */

import React, { useMemo } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useLocale } from '@/ui/providers/LocaleProvider';
import { useAudio }  from '@/ui/hooks/useAudio';
import { Button } from '@/components/ui/button';
import { HudElement } from './HudElement';
import { HudRegion } from './HudRegion';
import { useHudConfig } from '../hooks/useHudConfig';
import { PixiHudBridge } from '../shell/PixiHudBridge';
import type { ResolvedHudElement, ResolvedHudLayout } from './types/HudLayoutTypes';

export interface ConfigurableGameHUDProps {
  gameId: string;
  gameName: string;
  currentFeature: string;
  currentStrategy: string;
  balance: number;
  bet: number;
  lastWin: number;
  multiplier?: number;
  jackpotAmount?: number;
  buyBonusCost?: number;
  isSpinning: boolean;
  autoplayActive?: boolean;
  autoplayRemaining?: number;
  turboActive?: boolean;
  onSpin: () => void;
  onExit?: () => void;
  onAutoplayToggle?: () => void;
  onTurboToggle?: () => void;
  onBetIncrease?: () => void;
  onBetDecrease?: () => void;
  onBuyBonus?: () => void;
}

const formatStrategyName = (id: string, t: (key: string) => string): string =>
  id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const FEATURE_KEYS: Record<string, string> = {
  baseGame: 'feature.base_game',
  freeSpins: 'feature.freespins',
  bonus: 'feature.bonus',
  respins: 'feature.respins',
};

export const ConfigurableGameHUD: React.FC<ConfigurableGameHUDProps> = (props) => {
  const { resolved, loading, layout } = useHudConfig(props.gameId);

  // If config hasn't loaded yet, render nothing
  if (loading || !resolved) return null;

  // Route to Pixi or React renderer based on config
  if (resolved.renderer === 'pixi') {
    return (
      <PixiHudBridge
        layout={resolved}
        balance={props.balance}
        bet={props.bet}
        lastWin={props.lastWin}
        isSpinning={props.isSpinning}
        multiplier={props.multiplier}
        jackpotAmount={props.jackpotAmount}
        buyBonusCost={props.buyBonusCost}
        onSpin={props.onSpin}
        onExit={props.onExit}
        onBuyBonus={props.onBuyBonus}
        onAutoplayToggle={props.onAutoplayToggle}
        onTurboToggle={props.onTurboToggle}
      />
    );
  }

  /**
   * Pattern B — Virtual canvas coordinate system.
   *
   * The outer div covers the full screen (pointer-events: none).
   * The inner div is exactly virtualWidth × virtualHeight in size,
   * translated to offsetX/offsetY and uniformly scaled by `scale`.
   * This matches the PixiRuntime canvas letterbox exactly, so every
   * HUD position defined in virtual pixels is automatically correct
   * on every screen — no per-breakpoint size or position tweaking.
   */
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: layout.offsetY,
          left: layout.offsetX,
          width: layout.virtualWidth,
          height: layout.virtualHeight,
          transform: `scale(${layout.scale})`,
          transformOrigin: 'top left',
        }}
      >
        <HudRenderer layout={resolved} {...props} />
      </div>
    </div>
  );
};

/** Inner renderer – only mounts once config is resolved */
const HudRenderer: React.FC<ConfigurableGameHUDProps & { layout: ResolvedHudLayout }> = (renderProps) => {
  const { t } = useLocale();
  const audio  = useAudio();
  const {
    layout,
    gameName,
    currentFeature,
    currentStrategy,
    balance,
    bet,
    lastWin,
    multiplier = 1,
    jackpotAmount = 50000,
    buyBonusCost = 100,
    isSpinning,
    autoplayActive = false,
    autoplayRemaining,
    turboActive = false,
    onSpin,
    onExit,
    onAutoplayToggle,
    onTurboToggle,
    onBetIncrease,
    onBetDecrease,
    onBuyBonus,
  } = renderProps;
  const { mode, elements, reactRegions: regions } = layout;

  // Group elements by region
  const grouped = useMemo(() => {
    const map: Record<string, ResolvedHudElement[]> = {};
    for (const elem of Object.values(elements)) {
      if (!elem.visible) continue;
      const r = elem.region;
      if (!map[r]) map[r] = [];
      map[r].push(elem);
    }
    // Sort each region by order
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => a.order - b.order);
    }
    return map;
  }, [elements]);

  const currency = '$';

  /** Render the content for a specific element */
  const renderElement = (elem: ResolvedHudElement) => {
    switch (elem.id) {
      case 'exit':
        return (
          <HudElement
            key={elem.id}
            config={elem}
            mode={mode}
            onClick={onExit}
            className="pointer-events-auto bg-card/90 backdrop-blur-sm border border-border"
          />
        );

      case 'gameTitle':
        return (
          <div
            key={elem.id}
            className="pointer-events-auto bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border"
          >
            <div
              className="text-primary"
              style={{ fontSize: elem.style.fontSize, fontWeight: elem.style.fontWeight as any }}
            >
              {gameName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </div>
          </div>
        );

      case 'featureLabel':
        return (
          <div key={elem.id} className="pointer-events-auto">
            <span
              className="text-muted-foreground"
              style={{ fontSize: elem.style.fontSize, opacity: elem.style.opacity }}
            >
              {t('hud.feature')} {FEATURE_KEYS[currentFeature] ? t(FEATURE_KEYS[currentFeature]) : currentFeature}
            </span>
          </div>
        );

      case 'strategyLabel':
        return (
          <div
            key={elem.id}
            className="pointer-events-auto bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border"
          >
            <div className="text-xs text-muted-foreground">{t('hud.spin_style')}</div>
            <div
              className="font-medium text-accent"
              style={{ fontSize: elem.style.fontSize }}
            >
              {formatStrategyName(currentStrategy, t)}
            </div>
          </div>
        );

      case 'menu':
        return (
          <HudElement
            key={elem.id}
            config={elem}
            mode={mode}
            className="pointer-events-auto bg-card/90 backdrop-blur-sm border border-border"
          />
        );

      case 'balance':
        return (
          <HudElement key={elem.id} config={elem} mode={mode} className="pointer-events-auto">
            <span className="text-sm text-muted-foreground" style={{ fontSize: elem.style.labelFontSize }}>
              {t('hud.balance')}
            </span>
            <span className="font-bold text-primary" style={{ fontSize: elem.style.fontSize }}>
              {currency}{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </HudElement>
        );

      case 'bet':
        return (
          <HudElement key={elem.id} config={elem} mode={mode} className="pointer-events-auto">
            <span className="text-sm text-muted-foreground" style={{ fontSize: elem.style.labelFontSize }}>
              {t('hud.bet')}
            </span>
            <span className="font-bold text-foreground" style={{ fontSize: elem.style.fontSize }}>
              {currency}{bet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            {elem.showControls && (
              <div className="flex flex-col ml-1">
                <button
                  onClick={onBetIncrease}
                  className="text-muted-foreground hover:text-foreground text-xs leading-none"
                >
                  ▲
                </button>
                <button
                  onClick={onBetDecrease}
                  className="text-muted-foreground hover:text-foreground text-xs leading-none"
                >
                  ▼
                </button>
              </div>
            )}
          </HudElement>
        );

      case 'win':
        return (
          <HudElement
            key={elem.id}
            config={elem}
            mode={mode}
            active={lastWin > 0}
            className={`pointer-events-auto transition-all duration-500 ${
              lastWin > 0 ? 'border-accent shadow-lg shadow-accent/20' : ''
            }`}
          >
            <span className="text-sm text-muted-foreground" style={{ fontSize: elem.style.labelFontSize }}>
              {t('hud.win')}
            </span>
            <span
              className={`font-bold transition-all duration-300 ${
                lastWin > 0 ? 'text-accent scale-110' : 'text-foreground'
              }`}
              style={{ fontSize: elem.style.fontSize }}
            >
              {currency}{lastWin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </HudElement>
        );

      case 'spinButton':
        return (
          <div key={elem.id} className="pointer-events-auto">
            <SpinButtonElement
              config={elem}
              mode={mode}
              isSpinning={isSpinning}
              disabled={isSpinning || balance < bet}
              onClick={onSpin}
            />
          </div>
        );

      case 'autoplay':
        return (
          <HudElement
            key={elem.id}
            config={elem}
            mode={mode}
            onClick={onAutoplayToggle}
            active={autoplayActive}
            className="pointer-events-auto"
          >
            <span style={{ fontSize: elem.style.fontSize }}>
              {autoplayActive && autoplayRemaining !== undefined
                ? t('ui.autoplay_remaining', { count: autoplayRemaining })
                : t('ui.auto')}
            </span>
          </HudElement>
        );

      case 'turbo':
        return (
          <HudElement
            key={elem.id}
            config={elem}
            mode={mode}
            onClick={onTurboToggle}
            active={turboActive}
            className="pointer-events-auto"
          >
            <span style={{ fontSize: elem.style.fontSize }}>{t('ui.turbo')}</span>
          </HudElement>
        );

      case 'multiplier':
        return (
          <HudElement
            key={elem.id}
            config={elem}
            mode={mode}
            active={multiplier > 1}
            className="pointer-events-auto"
          >
            <span className="text-sm text-muted-foreground">{t('hud.multiplier')}</span>
            <span className={`font-bold ${multiplier > 1 ? 'text-primary' : 'text-foreground'}`}>
              x{multiplier}
            </span>
          </HudElement>
        );

      case 'jackpotMeter':
        return (
          <HudElement
            key={elem.id}
            config={elem}
            mode={mode}
            active
            className="pointer-events-auto"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground" style={{ fontSize: elem.style.labelFontSize }}>
                {t('hud.jackpot')}
              </span>
              <span
                className="font-bold text-accent"
                style={{ fontSize: elem.style.fontSize }}
              >
                {currency}{jackpotAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          </HudElement>
        );

      case 'buyBonus':
        return (
          <HudElement
            key={elem.id}
            config={elem}
            mode={mode}
            onClick={onBuyBonus}
            disabled={isSpinning || balance < buyBonusCost}
            className="pointer-events-auto"
          >
            <div className="flex flex-col items-center">
              <span className="font-bold" style={{ fontSize: elem.style.fontSize }}>
                {t('hud.buy_bonus')}
              </span>
              <span className="text-xs text-muted-foreground">
                {currency}{buyBonusCost.toFixed(2)}
              </span>
            </div>
          </HudElement>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* ── Mute Toggle Button — always visible, top-right ─────────────────── */}
      <div className="absolute top-4 right-4 z-50 pointer-events-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={audio.toggleMute}
          aria-label={audio.isMuted ? t('ui.unmute') : t('ui.mute')}
          title={audio.isMuted ? t('ui.unmute') : t('ui.mute')}
          className="h-10 w-10 bg-card/90 backdrop-blur-sm border border-border hover:bg-card transition-colors"
        >
          {audio.isMuted
            ? <VolumeX className="w-5 h-5 text-muted-foreground" />
            : <Volume2 className="w-5 h-5 text-foreground" />}
        </Button>
      </div>

      {/* ── HUD Regions ─────────────────────────────────────────────────────── */}
      {Object.entries(regions).map(([regionId, regionConfig]) => {
        const regionElements = grouped[regionId];
        if (!regionElements || regionElements.length === 0) return null;

        return (
          <HudRegion key={regionId} config={regionConfig}>
            {regionElements.map(renderElement)}
          </HudRegion>
        );
      })}
    </>
  );
};

/** Spin button with image/icon/hybrid support */
const SpinButtonElement: React.FC<{
  config: ResolvedHudElement;
  mode: string;
  isSpinning: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ config, mode, isSpinning, disabled, onClick }) => {
  const { t } = useLocale();
  const s = config.style;
  const showImage = (mode === 'image' || mode === 'hybrid') && config.resolvedImageSrc;
  const spinImage = isSpinning && config.resolvedSpinningImageSrc
    ? config.resolvedSpinningImageSrc
    : config.resolvedImageSrc;

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
      style={{
        width: s.width ?? 112,
        height: s.height ?? 112,
        borderRadius: s.borderRadius ?? 9999,
        fontSize: s.fontSize,
      }}
    >
      {isSpinning ? (
        <Loader2 className="animate-spin" style={{ width: s.iconSize, height: s.iconSize }} />
      ) : showImage ? (
        <img
          src={spinImage}
          alt="Spin"
          className="object-contain"
          style={{ width: s.iconSize, height: s.iconSize }}
          onError={(e) => {
            // Fallback: hide image, icon will show
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="font-bold" style={{ fontSize: s.fontSize }}>
          {t('hud.spin')}
        </span>
      )}
    </Button>
  );
};

export default ConfigurableGameHUD;
