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
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts candidate Arabic words or multi-word phrases from solution text.
 */
export function extractArabicPhrases(solutionText: string): string[] {
  if (!solutionText) return [];

  // Match sequences of Arabic Unicode characters
  const arabicRegex = /[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*/g;
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
export function findArabicMatchesInOcr(
  solutionText: string,
  ocrWords: OCRWord[]
): ArabicMatchResult[] {
  const phrases = extractArabicPhrases(solutionText);
  if (phrases.length === 0 || ocrWords.length === 0) return [];

  const results: ArabicMatchResult[] = [];
  const normalizedOcrWords = ocrWords.map((w) => ({
    original: w,
    norm: normalizeArabic(w.text),
  }));

  let matchIndex = 1;

  for (const phrase of phrases) {
    const normPhrase = normalizeArabic(phrase);
    if (!normPhrase || normPhrase.length < 2) continue;

    const phraseTokens = normPhrase.split(' ').filter(Boolean);
    if (phraseTokens.length === 0) continue;

    // Search for sequence of matching tokens in OCR
    let matchedOcrWords: OCRWord[] = [];

    if (phraseTokens.length === 1) {
      // Single word match
      const target = phraseTokens[0];
      const match = normalizedOcrWords.find((item) => item.norm === target || (target.length >= 4 && item.norm.includes(target)));
      if (match) {
        matchedOcrWords = [match.original];
      }
    } else {
      // Multi-word sequence match
      for (let i = 0; i <= normalizedOcrWords.length - phraseTokens.length; i++) {
        let allMatch = true;
        for (let j = 0; j < phraseTokens.length; j++) {
          const expected = phraseTokens[j];
          const actual = normalizedOcrWords[i + j].norm;
          if (actual !== expected && !(expected.length >= 4 && actual.includes(expected))) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          matchedOcrWords = normalizedOcrWords.slice(i, i + phraseTokens.length).map((item) => item.original);
          break;
        }
      }
    }

    // Only create a visual region if a confident OCR match exists
    if (matchedOcrWords.length > 0) {
      const minX = Math.max(0.01, Math.min(...matchedOcrWords.map((w) => w.x)) - 0.008);
      const minY = Math.max(0.01, Math.min(...matchedOcrWords.map((w) => w.y)) - 0.005);
      const maxX = Math.min(0.99, Math.max(...matchedOcrWords.map((w) => w.x + w.width)) + 0.008);
      const maxY = Math.min(0.99, Math.max(...matchedOcrWords.map((w) => w.y + w.height)) + 0.005);

      const region: AnnotationRegion = {
        id: `arabic-phrase-${matchIndex++}`,
        label: `Arapça: "${phrase}"`,
        type: phraseTokens.length > 1 ? 'phrase' : 'word',
        x: parseFloat(minX.toFixed(4)),
        y: parseFloat(minY.toFixed(4)),
        width: parseFloat((maxX - minX).toFixed(4)),
        height: parseFloat((maxY - minY).toFixed(4)),
        content: phrase,
      };

      results.push({
        phrase,
        region,
        matchedWords: matchedOcrWords,
      });
    }
  }

  return results;
}
