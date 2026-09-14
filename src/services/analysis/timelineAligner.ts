import { VideoAction, NarrationWord } from '../../types';
import { SemanticParsedEvent } from './solutionParser';

function normalizeTextForMatching(str: string): string {
  if (!str) return '';
  return str
    .toLocaleLowerCase('tr-TR')
    .replace(/['’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenMatches(spoken: string, expected: string): boolean {
  if (!spoken || !expected) return false;
  if (spoken === expected) return true;

  // Turkish inflections are common in natural narration. Prefix matching works
  // well for "seçeneği / seçeneğini", "eliyoruz / eleyebiliriz" etc. while
  // avoiding very short accidental matches.
  const minLen = Math.min(spoken.length, expected.length);
  if (minLen >= 4 && (spoken.startsWith(expected) || expected.startsWith(spoken))) {
    return true;
  }
  return false;
}

function findPhraseTimestampInWords(
  phrase: string,
  words: NarrationWord[],
  searchStartIndex = 0
): { start: number; end: number; startWordIndex: number; endWordIndex: number } | null {
  if (!phrase || words.length === 0) return null;

  const phraseTokens = normalizeTextForMatching(phrase).split(' ').filter(Boolean);
  if (phraseTokens.length === 0) return null;

  const normWords = words.map((w) => normalizeTextForMatching(w.text));
  const safeStart = Math.max(0, Math.min(searchStartIndex, Math.max(0, words.length - 1)));

  // Exact/sequential phrase search first.
  for (let i = safeStart; i <= normWords.length - phraseTokens.length; i++) {
    let matches = true;
    for (let j = 0; j < phraseTokens.length; j++) {
      if (!tokenMatches(normWords[i + j], phraseTokens[j])) {
        matches = false;
        break;
      }
    }

    if (matches) {
      const endIndex = i + phraseTokens.length - 1;
      return {
        start: words[i].start,
        end: words[endIndex].end,
        startWordIndex: i,
        endWordIndex: endIndex,
      };
    }
  }

  // Keyword fallback for a phrase whose exact inflection differs from TTS text.
  const usefulTokens = phraseTokens.filter((token) => token.length >= 4);
  for (let i = safeStart; i < normWords.length; i++) {
    if (usefulTokens.some((token) => tokenMatches(normWords[i], token))) {
      return {
        start: words[i].start,
        end: words[i].end,
        startWordIndex: i,
        endWordIndex: i,
      };
    }
  }

  return null;
}

function getDefaultActionDuration(actionType: SemanticParsedEvent['actionType'], remaining: number): number {
  if (actionType === 'focus') return Math.min(2.8, Math.max(1.2, remaining));
  if (actionType === 'reject' || actionType === 'correct') return Math.max(0.4, remaining);
  if (actionType === 'underline' || actionType === 'highlight') return Math.min(3.6, Math.max(1.0, remaining));
  if (actionType === 'dim-others') return Math.min(3.0, Math.max(1.0, remaining));
  return Math.min(2.5, Math.max(0.8, remaining));
}

/**
 * Align semantic animation events with real ElevenLabs / local Whisper word
 * timestamps. The output is deterministic and never lets a later event jump
 * backwards in time. Focus + reject/check pairs are intentionally kept close
 * together instead of being spread across the whole narration.
 */
export function alignEventsWithNarration(
  events: SemanticParsedEvent[],
  words: NarrationWord[] = [],
  totalDuration = 15
): VideoAction[] {
  const actions: VideoAction[] = [];
  const duration = Math.max(2, totalDuration);

  if (events.length === 0) return actions;

  let nextSearchWordIndex = 0;
  let lastTimestamp = 0.15;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const previousEvent = i > 0 ? events[i - 1] : null;
    const previousAction = actions.length > 0 ? actions[actions.length - 1] : null;
    let startTimestamp: number | null = null;

    if (words.length > 0) {
      const match = findPhraseTimestampInWords(
        ev.semanticTriggerPhrase,
        words,
        nextSearchWordIndex
      );

      if (match) {
        startTimestamp = Math.max(0.05, match.start - 0.06);
        nextSearchWordIndex = Math.min(words.length, match.endWordIndex + 1);
      }
    }

    // A focus + reject/correct pair can legitimately share the same spoken
    // phrase (e.g. "Doğru cevabımız C"). Keep the mark 320ms after focus.
    const isPairedMark =
      previousEvent &&
      previousAction &&
      previousEvent.targetRegionId === ev.targetRegionId &&
      previousEvent.actionType === 'focus' &&
      (ev.actionType === 'reject' || ev.actionType === 'correct');

    if (startTimestamp === null && isPairedMark) {
      startTimestamp = previousAction.start + 0.32;
    }

    if (startTimestamp === null) {
      const fraction = (i + 1) / (events.length + 1);
      startTimestamp = fraction * Math.max(1, duration - 0.8);
    }

    // Preserve chronology with only a small nudge. Do not shove events several
    // seconds away from the phrase just because two events are close together.
    const minGap = isPairedMark ? 0.28 : 0.12;
    if (startTimestamp <= lastTimestamp) {
      startTimestamp = lastTimestamp + minGap;
    }

    startTimestamp = Math.min(Math.max(0.05, startTimestamp), Math.max(0.05, duration - 0.2));
    lastTimestamp = startTimestamp;

    const remaining = Math.max(0.3, duration - startTimestamp);
    const actionDuration = getDefaultActionDuration(ev.actionType, remaining);
    const endTimestamp = Math.min(duration, startTimestamp + actionDuration);

    actions.push({
      id: `act-${i + 1}-${ev.targetRegionId}-${ev.actionType}`,
      targetRegionId: ev.targetRegionId,
      regionId: ev.targetRegionId,
      type: ev.actionType,
      start: Number(startTimestamp.toFixed(2)),
      startTime: Number(startTimestamp.toFixed(2)),
      duration: Number(Math.max(0.2, endTimestamp - startTimestamp).toFixed(2)),
      label: `${ev.actionType}: ${ev.semanticTriggerPhrase}`,
    });
  }

  return actions.sort((a, b) => a.start - b.start);
}
