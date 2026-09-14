import React from 'react';
import { YdtRegion } from '../types';

interface FocusRegionProps {
  region: YdtRegion;
  opacity: number;
  scale: number;
}

export const FocusRegion: React.FC<FocusRegionProps> = ({ region, opacity, scale }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(${region.x * 100}% - 4px)`,
        top: `calc(${region.y * 100}% - 3px)`,
        width: `calc(${region.width * 100}% + 8px)`,
        height: `calc(${region.height * 100}% + 6px)`,
        border: '2px solid rgba(139, 30, 45, 0.8)',
        borderRadius: '6px',
        boxShadow: '0 0 0 3px rgba(139, 30, 45, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08)',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        opacity,
        pointerEvents: 'none',
        zIndex: 18,
      }}
    />
  );
};
