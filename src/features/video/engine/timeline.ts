import { AnnotationRegion, VideoAction, NarrationWord } from '../../../types';
import { RenderState, MarkerState } from './types';
import { easeOutCubic } from './animations';

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
          const progress = Math.min(1, elapsed / Math.max(.05, action.drawDuration ?? .4));
          state.activeUnderlines.push({
            regionId: action.targetRegionId,
            progress,
            isRtl: true, // Arabic YDT default is right-to-left
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

/**
 * Automatic Starter Timeline Generator (Requirement 4).
 * Deterministic text parsing of solution text + narration word alignment timestamps.
 */
export function generateAutomaticTimeline(
  solutionText: string,
  words: NarrationWord[] = [],
  regions: AnnotationRegion[] = [],
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E' | string = 'C',
  totalDuration = 15
): VideoAction[] {
  const actions: VideoAction[] = [];
  if (!solutionText || solutionText.trim().length === 0) {
    return actions;
  }

  const validOptions: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
  const upperAns = (correctAnswer || '').toUpperCase();
  const normalizedAnswer: 'A' | 'B' | 'C' | 'D' | 'E' = validOptions.includes(upperAns as any) 
    ? (upperAns as 'A' | 'B' | 'C' | 'D' | 'E')
    : 'B';

  // Find regions for each option
  const optionRegionMap: Record<string, string> = {};
  for (const r of regions) {
    if (r.type === 'option-a') optionRegionMap['A'] = r.id;
    if (r.type === 'option-b') optionRegionMap['B'] = r.id;
    if (r.type === 'option-c') optionRegionMap['C'] = r.id;
    if (r.type === 'option-d') optionRegionMap['D'] = r.id;
    if (r.type === 'option-e') optionRegionMap['E'] = r.id;
  }

  const findTimestampForPhrase = (phraseOrKeywords: string[]): number | null => {
    if (!words || words.length === 0) return null;

    for (let i = 0; i < words.length; i++) {
      const wText = words[i].text.toLowerCase().replace(/[^a-zçğıöşüA-ZÇĞİÖŞÜ0-9]/g, '');
      for (const kw of phraseOrKeywords) {
        if (wText === kw.toLowerCase() || words[i].text.toLowerCase().includes(kw.toLowerCase())) {
          return words[i].start;
        }
      }
    }
    return null;
  };

  // Option inspection expressions in Turkish & Arabic
  const optionLetters: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];
  const textLower = solutionText.toLowerCase();

  // Divide sentences
  const sentences = solutionText.split(/(?<=[.!?\n])\s+/);
  let accumulatedTime = 0.8;
  const timePerSentence = Math.max(2.5, totalDuration / Math.max(1, sentences.length));

  sentences.forEach((sentence, sIdx) => {
    const sLower = sentence.toLowerCase();
    const sentenceEstimatedTime = parseFloat((sIdx * timePerSentence + 0.5).toFixed(1));

    // Check each option
    for (const opt of optionLetters) {
      const regId = optionRegionMap[opt];
      if (!regId) continue;

      const mentionsOption =
        sLower.includes(`${opt.toLowerCase()} seçeneği`) ||
        sLower.includes(`${opt.toLowerCase()} şıkkı`) ||
        sLower.includes(`seçenek ${opt.toLowerCase()}`) ||
        sLower.includes(`( ${opt.toLowerCase()} )`) ||
        sLower.includes(`(${opt.toLowerCase()})`) ||
        sLower.includes(`خيار ${opt.toLowerCase()}`);

      if (mentionsOption) {
        // Try to find matching timestamp from narration words
        const kwTime = findTimestampForPhrase([
          `${opt} seçeneği`,
          `${opt} şıkkı`,
          opt.toLowerCase(),
        ]);
        const actionTime = kwTime !== null ? kwTime : sentenceEstimatedTime;

        // Is it being rejected?
        const isRejection =
          sLower.includes('uygun değil') ||
          sLower.includes('yanlış') ||
          sLower.includes('uyumsuzluk') ||
          sLower.includes('elenir') ||
          sLower.includes('çelişmektedir') ||
          sLower.includes('uymaz') ||
          sLower.includes('kabul edilemez') ||
          opt !== normalizedAnswer;

        // Is it the correct answer?
        const isCorrectMention =
          sLower.includes('doğru cevap') ||
          sLower.includes('cevabımız') ||
          sLower.includes('doğru seçenek') ||
          sLower.includes('doğru şık') ||
          (opt === normalizedAnswer && (sLower.includes('doğru') || sLower.includes('tamamlıyor')));

        if (isCorrectMention && opt === normalizedAnswer) {
          // Focus then Correct
          actions.push({
            id: `act_${Date.now()}_focus_${opt}_${sIdx}`,
            start: parseFloat(actionTime.toFixed(1)),
            duration: 2.5,
            targetRegionId: regId,
            type: 'focus',
            label: `${opt} Şıkkına Odaklan`,
          });

          actions.push({
            id: `act_${Date.now()}_correct_${opt}_${sIdx}`,
            start: parseFloat((actionTime + 0.4).toFixed(1)),
            duration: 3.0,
            targetRegionId: regId,
            type: 'correct',
            label: `Doğru Cevap (${opt}) İşaretle`,
          });
        } else if (isRejection && opt !== correctAnswer) {
          // Focus then Reject
          actions.push({
            id: `act_${Date.now()}_focus_${opt}_${sIdx}`,
            start: parseFloat(actionTime.toFixed(1)),
            duration: 2.0,
            targetRegionId: regId,
            type: 'focus',
            label: `${opt} Şıkkına Odaklan`,
          });

          actions.push({
            id: `act_${Date.now()}_reject_${opt}_${sIdx}`,
            start: parseFloat((actionTime + 0.3).toFixed(1)),
            duration: 2.5,
            targetRegionId: regId,
            type: 'reject',
            label: `${opt} Şıkkını Ele (X)`,
          });
        }
      }
    }
  });

  // If no actions could be detected (e.g. terse text), build a reliable default progression
  if (actions.length === 0 && regions.length > 0) {
    let t = 1.0;
    for (const opt of optionLetters) {
      const regId = optionRegionMap[opt];
      if (!regId) continue;

      if (opt === correctAnswer) {
        actions.push({
          id: `act_def_focus_${opt}`,
          start: parseFloat(t.toFixed(1)),
          duration: 2.5,
          targetRegionId: regId,
          type: 'focus',
          label: `${opt} Şıkkına Odaklan`,
        });
        actions.push({
          id: `act_def_corr_${opt}`,
          start: parseFloat((t + 0.4).toFixed(1)),
          duration: 3.0,
          targetRegionId: regId,
          type: 'correct',
          label: `Doğru Cevap (${opt})`,
        });
      } else {
        actions.push({
          id: `act_def_rej_${opt}`,
          start: parseFloat(t.toFixed(1)),
          duration: 2.0,
          targetRegionId: regId,
          type: 'reject',
          label: `${opt} Şıkkını Ele (X)`,
        });
      }
      t += Math.min(3.0, Math.max(1.8, totalDuration / 6));
    }
  }

  // Sort actions by start time
  return actions.sort((a, b) => a.start - b.start);
}
