import { VideoAction, NarrationWord } from '../../types';
import { SemanticParsedEvent } from './solutionParser';

export interface SourceNarrationWord extends NarrationWord {
  sourceStart: number;
  sourceEnd: number;
  matched: boolean;
}
export interface AlignedCaption { text: string; start: number; end: number }
export interface SolutionNarrationAlignment {
  words: SourceNarrationWord[];
  captions: AlignedCaption[];
  quality: 'word-aligned' | 'anchored' | 'approximate';
  matchedRatio: number;
}

function normalize(text: string): string {
  return text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i').replace(/ـ/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي');
}

function tokens(text: string) {
  return Array.from(text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’]*/gu), match => ({
    text: match[0], norm: normalize(match[0]).replace(/['’]/g, ''),
    sourceStart: match.index!, sourceEnd: match.index! + match[0].length,
  }));
}

function matches(a: string, b: string): boolean {
  if (a === b) return true;
  if ((a === '1' && b === 'bir') || (b === '1' && a === 'bir')) return true;
  return Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a));
}

/** Tokenize chunk timestamps too. Chunk subdivision remains an estimate. */
function spokenTokens(words: NarrationWord[], duration: number) {
  return words.filter(w => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start && w.start < duration)
    .flatMap(word => {
      const parts = tokens(word.text);
      const weight = parts.reduce((sum, part) => sum + part.norm.length, 0) || 1;
      let consumed = 0;
      return parts.map(part => {
        const start = Math.max(0, word.start + (word.end - word.start) * consumed / weight);
        consumed += part.norm.length;
        return { ...part, start, end: Math.min(duration, word.start + (word.end - word.start) * consumed / weight), exact: parts.length === 1 };
      });
    }).sort((a, b) => a.start - b.start);
}

/**
 * Align the complete supplied script, not just animation triggers. A monotonic
 * sequence match prevents repeated phrases from jumping to the first occurrence.
 * Unrecognized Arabic stays original Unicode; Turkish anchors estimate its time.
 */
export function alignSolutionNarration(
  solutionText: string,
  narration: NarrationWord[] = [],
  totalDuration = 15,
): SolutionNarrationAlignment {
  const duration = Number.isFinite(totalDuration) && totalDuration > 0 ? totalDuration : 15;
  const source = tokens(solutionText);
  const spoken = spokenTokens(narration, duration);
  const anchors = new Map<number, number>();
  // Bound memory for accidentally book-length input. Such inputs explicitly
  // fall back to approximate timing rather than freezing the teacher's browser.
  if (source.length && spoken.length && source.length * spoken.length <= 8_000_000) {
    const cols = spoken.length + 1;
    const table = new Uint16Array((source.length + 1) * cols);
    for (let i = source.length - 1; i >= 0; i--) {
      for (let j = spoken.length - 1; j >= 0; j--) {
        table[i * cols + j] = matches(source[i].norm, spoken[j].norm)
          ? 1 + table[(i + 1) * cols + j + 1]
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
      }
    }
    let i = 0; let j = 0;
    while (i < source.length && j < spoken.length) {
      if (matches(source[i].norm, spoken[j].norm)) { anchors.set(i++, j++); }
      else if (table[(i + 1) * cols + j] > table[i * cols + j + 1]) i++;
      else j++;
    }
  }
  const matchedRatio = source.length ? anchors.size / source.length : 0;
  if (matchedRatio < 0.18) anchors.clear();
  const words: SourceNarrationWord[] = source.map(part => ({ ...part, start: 0, end: 0, matched: false }));
  for (const [i, j] of anchors) {
    words[i].start = spoken[j].start;
    words[i].end = Math.max(spoken[j].start, spoken[j].end);
    words[i].matched = true;
  }
  let previous = -1;
  for (const next of [...anchors.keys(), source.length]) {
    const start = previous >= 0 ? words[previous].end : 0;
    const end = next < source.length ? Math.max(start, words[next].start) : duration;
    const weight = source.slice(previous + 1, next).reduce((sum, part) => sum + Math.max(2, part.norm.length), 0) || 1;
    let consumed = 0;
    for (let i = previous + 1; i < next; i++) {
      words[i].start = start + (end - start) * consumed / weight;
      consumed += Math.max(2, source[i].norm.length);
      words[i].end = start + (end - start) * consumed / weight;
    }
    previous = next;
  }

  // Captions are slices of the original script, never ASR's phonetic Arabic.
  const captions: AlignedCaption[] = [];
  let first = 0;
  let captionStart = 0;
  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1];
    const trailing = solutionText.slice(words[i].sourceEnd, next?.sourceStart ?? solutionText.length);
    const length = words[i].sourceEnd - words[first].sourceStart;
    const split = !next || /[.!?;\n]/.test(trailing) || length >= 85
      || words[i].end - words[first].start >= 5.5;
    if (!split) continue;
    let textEnd = next?.sourceStart ?? solutionText.length;
    if (next) while (textEnd > words[i].sourceEnd && !/\s/.test(solutionText[textEnd - 1])) textEnd--;
    captions.push({
      text: solutionText.slice(captionStart, textEnd).trim(),
      start: words[first].start,
      end: Math.min(duration, Math.max(words[i].end, words[first].start + 0.1)),
    });
    captionStart = textEnd;
    first = i + 1;
  }
  return {
    words, captions,
    quality: anchors.size === 0 ? 'approximate'
      : matchedRatio >= 0.95 && spoken.every(word => word.exact) ? 'word-aligned' : 'anchored',
    matchedRatio: anchors.size ? matchedRatio : 0,
  };
}

function spanTime(words: SourceNarrationWord[], start: number, end: number) {
  const selected = words.filter(word => word.sourceEnd > start && word.sourceStart < end);
  return selected.length ? { start: selected[0].start, end: selected[selected.length - 1].end } : null;
}

/** Preserves the legacy three-argument call; new callers should pass the script. */
export function alignEventsWithNarration(
  events: SemanticParsedEvent[],
  words: NarrationWord[] = [],
  totalDuration = 15,
  solutionText?: string,
): VideoAction[] {
  if (!events.length) return [];
  const duration = Number.isFinite(totalDuration) && totalDuration > 0 ? totalDuration : 15;
  const sourceText = solutionText || events.find(event => event.sourceText)?.sourceText
    || [...new Set(events.map(event => event.sentenceText))].join(' ');
  const alignment = alignSolutionNarration(sourceText, words, duration);
  const timed = events.map(event => {
    const sourceStart = event.sourceStart ?? Math.max(0, sourceText.indexOf(event.semanticTriggerPhrase));
    const sourceEnd = event.sourceEnd ?? sourceStart + event.semanticTriggerPhrase.length;
    const trigger = spanTime(alignment.words, sourceStart, sourceEnd);
    const sentence = spanTime(alignment.words, event.sentenceStart ?? sourceStart, event.sentenceEnd ?? sourceEnd);
    return { event, start: Math.min(duration, Math.max(0, (trigger?.start ?? 0) - 0.04)), end: sentence?.end ?? trigger?.end ?? duration };
  }).sort((a, b) => a.start - b.start || a.event.order - b.event.order);

  return timed.map((item, index) => {
    const { event } = item;
    let start = item.start;
    // Only a genuinely shared answer phrase gets a tiny focus/check stagger.
    // A rejection in a later sentence is tied to that later sentence.
    if (event.actionType === 'correct' && timed.some(other => other.event.actionType === 'focus'
      && other.event.targetRegionId === event.targetRegionId && other.event.sourceStart === event.sourceStart)) {
      start = Math.min(duration, start + 0.18);
    }
    let end = item.end;
    if (event.actionType === 'reject' || event.actionType === 'correct') end = duration;
    else if (event.actionType === 'focus') {
      const next = timed.slice(index + 1).find(other =>
        (other.event.actionType === 'focus' && other.event.targetRegionId !== event.targetRegionId)
        || (other.event.targetRegionId === event.targetRegionId && ['reject', 'correct'].includes(other.event.actionType)));
      end = next ? next.start + (next.event.actionType === 'correct' && next.event.sourceStart === event.sourceStart ? 0.18 : 0) : duration;
    } else if (event.actionType === 'highlight' || event.actionType === 'underline') {
      const next = timed.find(other => other.start > start + 0.05
        && ['highlight', 'underline', 'focus'].includes(other.event.actionType));
      end = Math.min(Math.max(item.end, start + 0.7), next?.start ?? duration);
    }
    end = Math.min(duration, Math.max(start, end));
    return {
      id: `act-${index + 1}-${event.targetRegionId}-${event.actionType}`,
      targetRegionId: event.targetRegionId, regionId: event.targetRegionId,
      type: event.actionType, start, startTime: start, duration: end - start,
      label: `${event.actionType}: ${event.semanticTriggerPhrase}`,
    };
  }).filter(action => action.duration > 0).sort((a, b) => a.start - b.start);
}
