/**
 * HudRegion - Renders a positioned region that contains HUD elements
 * Layout is driven entirely by config
 */

import React from 'react';
import type { ReactRegionConfig } from './types/HudLayoutTypes';

interface HudRegionProps {
  config: ReactRegionConfig;
  children: React.ReactNode;
  className?: string;
}

function toCssValue(val: number | string | undefined): string | undefined {
  if (val === undefined) return undefined;
  if (typeof val === 'number') return `${val}px`;
  return val;
}

export const HudRegion: React.FC<HudRegionProps> = ({ config, children, className = '' }) => {
  const style: React.CSSProperties = {
    position: config.position as any,
    top: toCssValue(config.top),
    bottom: toCssValue(config.bottom),
    left: toCssValue(config.left),
    right: toCssValue(config.right),
    transform: config.transform,
    display: 'flex',
    flexDirection: config.flexDirection as any,
    alignItems: config.alignItems,
    justifyContent: config.justifyContent,
    gap: config.gap ? `${config.gap}px` : undefined,
    flexWrap: config.flexWrap as any,
    padding: config.padding
      ? config.padding.map((p) => (typeof p === 'number' ? `${p}px` : p)).join(' ')
      : undefined,
  };

  return (
    <div
      className={`pointer-events-none z-10 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};

export default HudRegion;
