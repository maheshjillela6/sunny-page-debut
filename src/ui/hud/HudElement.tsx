/**
 * HudElement - Universal HUD element that renders in icon, image, or hybrid mode
 * Falls back to icon rendering if images fail to load
 */

import React, { useState, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import type { ResolvedHudElement, HudLayoutMode } from './types/HudLayoutTypes';

interface HudElementProps {
  config: ResolvedHudElement;
  mode: HudLayoutMode;
  /** Override content to render inside (e.g. formatted value) */
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}

/** Resolve a Lucide icon component by name */
function getIcon(name?: string): React.ComponentType<any> | null {
  if (!name) return null;
  return (LucideIcons as any)[name] ?? null;
}

export const HudElement: React.FC<HudElementProps> = ({
  config,
  mode,
  children,
  onClick,
  disabled = false,
  active = false,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const handleImgError = useCallback(() => setImgError(true), []);

  const style = config.style;

  // Decide what to render
  const showImage = (mode === 'image' || mode === 'hybrid') && config.resolvedImageSrc && !imgError;
  const showIcon = mode === 'icon' || (mode === 'hybrid') || (mode === 'image' && imgError && config.useIcon);

  const IconComponent = useMemo(() => getIcon(config.icon), [config.icon]);

  const containerStyle: React.CSSProperties = {
    width: style.width,
    height: style.height,
    borderRadius: style.borderRadius,
    padding: style.padding ? `${style.padding[0]}px ${style.padding[1]}px` : undefined,
    opacity: style.opacity,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight as any,
  };

  const baseClasses = [
    'flex items-center gap-2 transition-all duration-200',
    style.backdrop ? 'bg-card/90 backdrop-blur-sm border border-border' : '',
    onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : '',
    disabled ? 'opacity-50 pointer-events-none' : '',
    active ? 'border-primary bg-primary/10' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={baseClasses}
      style={containerStyle}
      onClick={disabled ? undefined : onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Image rendering */}
      {showImage && (
        <img
          src={config.resolvedImageSrc}
          alt={config.label || config.id}
          onError={handleImgError}
          className="object-contain"
          style={{
            width: style.iconSize ?? 24,
            height: style.iconSize ?? 24,
          }}
        />
      )}

      {/* Icon rendering (when mode=icon, or hybrid alongside image, or image fallback) */}
      {showIcon && IconComponent && !(showImage && mode === 'image') && (
        <IconComponent
          size={style.iconSize ?? 16}
          className={active ? 'text-primary' : 'text-muted-foreground'}
        />
      )}

      {/* Label + children */}
      {children}
    </div>
  );
};

export default HudElement;
