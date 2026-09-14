import { QuestionImageAnalysisResult, DetectedBoxRegion } from './analyzeQuestionImage';
import { SolutionAnalysisResult, SemanticVideoEvent } from './analyzeSolution';
import { locateTextInImage } from './locateTextInImage';

export interface GeneratedRegion {
  id: string;
  label: string;
  type:
    | 'question'
    | 'paragraph'
    | 'keyword'
    | 'option-a'
    | 'option-b'
    | 'option-c'
    | 'option-d'
    | 'option-e'
    | 'custom';
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
  color?: string;
  text?: string;
}

export interface GeneratedAction {
  id: string;
  start: number; // seconds
  duration: number; // seconds
  targetRegionId: string;
  type: 'focus' | 'underline' | 'highlight' | 'reject' | 'correct' | 'dim-others' | 'reset';
  label?: string;
}

export interface BuildPlanInput {
  imageAnalysis: QuestionImageAnalysisResult;
  solutionAnalysis: SolutionAnalysisResult;
  solutionText: string;
  correctAnswer?: string;
  audioDuration?: number;
  words?: Array<{ text: string; start: number; end: number }>;
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
  imageBase64?: string;
}

export interface BuildPlanResult {
  regions: GeneratedRegion[];
  actions: GeneratedAction[];
  stats: {
    totalEventsPlanned: number;
    actionsGenerated: number;
    actionsSkipped: number;
    groundedOptions: string[];
  };
}

/** Helper: Normalize string for fuzzy phrase search */
function cleanForSearch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches for spokenAnchor inside solutionText and returns the sub-second timestamp
 * using ElevenLabs character or word alignment.
 */
function findAnchorTimestamp(
  anchor: string,
  solutionText: string,
  words: Array<{ text: string; start: number; end: number }> = [],
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  },
  audioDuration = 15
): number | null {
  if (!anchor || anchor.trim().length === 0) return null;

  const cleanAnchor = cleanForSearch(anchor);
  const cleanSolution = cleanForSearch(solutionText);

  // 1. Precise character alignment matching if available
  if (alignment?.character_start_times_seconds && alignment.character_start_times_seconds.length > 0) {
    const rawIdx = solutionText.indexOf(anchor);
    if (rawIdx !== -1 && rawIdx < alignment.character_start_times_seconds.length) {
      const ts = alignment.character_start_times_seconds[rawIdx];
      if (typeof ts === 'number' && !isNaN(ts)) {
        return parseFloat(ts.toFixed(2));
      }
    }
  }

  // 2. Word-level alignment matching
  if (words && words.length > 0) {
    const anchorTokens = cleanAnchor.split(' ').filter((t) => t.length > 1);
    if (anchorTokens.length > 0) {
      const firstToken = anchorTokens[0];

      // Find candidate indices in words array
      for (let i = 0; i < words.length; i++) {
        const curWordClean = cleanForSearch(words[i].text);
        if (curWordClean.includes(firstToken) || firstToken.includes(curWordClean)) {
          // Check following tokens if multi-token anchor
          let matches = true;
          for (let j = 1; j < Math.min(anchorTokens.length, 3); j++) {
            if (i + j < words.length) {
              const nextWordClean = cleanForSearch(words[i + j].text);
              if (!nextWordClean.includes(anchorTokens[j]) && !anchorTokens[j].includes(nextWordClean)) {
                matches = false;
                break;
              }
            }
          }
          if (matches) {
            return parseFloat(words[i].start.toFixed(2));
          }
        }
      }
    }
  }

  // 3. Fallback proportional position if text occurs in solution
  const idx = cleanSolution.indexOf(cleanAnchor);
  if (idx !== -1 && cleanSolution.length > 0) {
    const ratio = idx / cleanSolution.length;
    return parseFloat((ratio * audioDuration).toFixed(2));
  }

  return null;
}

export async function buildAnimationPlan(input: BuildPlanInput): Promise<BuildPlanResult> {
  const {
    imageAnalysis,
    solutionAnalysis,
    solutionText,
    correctAnswer = 'C',
    audioDuration = 15,
    words = [],
    alignment,
    imageBase64,
  } = input;

  const regions: GeneratedRegion[] = [];
  const actions: GeneratedAction[] = [];
  const groundedOptions: string[] = [];
  let actionsSkipped = 0;

  // 1. Convert Detected Image Boxes to AnnotationRegions (normalized 0..1)
  const optionRegionMap: Record<string, string> = {};
  const textRegionMap: Record<string, string> = {};

  for (const r of imageAnalysis.regions || []) {
    const [ymin, xmin, ymax, xmax] = r.box;
    const x = parseFloat((xmin / 1000).toFixed(4));
    const y = parseFloat((ymin / 1000).toFixed(4));
    const width = parseFloat(((xmax - xmin) / 1000).toFixed(4));
    const height = parseFloat(((ymax - ymin) / 1000).toFixed(4));

    let regType: GeneratedRegion['type'] = 'custom';
    let regLabel = r.text ? r.text.slice(0, 24) : 'Bölge';

    if (r.type === 'option' && r.option) {
      const opt = r.option.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
      regType = `option-${opt.toLowerCase()}` as any;
      regLabel = `${opt} Şıkkı`;
      optionRegionMap[opt] = r.id;
      groundedOptions.push(opt);
    } else if (r.type === 'sentence') {
      regType = 'question';
      regLabel = 'Soru Cümlesi';
    } else if (r.type === 'instruction') {
      regType = 'paragraph';
      regLabel = 'Soru Kökü';
    } else if (r.type === 'arabic_phrase' || r.type === 'blank') {
      regType = 'keyword';
      regLabel = r.text || 'Arapça İfade';
      if (r.text) {
        textRegionMap[cleanForSearch(r.text)] = r.id;
      }
    }

    regions.push({
      id: r.id,
      label: regLabel,
      type: regType,
      x,
      y,
      width,
      height,
      text: r.text,
    });
  }

  // Fallback: If image analysis missed an option A-E, synthesize a grounded proportional box
  const standardOpts: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];
  standardOpts.forEach((opt, idx) => {
    if (!optionRegionMap[opt]) {
      const synthId = `region_opt_${opt.toLowerCase()}`;
      const synthY = 0.52 + idx * 0.085;
      regions.push({
        id: synthId,
        label: `${opt} Şıkkı`,
        type: `option-${opt.toLowerCase()}` as any,
        x: 0.1,
        y: parseFloat(synthY.toFixed(3)),
        width: 0.8,
        height: 0.07,
      });
      optionRegionMap[opt] = synthId;
      groundedOptions.push(opt);
    }
  });

  // 2. Process Semantic Video Events and Synchronize Timestamps
  const plannedEvents = solutionAnalysis.events || [];
  let lastTimestamp = 0.8;

  for (let i = 0; i < plannedEvents.length; i++) {
    const event = plannedEvents[i];
    let targetRegionId: string | null = null;
    let actionType: GeneratedAction['type'] | null = null;
    let label = '';
    let duration = 2.5;

    // Determine target region
    if (event.target.type === 'option' && event.target.option) {
      const opt = event.target.option.toUpperCase();
      targetRegionId = optionRegionMap[opt] || null;
    } else if (event.target.type === 'text' && event.target.text) {
      const cleanText = cleanForSearch(event.target.text);
      targetRegionId = textRegionMap[cleanText] || null;

      // If not previously detected, attempt targeted visual grounding if image is provided
      if (!targetRegionId && imageBase64) {
        try {
          const located = await locateTextInImage(imageBase64, event.target.text);
          if (located.found && located.box) {
            const [ymin, xmin, ymax, xmax] = located.box;
            const newId = `phrase_${Date.now()}_${i}`;
            const newRegion: GeneratedRegion = {
              id: newId,
              label: event.target.text.slice(0, 20),
              type: 'keyword',
              x: parseFloat((xmin / 1000).toFixed(4)),
              y: parseFloat((ymin / 1000).toFixed(4)),
              width: parseFloat(((xmax - xmin) / 1000).toFixed(4)),
              height: parseFloat(((ymax - ymin) / 1000).toFixed(4)),
              text: event.target.text,
            };
            regions.push(newRegion);
            textRegionMap[cleanText] = newId;
            targetRegionId = newId;
          }
        } catch {
          // If search fails, skip rather than placing a wrong annotation
        }
      }
    } else if (event.target.regionType) {
      const match = regions.find((r) => r.type === event.target.regionType);
      if (match) targetRegionId = match.id;
    }

    // REQUIREMENT 12: If cannot confidently locate, SKIP THAT ANIMATION
    if (!targetRegionId) {
      actionsSkipped++;
      continue;
    }

    // Map semantic action to deterministic engine action
    switch (event.action) {
      case 'reject':
        actionType = 'reject';
        duration = 2.5;
        label = event.target.option ? `${event.target.option} Şıkkını Ele (✕)` : 'Ele (✕)';
        break;
      case 'correct':
        actionType = 'correct';
        duration = 3.0;
        label = event.target.option ? `Doğru Cevap (${event.target.option}) ✓` : 'Doğru Cevap ✓';
        break;
      case 'focus':
        actionType = 'focus';
        duration = 2.2;
        label = event.target.option ? `${event.target.option} Şıkkına Odaklan` : 'Alana Odaklan';
        break;
      case 'underline':
        actionType = 'underline';
        duration = 3.5;
        label = 'Arapça İfadeyi Vurgula (Alt Çizgi)';
        break;
      case 'highlight':
        actionType = 'highlight';
        duration = 3.0;
        label = 'Vurgula (Highlight)';
        break;
      case 'dimOthers':
        actionType = 'dim-others';
        duration = 3.0;
        label = 'Çevreyi Karart';
        break;
      default:
        // skip unrecognized
        break;
    }

    if (!actionType) {
      actionsSkipped++;
      continue;
    }

    // Find timestamp from ElevenLabs alignment using spokenAnchor
    const detectedTime = findAnchorTimestamp(
      event.spokenAnchor,
      solutionText,
      words,
      alignment,
      audioDuration
    );

    let start = detectedTime !== null ? detectedTime : lastTimestamp + 1.8;
    // Ensure chronological sanity and bounds
    start = Math.max(0.3, Math.min(parseFloat((audioDuration - 0.5).toFixed(2)), parseFloat(start.toFixed(2))));
    lastTimestamp = start;

    actions.push({
      id: `act_auto_${Date.now()}_${i}`,
      start,
      duration,
      targetRegionId,
      type: actionType,
      label,
    });
  }

  // Ensure chronological order
  actions.sort((a, b) => a.start - b.start);

  return {
    regions,
    actions,
    stats: {
      totalEventsPlanned: plannedEvents.length,
      actionsGenerated: actions.length,
      actionsSkipped,
      groundedOptions,
    },
  };
}
