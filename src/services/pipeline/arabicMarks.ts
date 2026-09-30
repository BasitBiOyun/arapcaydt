import type { AnnotationRegion } from '../../types';
import type { OCRWord } from '../ocr/ocrTypes';
import { findBestArabicMatches } from '../ocr/arabicMatcher';
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
export function planArabicMarks(solutionText: string, stemWords: OCRWord[], arabicStemWords?: OCRWord[], suppressed: ReadonlySet<string> = new Set()) {
  const passageMatches = findPassageMatches(solutionText, stemWords, arabicStemWords);
  const passageRanges = [...new Map(passageMatches.map(m => [m.passageEnd, m])).values()]
    .map(m => [Math.min(...passageMatches.filter(o => o.passageEnd === m.passageEnd).map(o => o.sourceStart)), m.passageEnd] as const);
  const withoutPassages = passageRanges.reduce((text, [from, to]) => text.slice(0, from) + ' '.repeat(to - from) + text.slice(to), solutionText);
  const arabicMatches = [
    ...passageMatches,
    ...withTolerantPhrases(withoutPassages, withPassageReferences(withoutPassages,
      findBestArabicMatches(withoutPassages, stemWords, arabicStemWords, passageMatches.flatMap(m => m.matchedWords)), passageMatches), stemWords),
  ].filter(m => !suppressed.has(m.region.id) || m.region.id.startsWith('arabic-passage-'));
  return { passageMatches, arabicMatches };
}
