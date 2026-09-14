import React from 'react';
import { YdtRegion } from '../types';

interface CorrectMarkProps {
  region: YdtRegion;
  progress: number; // 0 to 1
}

export const CorrectMark: React.FC<CorrectMarkProps> = ({ region, progress }) => {
  // Segment 1 (downward slant): (9, 18) -> (15, 25) (~35% of duration)
  // Segment 2 (upward right slant): (15, 25) -> (27, 10) (~65% of duration)
  const seg1Progress = Math.min(1, Math.max(0, progress / 0.35));
  const seg2Progress = Math.min(1, Math.max(0, (progress - 0.35) / 0.65));

  const size = 36;

  // Segment 1 coordinates
  const s1x1 = 9;
  const s1y1 = 18;
  const s1x2 = 9 + 6 * seg1Progress;
  const s1y2 = 18 + 7 * seg1Progress;

  // Segment 2 coordinates
  const s2x1 = 15;
  const s2y1 = 25;
  const s2x2 = 15 + 12 * seg2Progress;
  const s2y2 = 25 - 15 * seg2Progress;

  // Entrance bounce/scale
  const scale = progress < 0.3 ? 0.75 + (progress / 0.3) * 0.25 : 1;

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
        zIndex: 25,
      }}
    >
      {/* Subtle green highlight box around the correct answer */}
      <div
        style={{
          position: 'absolute',
          inset: '-2px -6px -2px -6px',
          borderRadius: '6px',
          backgroundColor: 'rgba(21, 128, 61, 0.08)',
          border: '2px solid rgba(21, 128, 61, 0.55)',
          opacity: progress,
          pointerEvents: 'none',
        }}
      />

      {/* Checkmark badge */}
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 8px rgba(21, 128, 61, 0.25), 0 1px 2px rgba(0, 0, 0, 0.08)',
          border: '1.5px solid rgba(21, 128, 61, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale})`,
          zIndex: 2,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: 'visible' }}
        >
          {/* Segment 1 */}
          {seg1Progress > 0 && (
            <line
              x1={s1x1}
              y1={s1y1}
              x2={s1x2}
              y2={s1y2}
              stroke="#15803D"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* Segment 2 */}
          {seg2Progress > 0 && (
            <line
              x1={s2x1}
              y1={s2y1}
              x2={s2x2}
              y2={s2y2}
              stroke="#15803D"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>

      {/* "Doğru Cevap" restrained pill indicator */}
      {progress > 0.6 && (
        <div
          style={{
            position: 'absolute',
            right: '8px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: '#15803D',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            opacity: Math.min(1, (progress - 0.6) / 0.4),
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            zIndex: 2,
          }}
        >
          DOĞRU CEVAP
        </div>
      )}
    </div>
  );
};
