import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, Audio } from 'remotion';
import { YdtVideoProps, YdtRegion } from './types';
import { QuestionBackground } from './components/QuestionBackground';
import { RejectMark } from './components/RejectMark';
import { CorrectMark } from './components/CorrectMark';
import { AnimatedUnderline } from './components/AnimatedUnderline';
import { HighlightRegion } from './components/HighlightRegion';
import { FocusRegion } from './components/FocusRegion';
import { DimOverlay } from './components/DimOverlay';
import {
  getPersistentMarks,
  getActiveUnderlines,
  getActiveHighlights,
  getActiveFocus,
  getActiveDimOthers,
  getActiveZoom,
} from './helpers';

export const YdtQuestionComposition: React.FC<YdtVideoProps> = ({
  questionImageUrl,
  audioUrl,
  regions = [],
  events = [],
  teacherTag = 'Arapça YDT • Soru Çözümü',
  showWatermark = true,
  imageAspectRatio,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fast map lookup for regions
  const regionMap = useMemo(() => {
    const map = new Map<string, YdtRegion>();
    for (const r of regions) {
      map.set(r.id, r);
    }
    return map;
  }, [regions]);

  // Deterministic state computation based strictly on frame
  const persistentMarks = useMemo(
    () => getPersistentMarks(events, frame, fps),
    [events, frame, fps]
  );

  const activeUnderlines = useMemo(
    () => getActiveUnderlines(events, frame, fps),
    [events, frame, fps]
  );

  const activeHighlights = useMemo(
    () => getActiveHighlights(events, frame, fps),
    [events, frame, fps]
  );

  const activeFocus = useMemo(
    () => getActiveFocus(events, frame, fps),
    [events, frame, fps]
  );

  const activeDim = useMemo(
    () => getActiveDimOthers(events, frame, fps),
    [events, frame, fps]
  );

  const zoomScale = useMemo(
    () => getActiveZoom(events, frame, fps),
    [events, frame, fps]
  );

  const dimTargetRegion = activeDim?.event.targetRegionId
    ? regionMap.get(activeDim.event.targetRegionId)
    : undefined;

  const focusTargetRegion = activeFocus?.event.targetRegionId
    ? regionMap.get(activeFocus.event.targetRegionId)
    : undefined;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: 'relative',
        transform: `scale(${zoomScale})`,
        transformOrigin: 'center 45%',
        transition: 'transform 0.1s ease-out',
      }}
    >
      {/* Approved Narration Audio */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Main Question Stage & Card Background */}
      <QuestionBackground
        questionImageUrl={questionImageUrl}
        imageAspectRatio={imageAspectRatio}
        showWatermark={showWatermark}
        teacherTag={teacherTag}
      >
        {/* Layer 1: Dim Others overlay (if active) */}
        {activeDim && (
          <DimOverlay
            targetRegion={dimTargetRegion}
            opacity={activeDim.opacity}
          />
        )}

        {/* Layer 2: Translucent Highlights */}
        {activeHighlights.map(({ event, opacity }) => {
          const region = regionMap.get(event.targetRegionId);
          if (!region) return null;
          return (
            <HighlightRegion
              key={`hl-${event.id}`}
              region={region}
              opacity={opacity}
            />
          );
        })}

        {/* Layer 3: Progressive RTL Animated Underlines */}
        {activeUnderlines.map(({ event, drawProgress, opacity }) => {
          const region = regionMap.get(event.targetRegionId);
          if (!region) return null;
          const isArabic =
            region.type.includes('option') ||
            region.type === 'sentence' ||
            region.type === 'arabic_phrase' ||
            region.type === 'keyword';
          return (
            <AnimatedUnderline
              key={`ul-${event.id}`}
              region={region}
              drawProgress={drawProgress}
              opacity={opacity}
              isArabicRtl={isArabic}
            />
          );
        })}

        {/* Layer 4: Focus outline */}
        {activeFocus && focusTargetRegion && (
          <FocusRegion
            key={`focus-${activeFocus.event.id}`}
            region={focusTargetRegion}
            opacity={activeFocus.opacity}
            scale={activeFocus.scale}
          />
        )}

        {/* Layer 5: Persistent Reject Marks (Red X) and Correct Marks (Green Check) */}
        {persistentMarks.map(({ event, progress }) => {
          const region = regionMap.get(event.targetRegionId);
          if (!region) return null;

          if (event.type === 'reject') {
            return (
              <RejectMark
                key={`mark-${event.id}`}
                region={region}
                progress={progress}
              />
            );
          }

          if (event.type === 'correct') {
            return (
              <CorrectMark
                key={`mark-${event.id}`}
                region={region}
                progress={progress}
              />
            );
          }

          return null;
        })}
      </QuestionBackground>
    </div>
  );
};
