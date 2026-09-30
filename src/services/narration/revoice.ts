import type { NarrationWord, VideoAction, VideoCaption } from '../../types';
import { alignSolutionNarration } from '../analysis/timelineAligner';
import { splitNarration } from './narrationParts';

/**
 * Re-voicing only a wrong or skipped place: the teacher picks sentences (or a part of a long
 * solution), only that text is voiced again, and the new audio replaces that stretch of the
 * narration. Everything after it moves by the difference; the rest of the voice stays as it is.
 */

export interface TextRange { from: number; to: number; text: string }

/** The solution's sentences (and lines), with their place in the text. */
export function sentenceRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  let start = 0;
  const close = (end: number) => {
    const raw = text.slice(start, end);
    const from = start + raw.length - raw.trimStart().length, to = start + raw.trimEnd().length;
    if (/[\p{L}\p{N}]/u.test(raw)) ranges.push({ from, to, text: text.slice(from, to) });
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') { close(i + 1); continue; }
    if (!'.!?؟…'.includes(c)) continue;
    let j = i;
    while (j + 1 < text.length && '.!?؟…'.includes(text[j + 1])) j++;
    if (j + 1 < text.length && !/\s/.test(text[j + 1])) { i = j; continue; }
    // "3." or "I." (a number or a single capital before the dot) does not end a sentence.
    const word = /(\S+)$/.exec(text.slice(start, i))?.[1] ?? '';
    if (c === '.' && j === i && (/^\d+$/.test(word) || /^[IVX]+$|^[A-ZÇĞİÖŞÜ]$/u.test(word))) { i = j; continue; }
    close(j + 1);
    i = j;
  }
  close(text.length);
  return ranges;
}

/** The parts a long solution is voiced in (as in narrationParts), with their place in the text. */
export function partRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  let at = 0;
  for (const part of splitNarration(text)) {
    const words = part.split(/\s+/);
    const from = text.indexOf(words[0], at);
    const lastWord = words[words.length - 1];
    const to = text.indexOf(lastWord, Math.max(from, from + part.length - lastWord.length - 50)) + lastWord.length;
    if (from < 0 || to < from) return [];
    ranges.push({ from, to, text: text.slice(from, to) });
    at = to;
  }
  return ranges;
}

/** Sentences touched by a stretch of text, as one range from the first to the last. */
export function wholeSentences(text: string, from: number, to: number): TextRange | null {
  const hit = sentenceRanges(text).filter(s => s.to > from && s.from < Math.max(to, from + 1));
  if (!hit.length) return null;
  const start = hit[0].from, end = hit[hit.length - 1].to;
  return { from: start, to: end, text: text.slice(start, end) };
}

export interface SpokenSpan {
  /** Where the new audio goes in (seconds): in the pauses around the sentences. */
  start: number;
  end: number;
  /** No word of the range was heard: the new audio is inserted, nothing is taken out. */
  skipped: boolean;
}

/**
 * Where a stretch of the solution is in the narration, from the word timings: cut in the middle
 * of the pause before its first heard word and after its last. A stretch the voice skipped gets
 * a single point between the words around it.
 */
export function spokenSpan(solutionText: string, words: NarrationWord[], duration: number, range: { from: number; to: number }): SpokenSpan | null {
  const aligned = alignSolutionNarration(solutionText, words, duration).words;
  if (!aligned.length || !aligned.some(w => w.matched)) return null;
  const inside = aligned.filter(w => w.sourceStart >= range.from && w.sourceEnd <= range.to && w.matched);
  const before = [...aligned].reverse().find(w => w.sourceEnd <= range.from && w.matched);
  const after = aligned.find(w => w.sourceStart >= range.to && w.matched);
  const mid = (a: number, b: number) => (a + b) / 2;
  if (!inside.length) {
    const at = mid(before?.end ?? 0, after?.start ?? duration);
    return { start: at, end: at, skipped: true };
  }
  const first = inside[0], last = inside[inside.length - 1];
  return {
    start: before ? mid(before.end, first.start) : Math.max(0, first.start - 0.05),
    end: after ? mid(last.end, after.start) : duration,
    skipped: false,
  };
}

/** Samples below this level (about 1% of full scale) count as silence. */
const QUIET = 0.012;
const PAUSE = 0.18;
const FADE = 0.012;

function trimSilence(samples: Float32Array, rate: number): Float32Array {
  let a = 0, b = samples.length;
  while (a < b && Math.abs(samples[a]) < QUIET) a++;
  while (b > a && Math.abs(samples[b - 1]) < QUIET) b--;
  // Keep a breath of the fade-in and fade-out.
  const keep = Math.round(0.03 * rate);
  return samples.subarray(Math.max(0, a - keep), Math.min(samples.length, b + keep));
}

/**
 * The narration with [start, end] replaced by the new audio (its own silences trimmed, a short
 * pause on each side, soft edges so no click is heard). Returns where the new audio sits and
 * how much everything after `end` moved.
 */
export function spliceAudio(base: Float32Array, insert: Float32Array, rate: number, start: number, end: number) {
  const cutA = Math.max(0, Math.min(base.length, Math.round(start * rate)));
  const cutB = Math.max(cutA, Math.min(base.length, Math.round(end * rate)));
  const voice = trimSilence(insert, rate);
  const pause = Math.round(PAUSE * rate), fade = Math.round(FADE * rate);
  const out = new Float32Array(cutA + pause + voice.length + pause + (base.length - cutB));
  out.set(base.subarray(0, cutA), 0);
  out.set(voice, cutA + pause);
  out.set(base.subarray(cutB), cutA + pause + voice.length + pause);
  const soften = (at: number, rising: boolean) => {
    for (let i = 0; i < fade; i++) {
      const k = at + (rising ? i : -i - 1);
      if (k >= 0 && k < out.length) out[k] *= i / fade;
    }
  };
  soften(cutA, false); soften(cutA + pause, true); soften(cutA + pause + voice.length, false);
  soften(cutA + pause + voice.length + pause, true);
  const newStart = cutA / rate, newEnd = (cutA + pause * 2 + voice.length) / rate;
  return { samples: out, newStart, newEnd, shift: newEnd - cutB / rate };
}

/** A time on the old narration, placed on the new one. */
export function movedTime(t: number, start: number, end: number, newStart: number, newEnd: number): number {
  if (t <= start) return t;
  if (t >= end) return t + (newEnd - end);
  return end > start ? newStart + ((t - start) / (end - start)) * (newEnd - newStart) : newStart;
}

/** Marks, captions and word timings moved to the new narration; the teacher's edits stay. */
export function moveTimeline(
  change: { start: number; end: number; newStart: number; newEnd: number },
  actions: VideoAction[] = [], captions: VideoCaption[] = [], words: NarrationWord[] = [],
) {
  const at = (t: number) => movedTime(t, change.start, change.end, change.newStart, change.newEnd);
  return {
    actions: actions.map(a => {
      const start = at(a.start);
      const end = at(a.start + a.duration);
      return { ...a, start, ...(a.startTime !== undefined ? { startTime: start } : {}), duration: Math.max(0.3, end - start) };
    }),
    captions: captions.map(c => ({ ...c, start: at(c.start), end: at(c.end), words: c.words?.map(w => ({ ...w, start: at(w.start), end: at(w.end) })) })),
    // Words of the replaced stretch are dropped; the new timing is taken from the whole narration.
    words: words.filter(w => w.end <= change.start || w.start >= change.end).map(w => ({ ...w, start: at(w.start), end: at(w.end) })),
  };
}
