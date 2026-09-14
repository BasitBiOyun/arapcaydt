import React from 'react';
import { YdtRegion } from '../types';

interface DimOverlayProps {
  targetRegion?: YdtRegion;
  opacity: number;
}

export const DimOverlay: React.FC<DimOverlayProps> = ({ targetRegion, opacity }) => {
  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 12,
      }}
    >
      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <mask id="dim-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRegion && (
              <rect
                x={`${targetRegion.x * 100}%`}
                y={`${targetRegion.y * 100}%`}
                width={`${targetRegion.width * 100}%`}
                height={`${targetRegion.height * 100}%`}
                rx="6"
                ry="6"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="#1C1917"
          mask="url(#dim-spotlight-mask)"
          fillOpacity={opacity}
        />
      </svg>
    </div>
  );
};
