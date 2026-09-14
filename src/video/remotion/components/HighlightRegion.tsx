import React from 'react';
import { YdtRegion } from '../types';

interface HighlightRegionProps {
  region: YdtRegion;
  opacity: number; // 0 to 1
}

export const HighlightRegion: React.FC<HighlightRegionProps> = ({ region, opacity }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(${region.x * 100}% - 4px)`,
        top: `calc(${region.y * 100}% - 2px)`,
        width: `calc(${region.width * 100}% + 8px)`,
        height: `calc(${region.height * 100}% + 4px)`,
        backgroundColor: 'rgba(254, 240, 138, 0.48)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '5px',
        opacity,
        mixBlendMode: 'multiply',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
};
