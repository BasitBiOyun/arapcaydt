import { VideoAction, NarrationWord } from '../../types';
import { SemanticParsedEvent } from './solutionParser';

function normalizeTextForMatching(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches for a sequence of trigger words in the spoken NarrationWord array.
 * Returns the matching word or null.
 */
function findPhraseTimestampInWords(
  phrase: string,
  words: NarrationWord[],
  searchStartIndex = 0
): { start: number; end: number; wordIndex: number } | null {
  if (!phrase || words.length === 0) return null;

  const phraseNorm = normalizeTextForMatching(phrase);
  const phraseTokens = phraseNorm.split(' ').filter(Boolean);
  if (phraseTokens.length === 0) return null;

  // Normalized representation of spoken words
  const normWords = words.map((w) => ({
    original: w,
    norm: normalizeTextForMatching(w.text),
  }));

  // 1. Multi-token sequential search starting from searchStartIndex
  for (let i = searchStartIndex; i <= normWords.length - phraseTokens.length; i++) {
    let matches = true;
    for (let j = 0; j < phraseTokens.length; j++) {
      const pToken = phraseTokens[j];
      const wToken = normWords[i + j].norm;

      // Match exact token or prefix/suffix stem
      if (
        wToken !== pToken &&
        !wToken.startsWith(pToken) &&
        !pToken.startsWith(wToken)
      ) {
        matches = false;
        break;
      }
    }

    if (matches) {
      const firstWord = words[i];
      const lastWord = words[i + phraseTokens.length - 1];
      return {
        start: firstWord.start,
        end: lastWord.end,
        wordIndex: i,
      };
    }
  }

  // 2. Fallback: Search for primary keyword (e.g. "eliyoruz", "doğru", "yanlış", "seçeneği")
  for (let i = searchStartIndex; i < normWords.length; i++) {
    for (const pToken of phraseTokens) {
      if (pToken.length >= 4 && (normWords[i].norm.includes(pToken) || pToken.includes(normWords[i].norm))) {
        return {
          start: words[i].start,
          end: words[i].end,
          wordIndex: i,
        };
      }
    }
  }

  return null;
}

/**
 * Aligns semantic events with spoken word timestamps from ElevenLabs or local Whisper.
 * Guarantees monotonic, real-time timestamps and appropriate action durations.
 */
export function alignEventsWithNarration(
  events: SemanticParsedEvent[],
  words: NarrationWord[] = [],
  totalDuration = 15
): VideoAction[] {
  const actions: VideoAction[] = [];
  const duration = Math.max(2, totalDuration);

  if (events.length === 0) {
    return actions;
  }

  let lastMatchedWordIndex = 0;
  let lastTimestamp = 0.5;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    let startTimestamp: number | null = null;

    // Search for trigger phrase in spoken audio words
    if (words.length > 0) {
      const match = findPhraseTimestampInWords(
        ev.semanticTriggerPhrase,
        words,
        lastMatchedWordIndex
      );

      if (match) {
        // Anticipate by 0.08s so visual element appears right as the teacher starts speaking the phrase
        startTimestamp = Math.max(0.1, match.start - 0.08);
        lastMatchedWordIndex = match.wordIndex;
      }
    }

    // Fallback if not matched: progressive linear interpolation
    if (startTimestamp === null || startTimestamp < lastTimestamp) {
      const fraction = (i + 1) / (events.length + 1);
      startTimestamp = Math.max(lastTimestamp + 0.5, parseFloat((fraction * duration * 0.9).toFixed(2)));
    }

    // Enforce bounds
    startTimestamp = Math.min(duration - 0.5, Math.max(0.2, startTimestamp));
    lastTimestamp = startTimestamp;

    // Compute appropriate duration based on action type
    let actionDuration = 3.0;

    if (ev.actionType === 'focus') {
      // Focus lasts until next event or default 3.5s
      actionDuration = 3.5;
    } else if (ev.actionType === 'reject') {
      // Rejection X stays visible on the option until end of video
      actionDuration = Math.max(2.0, duration - startTimestamp);
    } else if (ev.actionType === 'correct') {
      // Correct checkmark stays visible until end of video
      actionDuration = Math.max(2.0, duration - startTimestamp);
    } else if (ev.actionType === 'underline' || ev.actionType === 'highlight') {
      actionDuration = 4.0;
    }

    const endTimestamp = Math.min(duration, startTimestamp + actionDuration);

    const action: VideoAction = {
      id: `act-${i + 1}-${ev.targetRegionId}-${ev.actionType}`,
      targetRegionId: ev.targetRegionId,
      regionId: ev.targetRegionId,
      type: ev.actionType,
      start: parseFloat(startTimestamp.toFixed(2)),
      startTime: parseFloat(startTimestamp.toFixed(2)),
      duration: parseFloat((endTimestamp - startTimestamp).toFixed(2)),
      label: `${ev.actionType}: ${ev.semanticTriggerPhrase}`,
    };

    actions.push(action);
  }

  // Sort actions deterministically by start time
  actions.sort((a, b) => a.start - b.start);

  return actions;
}
