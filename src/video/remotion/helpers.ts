import { interpolate } from 'remotion';
import { YdtEvent, YdtRegion, YdtVideoProps } from './types';
import { QuestionProject, VideoAction, AnnotationRegion } from '../../types';

/**
 * Normalizes action type from raw data or Gemini pipeline into Remotion event types.
 */
export function normalizeEventType(type: string): YdtEvent['type'] | null {
  const t = type.toLowerCase().replace(/[-_]/g, '');
  if (t === 'reject' || t === 'cross') return 'reject';
  if (t === 'correct' || t === 'check') return 'correct';
  if (t === 'highlight') return 'highlight';
  if (t === 'underline') return 'underline';
  if (t === 'focus') return 'focus';
  if (t === 'dimothers') return 'dimOthers';
  if (t === 'zoom') return 'zoom';
  return null;
}

/**
 * Converts a QuestionProject into Remotion composition input props.
 */
export function convertProjectToRemotionProps(project: QuestionProject): YdtVideoProps {
  const regions: YdtRegion[] = (project.videoConfig.regions || []).map((r: AnnotationRegion) => ({
    id: r.id,
    type: r.type || 'custom',
    x: Math.max(0, Math.min(1, r.x)),
    y: Math.max(0, Math.min(1, r.y)),
    width: Math.max(0.01, Math.min(1, r.width)),
    height: Math.max(0.01, Math.min(1, r.height)),
  }));

  const events: YdtEvent[] = [];
  const rawActions = project.videoConfig.timelineActions || [];

  for (const a of rawActions) {
    const normalizedType = normalizeEventType(a.type);
    if (!normalizedType) continue;

    // Verify target region exists, or skip if uncertain
    const hasRegion = regions.some((r) => r.id === a.targetRegionId);
    if (!hasRegion && a.targetRegionId) {
      continue; // Skip uncertain/missing targets gracefully
    }

    events.push({
      id: a.id || `event-${events.length + 1}`,
      start: typeof a.start === 'number' ? Math.max(0, a.start) : 0,
      duration: typeof a.duration === 'number' && a.duration > 0 ? a.duration : undefined,
      type: normalizedType,
      targetRegionId: a.targetRegionId,
    });
  }

  // Sort events chronologically
  events.sort((a, b) => a.start - b.start);

  const durationInSeconds = Math.max(
    project.narrationSource?.duration || project.audioNarration?.duration || 15,
    events.length > 0 ? Math.max(...events.map((e) => e.start + (e.duration || 3))) + 2 : 15
  );

  return {
    questionImageUrl: project.imageUrl || '',
    audioUrl: project.narrationSource?.audioUrl || project.audioNarration?.audioUrl || '',
    durationInSeconds,
    regions,
    events,
    teacherTag: project.videoConfig.teacherTag || 'Arapça YDT • Soru Çözümü',
    showWatermark: project.videoConfig.showWatermark ?? true,
  };
}

/**
 * Returns persistent reject and correct marks for a given frame.
 * Deterministic: At any frame, all marks that started at or before this frame
 * are returned. Once animated in (250-400ms), they remain visible until the video ends.
 */
export function getPersistentMarks(
  events: YdtEvent[],
  currentFrame: number,
  fps: number
): Array<{
  event: YdtEvent;
  progress: number; // 0 to 1
  isFullyVisible: boolean;
}> {
  const animFrames = Math.round(fps * 0.32); // ~320ms entrance animation
  const marks: Array<{ event: YdtEvent; progress: number; isFullyVisible: boolean }> = [];

  for (const e of events) {
    if (e.type !== 'reject' && e.type !== 'correct') continue;

    const startFrame = Math.round(e.start * fps);
    if (currentFrame < startFrame) continue;

    const progress = interpolate(
      currentFrame - startFrame,
      [0, animFrames],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    marks.push({
      event: e,
      progress,
      isFullyVisible: progress >= 1,
    });
  }

  return marks;
}

/**
 * Returns active underline events for the current frame.
 * Drawing supports right-to-left for Arabic text.
 */
export function getActiveUnderlines(
  events: YdtEvent[],
  currentFrame: number,
  fps: number
): Array<{
  event: YdtEvent;
  drawProgress: number; // 0 to 1
  opacity: number;
}> {
  const animFrames = Math.round(fps * 0.35); // ~350ms draw stroke
  const result: Array<{ event: YdtEvent; drawProgress: number; opacity: number }> = [];

  for (const e of events) {
    if (e.type !== 'underline') continue;

    const startFrame = Math.round(e.start * fps);
    if (currentFrame < startFrame) continue;

    const endFrame = e.duration ? startFrame + Math.round(e.duration * fps) : Infinity;
    if (currentFrame > endFrame) continue;

    const drawProgress = interpolate(
      currentFrame - startFrame,
      [0, animFrames],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    let opacity = 1;
    if (endFrame !== Infinity && currentFrame > endFrame - 10) {
      opacity = interpolate(currentFrame, [endFrame - 10, endFrame], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }

    result.push({ event: e, drawProgress, opacity });
  }

  return result;
}

/**
 * Returns active highlights for the current frame.
 * Subtly fades in without obscuring text.
 */
export function getActiveHighlights(
  events: YdtEvent[],
  currentFrame: number,
  fps: number
): Array<{
  event: YdtEvent;
  opacity: number;
}> {
  const fadeInFrames = 8; // ~260ms
  const fadeOutFrames = 8;
  const result: Array<{ event: YdtEvent; opacity: number }> = [];

  for (const e of events) {
    if (e.type !== 'highlight') continue;

    const startFrame = Math.round(e.start * fps);
    const durationFrames = Math.round((e.duration || 4.5) * fps);
    const endFrame = startFrame + durationFrames;

    if (currentFrame < startFrame || currentFrame > endFrame) continue;

    let opacity = 1;
    if (currentFrame < startFrame + fadeInFrames) {
      opacity = interpolate(currentFrame, [startFrame, startFrame + fadeInFrames], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else if (currentFrame > endFrame - fadeOutFrames) {
      opacity = interpolate(currentFrame, [endFrame - fadeOutFrames, endFrame], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }

    result.push({ event: e, opacity });
  }

  return result;
}

/**
 * Returns active focus events for current frame.
 */
export function getActiveFocus(
  events: YdtEvent[],
  currentFrame: number,
  fps: number
): { event: YdtEvent; opacity: number; scale: number } | null {
  for (const e of events) {
    if (e.type !== 'focus') continue;

    const startFrame = Math.round(e.start * fps);
    const durationFrames = Math.round((e.duration || 4.5) * fps);
    const endFrame = startFrame + durationFrames;

    if (currentFrame >= startFrame && currentFrame <= endFrame) {
      const enterProgress = interpolate(currentFrame, [startFrame, startFrame + 8], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const scale = 1 + 0.015 * enterProgress;
      return { event: e, opacity: enterProgress, scale };
    }
  }

  return null;
}

/**
 * Returns active dimOthers event for current frame.
 */
export function getActiveDimOthers(
  events: YdtEvent[],
  currentFrame: number,
  fps: number
): { event: YdtEvent; opacity: number } | null {
  for (const e of events) {
    if (e.type !== 'dimOthers') continue;

    const startFrame = Math.round(e.start * fps);
    const durationFrames = Math.round((e.duration || 4.5) * fps);
    const endFrame = startFrame + durationFrames;

    if (currentFrame >= startFrame && currentFrame <= endFrame) {
      const opacity = interpolate(
        currentFrame,
        [startFrame, startFrame + 10, endFrame - 10, endFrame],
        [0, 0.38, 0.38, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
      return { event: e, opacity };
    }
  }

  return null;
}

/**
 * Returns active zoom (max 5-8% scale) for current frame.
 */
export function getActiveZoom(
  events: YdtEvent[],
  currentFrame: number,
  fps: number
): number {
  for (const e of events) {
    if (e.type !== 'zoom') continue;

    const startFrame = Math.round(e.start * fps);
    const durationFrames = Math.round((e.duration || 5) * fps);
    const endFrame = startFrame + durationFrames;

    if (currentFrame >= startFrame && currentFrame <= endFrame) {
      // Smooth bell curve zoom: 1.0 -> 1.06 -> 1.0
      const zoomPeak = 1.06;
      return interpolate(
        currentFrame,
        [startFrame, startFrame + 15, endFrame - 15, endFrame],
        [1.0, zoomPeak, zoomPeak, 1.0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    }
  }

  return 1.0;
}
