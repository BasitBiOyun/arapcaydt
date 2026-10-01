import type { AnnotationRegion } from '../../types';
import type { OCRWord } from '../ocr/ocrTypes';
import { findBestArabicMatches, normalizeArabic } from '../ocr/arabicMatcher';
import { findPassageMatches, withPassageReferences, withTolerantPhrases } from '../ocr/passageMatcher';

/** The words whose middle is outside every given box (the question text without its options). */
export function wordsOutside(words: OCRWord[], boxes: Pick<AnnotationRegion, 'x' | 'y' | 'width' | 'height'>[]): OCRWord[] {
  return words.filter(w => !boxes.some(r => w.x + w.width / 2 >= r.x && w.x + w.width / 2 <= r.x + r.width
    && w.y + w.height / 2 >= r.y && w.y + w.height / 2 <= r.y + r.height));
}

/**
 * Where the solution's Arabic is underlined on the question text. A passage read in full is found
 * as a whole (one underline per printed line); the shorter phrases are looked for without it, and a
 * later mention of its words points into it. Removed marks stay removed, except passage lines.
 */
/** Where `phrase` is read in the solution, each time. */
const occurrences = (text: string, phrase: string) => {
  const at: number[] = [];
  for (let i = text.indexOf(phrase); i >= 0; i = text.indexOf(phrase, i + 1)) at.push(i);
  return at;
};
/** Read as an option ("A) …", "A şıkkı: …", "C seçeneğinde …" on the same line just before it). */
const readAsOption = (text: string, at: number) =>
  /(?:(?:^|[\s(])[A-E]\s*[).:-]|[Şş]ıkk|[Ss]eçene)[^\n]{0,60}$/.test(text.slice(Math.max(0, at - 80), at).split('\n').pop() || '');
/** Pointed at the passage ("parçada …", "metinde …") just before it. */
const pointsAtPassage = (text: string, at: number) => /(?:parça|metin|paragraf)[^\n]{0,60}$/i.test(text.slice(Math.max(0, at - 80), at));

/**
 * An option's own sentence read aloud is shown by the option's frame, not underlined where the same
 * words happen to stand in the passage: a phrase is left out when every time it is read it is read
 * as an option, or when it mostly is an option's text and the solution never points at the passage for it.
 */
export function isOptionQuote(text: string, phrase: string, options: Pick<AnnotationRegion, 'content'>[]): boolean {
  const at = occurrences(text, phrase);
  if (!at.length) return false;
  if (at.every(i => readAsOption(text, i))) return true;
  const words = normalizeArabic(phrase).split(' ').filter(Boolean);
  if (words.length < 3 || at.some(i => pointsAtPassage(text, i))) return false;
  return options.some(option => {
    const own = new Set(normalizeArabic(option.content || '').split(' '));
    return words.filter(w => own.has(w)).length >= words.length * .7;
  });
}

export function planArabicMarks(solutionText: string, stemWords: OCRWord[], arabicStemWords?: OCRWord[], suppressed: ReadonlySet<string> = new Set(),
  options: Pick<AnnotationRegion, 'content'>[] = []) {
  const passageMatches = findPassageMatches(solutionText, stemWords, arabicStemWords);
  const passageRanges = [...new Map(passageMatches.map(m => [m.passageEnd, m])).values()]
    .map(m => [Math.min(...passageMatches.filter(o => o.passageEnd === m.passageEnd).map(o => o.sourceStart)), m.passageEnd] as const);
  const withoutPassages = passageRanges.reduce((text, [from, to]) => text.slice(0, from) + ' '.repeat(to - from) + text.slice(to), solutionText);
  const lines = new Set<object>(passageMatches);
  const arabicMatches = [
    ...passageMatches,
    ...withTolerantPhrases(withoutPassages, withPassageReferences(withoutPassages,
      findBestArabicMatches(withoutPassages, stemWords, arabicStemWords, passageMatches.flatMap(m => m.matchedWords)), passageMatches), stemWords),
  ].filter(m => !suppressed.has(m.region.id) || m.region.id.startsWith('arabic-passage-'))
    // Passage lines (the passage read in full) stay; other marks never stand for an option's own text.
    .filter(m => lines.has(m) || !isOptionQuote(solutionText, m.phrase, options));
  return { passageMatches, arabicMatches };
}
