import { AnnotationRegion } from '../../types';
import { OCRResult, OCRWord } from './ocrTypes';

type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

interface DetectedOptionMarker {
  letter: OptionLetter;
  word: OCRWord;
  y: number;
  confidence: number;
}

function matchOptionLetter(text: string): OptionLetter | null {
  const cleaned = text.trim();

  const latinMatch = cleaned.match(/^[\(\[]?([A-Ea-e])[\)\.\:\-\]]?$/);
  if (latinMatch) return latinMatch[1].toUpperCase() as OptionLetter;

  const prefixMatch = cleaned.match(/^[\(\[]?([A-Ea-e])[\)\.\:\-\]]\s*/);
  if (prefixMatch) return prefixMatch[1].toUpperCase() as OptionLetter;

  if (/^[\(\[]?[أا][\)\.\:\-\]]?$/.test(cleaned)) return 'A';
  if (/^[\(\[]?[ب][\)\.\:\-\]]?$/.test(cleaned)) return 'B';
  if (/^[\(\[]?[ج][\)\.\:\-\]]?$/.test(cleaned)) return 'C';
  if (/^[\(\[]?[د][\)\.\:\-\]]?$/.test(cleaned)) return 'D';
  if (/^[\(\[]?[هـه][\)\.\:\-\]]?$/.test(cleaned)) return 'E';

  return null;
}

function addCandidate(
  list: DetectedOptionMarker[],
  letter: OptionLetter,
  word: OCRWord,
  confidenceBonus = 0
) {
  // Header/body noise frequently contains isolated A-E characters. YDT answer
  // choices are expected below the opening question area.
  if (word.y < 0.14 || word.y > 0.98) return;

  const confidence = Math.max(0, Math.min(100, word.confidence + confidenceBonus));
  const duplicate = list.some(
    (c) => c.letter === letter && Math.abs(c.y - word.y) < Math.max(0.008, word.height * 0.6)
  );
  if (!duplicate) list.push({ letter, word, y: word.y, confidence });
}

function collectMarkerCandidates(ocr: OCRResult): DetectedOptionMarker[] {
  const candidates: DetectedOptionMarker[] = [];

  // Word-level markers are the most precise source.
  for (const word of ocr.words || []) {
    const letter = matchOptionLetter(word.text);
    if (letter) addCandidate(candidates, letter, word, 5);
  }

  // Tesseract occasionally merges "A)" with the option text. In that case the
  // line itself still starts with the marker, so use its first word / line bbox.
  for (const line of ocr.lines || []) {
    const letter = matchOptionLetter(line.text);
    if (!letter) continue;

    const firstWord = line.words?.[0];
    const pseudoWord: OCRWord = firstWord || {
      text: line.text,
      confidence: line.confidence,
      x: line.x,
      y: line.y,
      width: Math.min(line.width, 0.08),
      height: line.height,
      pixelX: Math.round(line.x * ocr.imageWidth),
      pixelY: Math.round(line.y * ocr.imageHeight),
      pixelWidth: Math.round(Math.min(line.width, 0.08) * ocr.imageWidth),
      pixelHeight: Math.round(line.height * ocr.imageHeight),
    };
    addCandidate(candidates, letter, pseudoWord, 12);
  }

  return candidates.sort((a, b) => (a.y - b.y) || (b.confidence - a.confidence));
}

function chooseSequentialMarkers(candidates: DetectedOptionMarker[]): Map<OptionLetter, DetectedOptionMarker> {
  const letters: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];
  let best = new Map<OptionLetter, DetectedOptionMarker>();
  let bestScore = -Infinity;

  const aCandidates = candidates.filter((c) => c.letter === 'A');
  const seeds = aCandidates.length > 0 ? aCandidates : [null];

  for (const seed of seeds) {
    const chosen = new Map<OptionLetter, DetectedOptionMarker>();
    let previousY = 0.14;
    let score = 0;

    if (seed) {
      chosen.set('A', seed);
      previousY = seed.y;
      score += 20 + seed.confidence / 10;
    }

    const startIndex = seed ? 1 : 0;
    for (let i = startIndex; i < letters.length; i++) {
      const letter = letters[i];
      const possible = candidates
        .filter((c) => c.letter === letter && c.y > previousY + 0.006)
        .sort((a, b) => {
          const gapA = a.y - previousY;
          const gapB = b.y - previousY;
          // Prefer the nearest plausible next row, then OCR confidence.
          return (gapA - gapB) || (b.confidence - a.confidence);
        });

      const candidate = possible.find((c) => c.y - previousY < 0.24) || possible[0];
      if (!candidate) continue;

      chosen.set(letter, candidate);
      const gap = candidate.y - previousY;
      score += 20 + candidate.confidence / 10 - Math.abs(gap - 0.09) * 20;
      previousY = candidate.y;
    }

    score += chosen.size * 50;
    if (score > bestScore) {
      bestScore = score;
      best = chosen;
    }
  }

  return best;
}

export function detectYdtQuestionRegions(ocr: OCRResult): {
  regions: AnnotationRegion[];
  detectedOptions: string[];
  questionPromptRegion?: AnnotationRegion;
} {
  const regions: AnnotationRegion[] = [];
  const words = ocr.words || [];

  if (words.length === 0) return { regions, detectedOptions: [] };

  const markerCandidates = collectMarkerCandidates(ocr);
  const finalMarkers = chooseSequentialMarkers(markerCandidates);
  const targetLetters: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];

  const firstOption = targetLetters
    .map((letter) => finalMarkers.get(letter))
    .find(Boolean);
  const cutoffY = firstOption?.y ?? 0.48;

  // Question stem / passage above the first detected option.
  const promptWords = words.filter((w) => w.y < cutoffY - 0.012 && w.y > 0.035);
  if (promptWords.length >= 3) {
    const minX = Math.max(0.015, Math.min(...promptWords.map((w) => w.x)) - 0.012);
    const minY = Math.max(0.015, Math.min(...promptWords.map((w) => w.y)) - 0.008);
    const maxX = Math.min(0.985, Math.max(...promptWords.map((w) => w.x + w.width)) + 0.012);
    const maxY = Math.min(cutoffY - 0.006, Math.max(...promptWords.map((w) => w.y + w.height)) + 0.008);

    if (maxY > minY && maxX > minX) {
      regions.push({
        id: 'question-root',
        label: 'Soru Kökü / Metin',
        type: 'paragraph',
        x: Number(minX.toFixed(4)),
        y: Number(minY.toFixed(4)),
        width: Number((maxX - minX).toFixed(4)),
        height: Number((maxY - minY).toFixed(4)),
        content: promptWords.map((w) => w.text).join(' '),
      });
    }
  }

  const detectedOptions: string[] = [];
  const detectedSequence = targetLetters
    .map((letter) => ({ letter, marker: finalMarkers.get(letter) }))
    .filter((item): item is { letter: OptionLetter; marker: DetectedOptionMarker } => Boolean(item.marker));

  for (let i = 0; i < detectedSequence.length; i++) {
    const { letter, marker } = detectedSequence[i];
    const nextMarker = detectedSequence[i + 1]?.marker;

    const startY = Math.max(0.01, marker.y - Math.max(0.006, marker.word.height * 0.35));
    let endY: number;

    if (nextMarker) {
      endY = Math.max(startY + 0.025, nextMarker.y - 0.006);
    } else {
      const below = words.filter(
        (w) => w.y >= startY && w.y <= Math.min(0.99, marker.y + 0.18)
      );
      endY = below.length > 0
        ? Math.min(0.985, Math.max(...below.map((w) => w.y + w.height)) + 0.012)
        : Math.min(0.985, marker.y + 0.075);
    }

    const optionWords = words.filter((w) => {
      const centerY = w.y + w.height / 2;
      return centerY >= startY && centerY <= endY;
    });

    const minX = optionWords.length > 0
      ? Math.max(0.02, Math.min(...optionWords.map((w) => w.x)) - 0.012)
      : Math.max(0.02, marker.word.x - 0.012);
    const measuredMaxX = optionWords.length > 0
      ? Math.max(...optionWords.map((w) => w.x + w.width)) + 0.015
      : marker.word.x + marker.word.width + 0.75;
    const maxX = Math.min(0.985, Math.max(measuredMaxX, minX + 0.55));

    regions.push({
      id: `option-${letter.toLowerCase()}`,
      label: `${letter} Seçeneği`,
      type: 'option',
      x: Number(minX.toFixed(4)),
      y: Number(startY.toFixed(4)),
      width: Number((maxX - minX).toFixed(4)),
      height: Number(Math.max(0.03, endY - startY).toFixed(4)),
      content: optionWords.map((w) => w.text).join(' '),
    });
    detectedOptions.push(letter);
  }

  return {
    regions,
    detectedOptions,
    questionPromptRegion: regions.find((r) => r.id === 'question-root'),
  };
}

/**
 * Legacy server-only fallback kept for compatibility. The browser production
 * pipeline does not call this function because guessed coordinates should not
 * be presented as if OCR had grounded them.
 */
export function getYdtStandardGeometry(): AnnotationRegion[] {
  return [
    { id: 'question-root', label: 'Soru Kökü', type: 'question-root', x: 0.05, y: 0.06, width: 0.90, height: 0.32, content: 'Soru Metni ve Paragrafı' },
    { id: 'option-a', label: 'A Seçeneği', type: 'option', x: 0.05, y: 0.42, width: 0.90, height: 0.09, content: 'A Şıkkı' },
    { id: 'option-b', label: 'B Seçeneği', type: 'option', x: 0.05, y: 0.53, width: 0.90, height: 0.09, content: 'B Şıkkı' },
    { id: 'option-c', label: 'C Seçeneği', type: 'option', x: 0.05, y: 0.64, width: 0.90, height: 0.09, content: 'C Şıkkı' },
    { id: 'option-d', label: 'D Seçeneği', type: 'option', x: 0.05, y: 0.75, width: 0.90, height: 0.09, content: 'D Şıkkı' },
    { id: 'option-e', label: 'E Seçeneği', type: 'option', x: 0.05, y: 0.86, width: 0.90, height: 0.09, content: 'E Şıkkı' },
  ];
}
