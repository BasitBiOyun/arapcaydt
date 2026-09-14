import React from 'react';
import { Img } from 'remotion';

interface QuestionBackgroundProps {
  questionImageUrl: string;
  imageAspectRatio?: number;
  showWatermark?: boolean;
  teacherTag?: string;
  children?: React.ReactNode;
}

export const QuestionBackground: React.FC<QuestionBackgroundProps> = ({
  questionImageUrl,
  imageAspectRatio = 1.2, // Default fallback aspect ratio if unknown
  showWatermark = true,
  teacherTag = 'Arapça YDT • Soru Çözümü',
  children,
}) => {
  // Available bounds in 1920x1080 composition
  const headerHeight = 56;
  const paddingX = 60;
  const paddingBottom = 34;

  const availWidth = 1920 - paddingX * 2; // 1800
  const availHeight = 1080 - headerHeight - paddingBottom - 20; // 970
  const availAspect = availWidth / availHeight;

  let fitWidth: number;
  let fitHeight: number;

  const aspect = imageAspectRatio > 0 ? imageAspectRatio : 1.2;

  if (aspect > availAspect) {
    fitWidth = availWidth;
    fitHeight = availWidth / aspect;
  } else {
    fitHeight = availHeight;
    fitWidth = availHeight * aspect;
  }

  const fitX = paddingX + (availWidth - fitWidth) / 2;
  const fitY = headerHeight + 14 + (availHeight - fitHeight) / 2;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: '#F7F6F0',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top Academic Header Strip */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${headerHeight}px`,
          backgroundColor: '#EAE8DF',
          borderBottom: '1px solid #D5D4CC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '48px',
          paddingRight: '48px',
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontSize: '19px',
            fontWeight: 700,
            color: '#1C1917',
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#8B1E2D',
            }}
          />
          <span>ÖSYM Arapça YDT Soru Çözüm Analizi</span>
        </div>

        {showWatermark && teacherTag && (
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#8B1E2D',
              backgroundColor: '#FAF9F5',
              padding: '5px 14px',
              borderRadius: '6px',
              border: '1px solid #D5D4CC',
              letterSpacing: '0.01em',
            }}
          >
            {teacherTag}
          </div>
        )}
      </header>

      {/* Main Question Card Container with Drop Shadow */}
      <div
        style={{
          position: 'absolute',
          left: `${fitX}px`,
          top: `${fitY}px`,
          width: `${fitWidth}px`,
          height: `${fitHeight}px`,
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
          border: '1px solid #D5D4CC',
          overflow: 'hidden',
          zIndex: 5,
        }}
      >
        {questionImageUrl ? (
          <Img
            src={questionImageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              userSelect: 'none',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#787670',
              fontSize: '18px',
              fontWeight: 500,
            }}
          >
            Soru görseli yükleniyor...
          </div>
        )}

        {/* Overlay children (Highlights, Marks, Underlines, Focus, Dim) */}
        {children}
      </div>
    </div>
  );
};
