/**
 * PixiHudLayer - A PixiJS-based HUD that renders all HUD elements using
 * Graphics (fallback) and Sprites (when available).
 *
 * Pattern B alignment:
 *   - All positions are in virtual-canvas space (1280×720 landscape / 720×1280 portrait).
 *   - The worldContainer in PixiRuntime already applies scale + offsetX/Y, so this
 *     layer just uses raw virtual coordinates — no manual scaling needed here.
 *   - On viewport:resize the layer reads the new vw/vh from the event and rebuilds
 *     all region positions.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { EventBus } from '../../platform/events/EventBus';
import { PixiRuntime } from '../../runtime/pixi/core/PixiRuntime';
import { PixiHudElement } from './PixiHudElement';
import type {
  ResolvedHudLayout,
  ResolvedHudElement,
  PixiRegionConfig,
  HudLayoutMode,
} from '../../ui/hud/types/HudLayoutTypes';

interface PixiHudState {
  balance: number;
  bet: number;
  lastWin: number;
  isSpinning: boolean;
  multiplier: number;
  jackpotAmount: number;
  buyBonusCost: number;
}

export class PixiHudLayer extends Container {
  private layout: ResolvedHudLayout;
  private elements: Map<string, PixiHudElement> = new Map();
  private eventBus: EventBus;
  private state: PixiHudState;

  /** Current virtual canvas dimensions — synced from PixiRuntime on every resize */
  private vw: number;
  private vh: number;

  // Callbacks for game actions
  private onSpin: (() => void) | null = null;
  private onExit: (() => void) | null = null;
  private onBuyBonus: (() => void) | null = null;
  private onAutoplayToggle: (() => void) | null = null;
  private onTurboToggle: (() => void) | null = null;

  constructor(layout: ResolvedHudLayout, initialState: Partial<PixiHudState> = {}) {
    super();
    this.label = 'PixiHudLayer';
    this.layout = layout;
    this.eventBus = EventBus.getInstance();

    // ── Pattern B: seed virtual dims from the live PixiRuntime state ──────────
    const rtState = PixiRuntime.getInstance().getState();
    this.vw = rtState.virtualWidth  || 1280;
    this.vh = rtState.virtualHeight || 720;

    this.state = {
      balance:      initialState.balance      ?? 1000,
      bet:          initialState.bet          ?? 10,
      lastWin:      initialState.lastWin      ?? 0,
      isSpinning:   initialState.isSpinning   ?? false,
      multiplier:   initialState.multiplier   ?? 1,
      jackpotAmount: initialState.jackpotAmount ?? 50000,
      buyBonusCost: initialState.buyBonusCost ?? 100,
    };

    this.buildHud();
    this.setupEventListeners();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Set action callbacks */
  public setCallbacks(callbacks: {
    onSpin?: () => void;
    onExit?: () => void;
    onBuyBonus?: () => void;
    onAutoplayToggle?: () => void;
    onTurboToggle?: () => void;
  }): void {
    this.onSpin           = callbacks.onSpin           ?? null;
    this.onExit           = callbacks.onExit           ?? null;
    this.onBuyBonus       = callbacks.onBuyBonus       ?? null;
    this.onAutoplayToggle = callbacks.onAutoplayToggle  ?? null;
    this.onTurboToggle    = callbacks.onTurboToggle     ?? null;

    const spinBtn     = this.elements.get('spinButton');
    const exitBtn     = this.elements.get('exit');
    const buyBonusBtn = this.elements.get('buyBonus');
    const autoplayBtn = this.elements.get('autoplay');
    const turboBtn    = this.elements.get('turbo');

    if (spinBtn     && this.onSpin)           spinBtn.setOnClick(this.onSpin);
    if (exitBtn     && this.onExit)           exitBtn.setOnClick(this.onExit);
    if (buyBonusBtn && this.onBuyBonus)       buyBonusBtn.setOnClick(this.onBuyBonus);
    if (autoplayBtn && this.onAutoplayToggle) autoplayBtn.setOnClick(this.onAutoplayToggle);
    if (turboBtn    && this.onTurboToggle)    turboBtn.setOnClick(this.onTurboToggle);
  }

  /** Update layout with new resolved config (e.g., after breakpoint change) */
  public updateLayout(layout: ResolvedHudLayout): void {
    this.layout = layout;
    this.removeChildren();
    this.elements.clear();
    this.buildHud();

    if (this.onSpin || this.onExit || this.onBuyBonus || this.onAutoplayToggle || this.onTurboToggle) {
      this.setCallbacks({
        onSpin:           this.onSpin           ?? undefined,
        onExit:           this.onExit           ?? undefined,
        onBuyBonus:       this.onBuyBonus       ?? undefined,
        onAutoplayToggle: this.onAutoplayToggle ?? undefined,
        onTurboToggle:    this.onTurboToggle    ?? undefined,
      });
    }
  }

  /** Update state externally (from React bridge) */
  public updateState(state: Partial<PixiHudState>): void {
    Object.assign(this.state, state);
    this.updateValues();
  }

  public override destroy(): void {
    this.elements.clear();
    super.destroy({ children: true });
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  /** Build all HUD elements from the resolved layout */
  private buildHud(): void {
    const { mode, elements, pixiRegions } = this.layout;

    // Group visible elements by region, sorted by order
    const grouped: Record<string, ResolvedHudElement[]> = {};
    for (const elem of Object.values(elements)) {
      if (!elem.visible) continue;
      if (!grouped[elem.region]) grouped[elem.region] = [];
      grouped[elem.region].push(elem);
    }
    for (const arr of Object.values(grouped)) {
      arr.sort((a, b) => a.order - b.order);
    }

    // Build a region container for each region that has elements
    for (const [regionId, regionConfig] of Object.entries(pixiRegions)) {
      const regionElements = grouped[regionId];
      if (!regionElements || regionElements.length === 0) continue;

      const regionContainer = new Container();
      regionContainer.label = `hud-region-${regionId}`;

      // Lay out children linearly (row or column)
      const gap    = regionConfig.gap ?? 8;
      const isRow  = regionConfig.flexDirection !== 'column';
      let   offset = 0;

      for (const elemConfig of regionElements) {
        const hudElem = new PixiHudElement(elemConfig, mode);
        const w = elemConfig.style.width  ?? 80;
        const h = elemConfig.style.height ?? 40;

        if (isRow) {
          hudElem.position.set(offset, 0);
          offset += w + gap;
        } else {
          hudElem.position.set(0, offset);
          offset += h + gap;
        }

        this.applyValueToElement(elemConfig.id, hudElem);
        this.elements.set(elemConfig.id, hudElem);
        regionContainer.addChild(hudElem);
      }

      // Position the region container using pixi config (direct x/y)
      this.applyRegionPosition(regionContainer, regionConfig, isRow, offset - gap);
      this.addChild(regionContainer);
    }
  }

  // ── Region positioning (Pattern B — direct x/y with anchor) ────────────────

  /**
   * Position a region container using direct x/y coordinates from pixi config.
   * anchorX/anchorY (0–1) offset the position relative to the content size.
   */
  private applyRegionPosition(
    container: Container,
    config: PixiRegionConfig,
    isRow: boolean,
    contentSize: number,
  ): void {
    let x = config.x;
    let y = config.y;

    // Apply anchor-based offset (0=left/top, 0.5=center, 1=right/bottom)
    const ax = config.anchorX ?? 0;
    const ay = config.anchorY ?? 0;

    if (ax !== 0) {
      const w = isRow ? contentSize : this.getRegionContentWidth(container);
      x -= w * ax;
    }
    if (ay !== 0) {
      const h = isRow ? this.getRegionContentHeight(container) : contentSize;
      y -= h * ay;
    }

    container.position.set(Math.round(x), Math.round(y));
  }

  /** Approximate total width of children in a container */
  private getRegionContentWidth(container: Container): number {
    let w = 0;
    for (const child of container.children) {
      const bounds = (child as Container).getLocalBounds?.();
      if (bounds) w = Math.max(w, (child as any).x + bounds.width);
    }
    return w || 80;
  }

  /** Approximate total height of children in a container */
  private getRegionContentHeight(container: Container): number {
    let h = 0;
    for (const child of container.children) {
      const bounds = (child as Container).getLocalBounds?.();
      if (bounds) h = Math.max(h, (child as any).y + bounds.height);
    }
    return h || 40;
  }

  // ── Values ──────────────────────────────────────────────────────────────────

  /** Apply current state value to a single element */
  private applyValueToElement(id: string, elem: PixiHudElement): void {
    const fmt = (v: number) =>
      `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    switch (id) {
      case 'balance':
        elem.setValue(fmt(this.state.balance));
        break;
      case 'bet':
        elem.setValue(fmt(this.state.bet));
        break;
      case 'win':
        elem.setValue(fmt(this.state.lastWin));
        elem.setActive(this.state.lastWin > 0);
        break;
      case 'spinButton':
        elem.setDisabled(this.state.isSpinning || this.state.balance < this.state.bet);
        break;
      case 'multiplier':
        elem.setValue(`x${this.state.multiplier}`);
        elem.setActive(this.state.multiplier > 1);
        break;
      case 'jackpotMeter':
        elem.setValue(
          `$${this.state.jackpotAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        );
        elem.setActive(true);
        break;
      case 'buyBonus':
        elem.setValue(`$${this.state.buyBonusCost.toFixed(2)}`);
        elem.setDisabled(
          this.state.isSpinning || this.state.balance < this.state.buyBonusCost
        );
        break;
    }
  }

  /** Refresh all element values from current state */
  private updateValues(): void {
    for (const [id, elem] of this.elements) {
      this.applyValueToElement(id, elem);
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    this.eventBus.on('wallet:balance:update', (payload) => {
      this.state.balance = payload.newBalance;
      this.updateValues();
    });

    this.eventBus.on('game:spin:start', () => {
      this.state.isSpinning = true;
      this.state.lastWin = 0;
      this.updateValues();
    });

    this.eventBus.on('game:spin:complete', (payload) => {
      this.state.isSpinning = false;
      this.state.lastWin = payload.totalWin;
      this.updateValues();
    });

    this.eventBus.on('game:win', (payload) => {
      this.state.lastWin = payload.amount;
      this.updateValues();
    });

    this.eventBus.on('feature:multiplier:change', (payload) => {
      this.state.multiplier = payload.newMultiplier;
      this.updateValues();
    });

    // ── Pattern B: on resize, update vw/vh and reposition all regions ──
    this.eventBus.on('viewport:resize', (payload) => {
      this.vw = payload.virtualWidth;
      this.vh = payload.virtualHeight;
      this.repositionAll();
    });
  }

  /**
   * Reposition every region container after a virtual-canvas resize.
   * We match region containers by their label instead of relying on child index order.
   */
  private repositionAll(): void {
    const { pixiRegions, elements } = this.layout;

    // Rebuild content sizes per region (needed for centering)
    const grouped: Record<string, ResolvedHudElement[]> = {};
    for (const elem of Object.values(elements)) {
      if (!elem.visible) continue;
      if (!grouped[elem.region]) grouped[elem.region] = [];
      grouped[elem.region].push(elem);
    }

    for (const [regionId, regionConfig] of Object.entries(pixiRegions)) {
      const regionElements = grouped[regionId];
      if (!regionElements || regionElements.length === 0) continue;

      // Find the matching container by label
      const regionContainer = this.children.find(
        (c) => (c as Container).label === `hud-region-${regionId}`
      ) as Container | undefined;

      if (!regionContainer) continue;

      const gap    = regionConfig.gap ?? 8;
      const isRow  = regionConfig.flexDirection !== 'column';

      // Recalculate content size from element configs
      let contentSize = 0;
      for (const elemConfig of regionElements) {
        if (!elemConfig.visible) continue;
        const d = isRow
          ? (elemConfig.style.width  ?? 80)
          : (elemConfig.style.height ?? 40);
        contentSize += d + gap;
      }
      contentSize = Math.max(0, contentSize - gap);

      this.applyRegionPosition(regionContainer, regionConfig, isRow, contentSize);
    }
  }
}
