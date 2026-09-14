import React from 'react';
import { YdtRegion } from '../types';

interface AnimatedUnderlineProps {
  region: YdtRegion;
  drawProgress: number; // 0 to 1
  opacity: number;
  isArabicRtl?: boolean;
}

export const AnimatedUnderline: React.FC<AnimatedUnderlineProps> = ({
  region,
  drawProgress,
  opacity,
  isArabicRtl = true,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${region.x * 100}%`,
        top: `${region.y * 100}%`,
        width: `${region.width * 100}%`,
        height: `${region.height * 100}%`,
        pointerEvents: 'none',
        zIndex: 15,
        opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: '-3px',
          ...(isArabicRtl
            ? {
                right: '0',
                width: `${drawProgress * 100}%`,
              }
            : {
                left: '0',
                width: `${drawProgress * 100}%`,
              }),
          height: '3.5px',
          backgroundColor: '#8B1E2D',
          borderRadius: '2px',
          boxShadow: '0 1px 3px rgba(139, 30, 45, 0.3)',
        }}
      />
    </div>
  );
};
