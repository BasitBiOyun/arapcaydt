import { AnnotationRegion } from '../../types';
import { OCRResult, OCRWord } from './ocrTypes';

interface DetectedOptionMarker {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  word: OCRWord;
  y: number;
}

/**
 * Matches YDT option indicators:
 * Standard Latin: A), (A), A., [A], A-, A:
 * Arabic equivalents: أ), ب), ج), د), هـ)
 */
function matchOptionLetter(text: string): 'A' | 'B' | 'C' | 'D' | 'E' | null {
  const cleaned = text.trim();

  // Single word checks: "A)", "B)", "(C)", "D.", "E"
  const latinMatch = cleaned.match(/^[\(\[]?([A-Ea-e])[\)\.\:\-\]]?$/);
  if (latinMatch) {
    return latinMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
  }

  // Prefix match: "A)...", "B) ..."
  const prefixMatch = cleaned.match(/^([A-Ea-e])[\)\.\:\-\]]/);
  if (prefixMatch) {
    return prefixMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
  }

  // Arabic letter markers
  if (/^[\(\[]?[أا][\)\.\:\-\]]?$/.test(cleaned)) return 'A';
  if (/^[\(\[]?[ب][\)\.\:\-\]]?$/.test(cleaned)) return 'B';
  if (/^[\(\[]?[ج][\)\.\:\-\]]?$/.test(cleaned)) return 'C';
  if (/^[\(\[]?[د][\)\.\:\-\]]?$/.test(cleaned)) return 'D';
  if (/^[\(\[]?[هـه][\)\.\:\-\]]?$/.test(cleaned)) return 'E';

  return null;
}

export function detectYdtQuestionRegions(ocr: OCRResult): {
  regions: AnnotationRegion[];
  detectedOptions: string[];
  questionPromptRegion?: AnnotationRegion;
} {
  const regions: AnnotationRegion[] = [];
  const words = ocr.words;

  if (!words || words.length === 0) {
    return { regions, detectedOptions: [] };
  }

  // 1. Find option marker candidates
  const markerCandidates: DetectedOptionMarker[] = [];

  for (const word of words) {
    const letter = matchOptionLetter(word.text);
    if (letter) {
      // In YDT layout, options appear in the middle to lower half of the page
      // And option markers are typically on the left side (x < 0.40) or right side (for RTL option letters, x > 0.60)
      markerCandidates.push({
        letter,
        word,
        y: word.y,
      });
    }
  }

  // Sort candidates by vertical position y
  markerCandidates.sort((a, b) => a.y - b.y);

  // 2. Select the most consistent sequential sequence A -> B -> C -> D -> E
  const targetLetters: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];
  const finalMarkers = new Map<'A' | 'B' | 'C' | 'D' | 'E', DetectedOptionMarker>();

  for (const letter of targetLetters) {
    // Find candidates for this letter that appear below previous letter's y
    const previousLetter = letter === 'A' ? null : targetLetters[targetLetters.indexOf(letter) - 1];
    const prevY = previousLetter && finalMarkers.has(previousLetter)
      ? finalMarkers.get(previousLetter)!.y
      : 0.15; // Options generally start below 15% from top

    const validCandidate = markerCandidates.find(
      (c) => c.letter === letter && c.y > prevY - 0.02
    );

    if (validCandidate) {
      finalMarkers.set(letter, validCandidate);
    }
  }

  // 3. Question Prompt / Sentence region (words above Option A)
  const markerA = finalMarkers.get('A');
  const cutoffY = markerA ? markerA.y : 0.45;

  const promptWords = words.filter((w) => w.y < cutoffY - 0.015 && w.y > 0.04);
  if (promptWords.length >= 3) {
    const minX = Math.max(0.02, Math.min(...promptWords.map((w) => w.x)) - 0.015);
    const minY = Math.max(0.02, Math.min(...promptWords.map((w) => w.y)) - 0.01);
    const maxX = Math.min(0.98, Math.max(...promptWords.map((w) => w.x + w.width)) + 0.015);
    const maxY = Math.min(cutoffY - 0.01, Math.max(...promptWords.map((w) => w.y + w.height)) + 0.01);

    const questionRegion: AnnotationRegion = {
      id: 'question-root',
      label: 'Soru Kökü / Metin',
      type: 'paragraph',
      x: parseFloat(minX.toFixed(4)),
      y: parseFloat(minY.toFixed(4)),
      width: parseFloat((maxX - minX).toFixed(4)),
      height: parseFloat((maxY - minY).toFixed(4)),
      content: promptWords.map((w) => w.text).join(' '),
    };
    regions.push(questionRegion);
  }

  // 4. Compute bounding boxes for each detected option
  const detectedOptions: string[] = [];

  for (let i = 0; i < targetLetters.length; i++) {
    const letter = targetLetters[i];
    const marker = finalMarkers.get(letter);
    if (!marker) continue;

    const nextLetter = targetLetters[i + 1];
    const nextMarker = nextLetter ? finalMarkers.get(nextLetter) : null;

    const startY = marker.y - 0.008;
    let endY: number;

    if (nextMarker) {
      endY = nextMarker.y - 0.008;
    } else {
      // For the last option (E), find words below marker.y
      const optionEWords = words.filter(
        (w) => w.y >= startY && w.y <= marker.y + 0.18
      );
      if (optionEWords.length > 0) {
        endY = Math.min(0.98, Math.max(...optionEWords.map((w) => w.y + w.height)) + 0.015);
      } else {
        endY = Math.min(0.98, marker.y + 0.08);
      }
    }

    // Find all words inside this vertical band
    const optionWords = words.filter(
      (w) => w.y >= startY - 0.005 && w.y <= endY + 0.005
    );

    let minX: number;
    let maxX: number;

    if (optionWords.length > 0) {
      minX = Math.max(0.04, Math.min(...optionWords.map((w) => w.x)) - 0.015);
      maxX = Math.min(0.96, Math.max(...optionWords.map((w) => w.x + w.width)) + 0.02);
      // Ensure reasonable width for full option line in YDT layout
      if (maxX - minX < 0.65) {
        maxX = Math.min(0.96, minX + 0.85);
      }
    } else {
      minX = Math.max(0.04, marker.word.x - 0.015);
      maxX = 0.94;
    }

    const regionHeight = Math.max(0.035, endY - startY);

    const optionRegion: AnnotationRegion = {
      id: `option-${letter.toLowerCase()}`,
      label: `${letter} Seçeneği`,
      type: 'option',
      x: parseFloat(minX.toFixed(4)),
      y: parseFloat(startY.toFixed(4)),
      width: parseFloat((maxX - minX).toFixed(4)),
      height: parseFloat(regionHeight.toFixed(4)),
      content: optionWords.map((w) => w.text).join(' '),
    };

    regions.push(optionRegion);
    detectedOptions.push(letter);
  }

  return {
    regions,
    detectedOptions,
    questionPromptRegion: regions.find((r) => r.id === 'question-root'),
  };
}

/**
 * Deterministic standard YDT Arabic question geometry for fallback situations.
 */
export function getYdtStandardGeometry(): AnnotationRegion[] {
  return [
    {
      id: 'question-root',
      label: 'Soru Kökü',
      type: 'question-root',
      x: 0.05,
      y: 0.06,
      width: 0.90,
      height: 0.32,
      content: 'Soru Metni ve Paragrafı',
    },
    {
      id: 'option-a',
      label: 'A Seçeneği',
      type: 'option',
      x: 0.05,
      y: 0.42,
      width: 0.90,
      height: 0.09,
      content: 'A Şıkkı',
    },
    {
      id: 'option-b',
      label: 'B Seçeneği',
      type: 'option',
      x: 0.05,
      y: 0.53,
      width: 0.90,
      height: 0.09,
      content: 'B Şıkkı',
    },
    {
      id: 'option-c',
      label: 'C Seçeneği',
      type: 'option',
      x: 0.05,
      y: 0.64,
      width: 0.90,
      height: 0.09,
      content: 'C Şıkkı',
    },
    {
      id: 'option-d',
      label: 'D Seçeneği',
      type: 'option',
      x: 0.05,
      y: 0.75,
      width: 0.90,
      height: 0.09,
      content: 'D Şıkkı',
    },
    {
      id: 'option-e',
      label: 'E Seçeneği',
      type: 'option',
      x: 0.05,
      y: 0.86,
      width: 0.90,
      height: 0.09,
      content: 'E Şıkkı',
    },
  ];
}
