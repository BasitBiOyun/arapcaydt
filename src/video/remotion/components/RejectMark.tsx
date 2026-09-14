import React from 'react';
import { YdtRegion } from '../types';

interface RejectMarkProps {
  region: YdtRegion;
  progress: number; // 0 to 1
}

export const RejectMark: React.FC<RejectMarkProps> = ({ region, progress }) => {
  // Stroke 1: Top-left to bottom-right (progress 0.0 to 0.5)
  // Stroke 2: Top-right to bottom-left (progress 0.5 to 1.0)
  const stroke1Progress = Math.min(1, Math.max(0, progress / 0.5));
  const stroke2Progress = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));

  // Coordinates for a 36x36 SVG box
  const size = 36;
  const pad = 9;

  // Stroke 1: (pad, pad) -> (size - pad, size - pad)
  const s1x1 = pad;
  const s1y1 = pad;
  const s1x2 = pad + (size - 2 * pad) * stroke1Progress;
  const s1y2 = pad + (size - 2 * pad) * stroke1Progress;

  // Stroke 2: (size - pad, pad) -> (pad, size - pad)
  const s2x1 = size - pad;
  const s2y1 = pad;
  const s2x2 = (size - pad) - (size - 2 * pad) * stroke2Progress;
  const s2y2 = pad + (size - 2 * pad) * stroke2Progress;

  // Subtle entrance scale pop
  const scale = progress < 0.3 ? 0.8 + (progress / 0.3) * 0.2 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${region.x * 100}%`,
        top: `${region.y * 100}%`,
        width: `${region.width * 100}%`,
        height: `${region.height * 100}%`,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '6px',
        zIndex: 20,
      }}
    >
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 6px rgba(139, 30, 45, 0.22), 0 1px 2px rgba(0, 0, 0, 0.08)',
          border: '1.5px solid rgba(139, 30, 45, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale})`,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: 'visible' }}
        >
          {/* Stroke 1 */}
          {stroke1Progress > 0 && (
            <line
              x1={s1x1}
              y1={s1y1}
              x2={s1x2}
              y2={s1y2}
              stroke="#8B1E2D"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* Stroke 2 */}
          {stroke2Progress > 0 && (
            <line
              x1={s2x1}
              y1={s2y1}
              x2={s2x2}
              y2={s2y2}
              stroke="#8B1E2D"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>

      {/* Subtle soft strikethrough line across rejected option */}
      {progress > 0.4 && (
        <div
          style={{
            position: 'absolute',
            left: `${size + 10}px`,
            right: '12px',
            height: '2px',
            backgroundColor: 'rgba(139, 30, 45, 0.45)',
            transformOrigin: 'left center',
            transform: `scaleX(${Math.min(1, (progress - 0.4) / 0.6)})`,
            borderRadius: '1px',
          }}
        />
      )}
    </div>
  );
};
