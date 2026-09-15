import { AnnotationRegion } from '../../types';
import { OCRWord } from './ocrTypes';

/**
 * Normalizes Arabic text for tolerant matching:
 * - Removes Tashkeel (Fatha, Damma, Kasra, Sukun, Shadda, Tanwin)
 * - Removes Tatweel / Kashida
 * - Normalizes Alef variants (إ, أ, آ, ٱ -> ا)
 * - Normalizes Alef Maksura to Ya (ى -> ي)
 * - Normalizes Ta Marbuta to Ha (ة -> ه)
 * - Cleans whitespace and punctuation
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';

  return text
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[“”‘’]/g, '')
    // Remove diacritics / Tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove Tatweel (kashida)
    .replace(/\u0640/g, '')
    // Normalize Alefs
    .replace(/[إأآٱ]/g, 'ا')
    // Normalize Alef Maksura
    .replace(/ى/g, 'ي')
    // Normalize Ta Marbuta
    .replace(/ة/g, 'ه')
    // Normalize hamzas
    .replace(/[ؤئ]/g, 'ء')
    // Remove standard punctuation
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, '')
    // Collapse whitespace
    .replace(/[،؛؟]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts candidate Arabic words or multi-word phrases from solution text.
 */
export function extractArabicPhrases(solutionText: string): string[] {
  if (!solutionText) return [];

  // Match sequences of Arabic Unicode characters
  const arabicRegex = /[\u0600-\u06FF]+(?:[ \t]+[\u0600-\u06FF]+)*/g;
  const matches = solutionText.match(arabicRegex) || [];

  // Clean and filter out tiny 1-character fragments
  const cleaned: string[] = [];
  for (const m of matches) {
    const trimmed = m.trim();
    if (trimmed.length >= 2) {
      cleaned.push(trimmed);
    }
  }

  // Return unique phrases, longest first to prioritize multi-word matches
  return Array.from(new Set(cleaned)).sort((a, b) => b.length - a.length);
}

export interface ArabicMatchResult {
  phrase: string;
  region: AnnotationRegion;
  matchedWords: OCRWord[];
}

/**
 * Searches for Arabic expressions found in the solution text inside OCR words.
 * If a confident match exists, creates a visual AnnotationRegion using its OCR bounding box.
 * If no confident match exists, returns null (never guesses approximate screen positions).
 */
/** Group by visual baseline first; pairwise y/x sorting is not transitive. */
export function groupOcrWordsIntoLines(words: OCRWord[]): OCRWord[][] {
  const rows: OCRWord[][] = [];
  for (const word of [...words].sort((a, b) => a.y + a.height / 2 - b.y - b.height / 2)) {
    const row = rows.find((items) => {
      const center = items.reduce((sum, item) => sum + item.y + item.height / 2, 0) / items.length;
      return Math.abs(center - word.y - word.height / 2) <= Math.max(word.height, items[0].height) * 0.65;
    });
    if (row) row.push(word); else rows.push([word]);
  }
  return rows.map((row) => row.sort((a, b) => b.x - a.x));
}

export function findArabicMatchesInOcr(
  solutionText: string,
  ocrWords: OCRWord[]
): ArabicMatchResult[] {
  const phrases = extractArabicPhrases(solutionText);
  if (!phrases.length || !ocrWords.length) return [];
  // Arabic phrases read right-to-left even if OCR returned ascending x. Keep
  // physical row identity so a wrapped phrase produces separate underlines.
  const rows = groupOcrWordsIntoLines(ocrWords.filter((word) => /[\u0621-\u064A]/.test(word.text)));
  const tokens = rows.flatMap((row, rowIndex) => row.flatMap((word) =>
    normalizeArabic(word.text).split(' ').filter(Boolean).map((norm) => ({ norm, word, rowIndex }))));
  const results: ArabicMatchResult[] = [];
  let matchIndex = 0;
  for (const phrase of phrases) {
    const expected = normalizeArabic(phrase).split(' ').filter(Boolean);
    if (!expected.length) continue;
    let match: typeof tokens = [];
    for (let i = 0; i <= tokens.length - expected.length; i++) {
      const candidate = tokens.slice(i, i + expected.length);
      if (!candidate.every((token, index) => token.norm === expected[index])) continue;
      const connected = candidate.every((token, index) => {
        if (!index) return true;
        const previous = candidate[index - 1];
        if (token.rowIndex === previous.rowIndex) {
          return previous.word.x - (token.word.x + token.word.width) <= 0.14;
        }
        return token.rowIndex === previous.rowIndex + 1 &&
          token.word.y - previous.word.y < Math.max(token.word.height, previous.word.height) * 2.8;
      });
      if (connected) { match = candidate; break; }
    }
    if (!match.length) continue;
    matchIndex++;
    const rowIds = [...new Set(match.map((token) => token.rowIndex))];
    for (const [lineIndex, rowId] of rowIds.entries()) {
      const matchedWords = [...new Set(match.filter((token) => token.rowIndex === rowId).map((token) => token.word))];
      const x = Math.max(0, Math.min(...matchedWords.map((word) => word.x)) - 0.005);
      const y = Math.max(0, Math.min(...matchedWords.map((word) => word.y)) - 0.004);
      const right = Math.min(1, Math.max(...matchedWords.map((word) => word.x + word.width)) + 0.005);
      const bottom = Math.min(1, Math.max(...matchedWords.map((word) => word.y + word.height)) + 0.004);
      results.push({ phrase, matchedWords, region: {
        id: `arabic-phrase-${matchIndex}-line-${lineIndex + 1}`,
        label: `Arapça: "${phrase}"${rowIds.length > 1 ? ` (${lineIndex + 1})` : ''}`,
        type: expected.length > 1 ? 'phrase' : 'word', x, y, width: right - x, height: bottom - y,
        content: phrase,
      } });
    }
  }
  return results;
}
