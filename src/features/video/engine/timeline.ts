import { AnnotationRegion, VideoAction } from '../../../types';
import { RenderState, MarkerState } from './types';
import { easeOutCubic } from './animations';

/** How far an underline is drawn `elapsed` seconds in, following its word steps (0–1). */
export function stepProgress(steps: Array<{ at: number; to: number }>, elapsed: number): number {
  let previous = { at: 0, to: 0 };
  for (const step of steps) {
    if (elapsed <= step.at) {
      return step.at <= previous.at ? step.to : previous.to + (step.to - previous.to) * (elapsed - previous.at) / (step.at - previous.at);
    }
    previous = step;
  }
  return 1;
}

/**
 * The same word steps after the mark's start moved by `shift` seconds (the words stay where they
 * are spoken), squeezed to fit within `maxDraw` seconds.
 */
export function fitSteps(steps: Array<{ at: number; to: number }>, shift: number, maxDraw: number): Array<{ at: number; to: number }> {
  const moved = steps.map(s => ({ at: Math.max(0, s.at - shift), to: s.to }));
  const last = moved.at(-1)?.at ?? 0;
  const squeeze = last > maxDraw && last > 0 ? maxDraw / last : 1;
  return moved.map(s => ({ at: Math.round(s.at * squeeze * 1000) / 1000, to: s.to }));
}

/**
 * Deterministic pure function: Computes the exact visual render state at timestamp `currentTime`.
 * Seeking backward or forward calculates from scratch based on actions up to `currentTime`.
 */
export function computeTimelineVisualState(
  currentTime: number,
  actions: VideoAction[] = [],
  regions: AnnotationRegion[] = [],
  selectedRegionId?: string | null
): RenderState {
  const state: RenderState = {
    activeHighlights: [],
    activeUnderlines: [],
    activeFocus: [],
    activeDimOthers: { active: false, opacity: 0 },
    rejectedRegions: {},
    correctRegions: {},
    selectedRegionId: selectedRegionId || null,
  };

  if (!actions || actions.length === 0) {
    return state;
  }

  // Sort actions by start time
  const sortedActions = [...actions].sort((a, b) => a.start - b.start);

  for (const action of sortedActions) {
    // Has this action occurred yet?
    if (currentTime < action.start) {
      continue;
    }

    const elapsed = currentTime - action.start;
    const animDuration = 0.35; // 350ms for transition
    const rawProgress = Math.min(1, Math.max(0, elapsed / animDuration));
    const animProgress = easeOutCubic(rawProgress);

    switch (action.type) {
      case 'reject': {
        delete state.correctRegions[action.targetRegionId];
        // Permanent rejection mark until explicit reset
        state.rejectedRegions[action.targetRegionId] = {
          regionId: action.targetRegionId,
          drawProgress: animProgress,
          timestamp: action.start,
        };
        break;
      }

      case 'correct': {
        delete state.rejectedRegions[action.targetRegionId];
        // Permanent correct answer checkmark until explicit reset
        state.correctRegions[action.targetRegionId] = {
          regionId: action.targetRegionId,
          drawProgress: animProgress,
          timestamp: action.start,
        };
        break;
      }

      case 'highlight': {
        // Highlight is active during [action.start, action.start + action.duration]
        const duration = action.duration ?? 3.0;
        if (currentTime <= action.start + duration) {
          const fadeOutThreshold = duration - 0.25;
          let opacity = Math.min(1, elapsed / 0.2); // fade in in 200ms
          if (elapsed > fadeOutThreshold) {
            opacity = Math.max(0, (duration - elapsed) / 0.25); // fade out
          }
          state.activeHighlights.push({
            regionId: action.targetRegionId,
            opacity: opacity * 0.24,
          });
        }
        break;
      }

      case 'underline': {
        // Underline draws along line, stays for duration, then clears
        const duration = action.duration ?? 3.5;
        if (currentTime <= action.start + duration) {
          const stepped = !!action.drawSteps?.length;
          const progress = stepped ? stepProgress(action.drawSteps!, elapsed) : Math.min(1, elapsed / Math.max(.05, action.drawDuration ?? .4));
          state.activeUnderlines.push({
            regionId: action.targetRegionId,
            progress,
            stepped,
            isRtl: true, // Arabic YDT default is right-to-left
            offset: action.lineOffset,
            opacity: duration > .5 ? Math.min(1, (duration - elapsed) / .18) : 1,
          });
        }
        break;
      }

      case 'focus': {
        // Focus box emphasizes region during duration
        const duration = action.duration ?? 2.5;
        if (currentTime <= action.start + duration) {
          // Soft exit so switching options never snaps; very short cues keep full strength.
          const intensity = Math.min(1, elapsed / 0.25, duration > .6 ? (duration - elapsed) / .15 : 1);
          state.activeFocus.push({
            regionId: action.targetRegionId,
            intensity,
          });
        }
        break;
      }

      case 'dim-others': {
        const duration = Math.max(0.8, action.duration || 3.0);
        if (currentTime <= action.start + duration) {
          state.activeDimOthers = {
            active: true,
            targetRegionId: action.targetRegionId,
            opacity: 0.55,
          };
        }
        break;
      }

      case 'reset': {
        // Reset explicitly clears active transients and optionally removes specific markers
        if (action.targetRegionId && action.targetRegionId !== 'all') {
          delete state.rejectedRegions[action.targetRegionId];
          delete state.correctRegions[action.targetRegionId];
        } else {
          state.rejectedRegions = {};
          state.correctRegions = {};
          state.activeHighlights = [];
          state.activeUnderlines = [];
          state.activeFocus = [];
          state.activeDimOthers = { active: false, opacity: 0 };
        }
        break;
      }
    }
  }

  return state;
}
