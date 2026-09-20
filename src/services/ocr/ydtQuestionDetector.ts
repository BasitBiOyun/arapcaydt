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
  const cleaned = text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '').trim();

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
  for (const word of [...(ocr.optionMarkers || []), ...(ocr.words || [])]) {
    const letter = matchOptionLetter(word.text);
    if (letter) addCandidate(candidates, letter, word, 5);
  }

  // Tesseract occasionally merges "A)" with the option text. In that case the
  // line itself still starts with the marker, so use its first word / line bbox.
  for (const line of ocr.lines || []) {
    const letter = matchOptionLetter(line.text);
    if (!letter) continue;

    // RTL output order is not physical order. Never attach A to the first
    // Arabic word of a full-width line containing both A and B.
    const firstWord = line.words?.find(word => matchOptionLetter(word.text) === letter);
    if (!firstWord) continue;
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

  // A damaged Latin C is commonly recognized as 0) in the supplied slide.
  // Recover its label only when three explicit labels prove the 2-column grid;
  // retain the actual OCR box. Without that evidence the option stays missing.
  if (!candidates.some((candidate) => candidate.letter === 'C')) {
    const a = candidates.find((candidate) => candidate.letter === 'A');
    const b = candidates.find((candidate) => candidate.letter === 'B');
    const d = candidates.find((candidate) => candidate.letter === 'D');
    if (a && b && d && Math.abs(a.y - b.y) < 0.025 &&
        Math.abs(b.word.x - d.word.x) < 0.035 && d.y > a.y + 0.03) {
      const damaged = (ocr.words || []).find((word) =>
        /^[0O©][).]$/.test(word.text.replace(/[\u200E\u200F]/g, '').trim()) &&
        Math.abs(word.x - a.word.x) < 0.035 && Math.abs(word.y - d.y) < 0.025);
      if (damaged) addCandidate(candidates, 'C', damaged);
    }
  }

  return candidates.sort((a, b) => (a.y - b.y) || (b.confidence - a.confidence));
}

/** Select labels by spatial evidence; A/B and C/D may share a row. */
function chooseMarkers(candidates: DetectedOptionMarker[]): Map<OptionLetter, DetectedOptionMarker> {
  const selected = new Map<OptionLetter, DetectedOptionMarker>();
  for (const letter of ['A', 'B', 'C', 'D', 'E'] as OptionLetter[]) {
    const options = candidates.filter((candidate) => candidate.letter === letter);
    options.sort((a, b) => {
      const score = (candidate: DetectedOptionMarker) => {
        const peers = candidates.filter((other) => other.letter !== letter &&
          Math.abs(other.y - candidate.y) < 0.36);
        const marked = /[)\].:]/.test(candidate.word.text) ? 20 : 0;
        return candidate.confidence + marked + new Set(peers.map((peer) => peer.letter)).size * 8;
      };
      return score(b) - score(a);
    });
    if (options[0]) selected.set(letter, options[0]);
  }
  return selected;
}

export function detectYdtQuestionRegions(ocr: OCRResult): {
  regions: AnnotationRegion[];
  detectedOptions: string[];
  questionPromptRegion?: AnnotationRegion;
} {
  const regions: AnnotationRegion[] = [];
  const words = ocr.words || [];
  if (!words.length) return { regions, detectedOptions: [] };
  const markers = [...chooseMarkers(collectMarkerCandidates(ocr)).values()];
  const rows: DetectedOptionMarker[][] = [];
  for (const marker of markers.sort((a, b) => a.y - b.y)) {
    const row = rows.find((group) => Math.abs(
      group[0].word.y + group[0].word.height / 2 - marker.word.y - marker.word.height / 2
    ) < Math.max(group[0].word.height, marker.word.height) * 0.85);
    if (row) row.push(marker); else rows.push([marker]);
  }
  const cutoffY = rows[0]?.[0].y ?? 0.48;
  // Arabic stem only: decorative slide headers and page numbers are not targets.
  const promptWords = words.filter((word) => word.y + word.height / 2 < cutoffY - 0.006 &&
    word.y > 0.035 && /[\u0621-\u064A]|[-ـ]{2,}/.test(word.text));
  const bounds = (items: OCRWord[], padX = 0.007, padY = 0.006) => {
    const x = Math.max(0, Math.min(...items.map((word) => word.x)) - padX);
    const y = Math.max(0, Math.min(...items.map((word) => word.y)) - padY);
    const right = Math.min(1, Math.max(...items.map((word) => word.x + word.width)) + padX);
    const bottom = Math.min(1, Math.max(...items.map((word) => word.y + word.height)) + padY);
    return { x, y, width: right - x, height: bottom - y };
  };
  if (promptWords.length >= 1) {
    regions.push({ id: 'question-root', label: 'Soru Kökü / Metin', type: 'paragraph',
      ...bounds(promptWords), content: promptWords.map((word) => word.text).join(' ') });
  }
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex].sort((a, b) => a.word.x - b.word.x);
    const top = Math.min(...row.map((marker) => marker.y));
    const rowHeight = Math.max(...row.map((marker) => marker.word.height));
    const nextTop = rows[rowIndex + 1]?.[0].y ?? Math.min(1, top + rowHeight * 3.2);
    // Partition by label columns, not by full-width stripes. The next marker is
    // the hard right edge of a cell, so a neighbouring choice can never enter it.
    for (let column = 0; column < row.length; column++) {
      const marker = row[column];
      const left = column === 0 ? Math.max(0, marker.word.x - 0.035) : marker.word.x - 0.015;
      const right = row[column + 1] ? row[column + 1].word.x - 0.02 : 1;
      const candidates = words.filter((word) => {
        const cy = word.y + word.height / 2;
        const cx = word.x + word.width / 2;
        return cy >= top - rowHeight * 0.35 && cy < nextTop - rowHeight * 0.15 &&
          cx >= left && cx < right && word.x + word.width <= right + .005 && word.height >= rowHeight * 0.25;
      });
      // Stop at a whitespace gutter even if the neighbouring label was missed.
      // Keep successive lines only while their baselines remain contiguous.
      const optionWords: OCRWord[] = [];
      const lineGroups: OCRWord[][] = [];
      for (const word of candidates.sort((a, b) => a.y - b.y)) {
        const group = lineGroups.find(g => Math.abs(g[0].y + g[0].height / 2 - word.y - word.height / 2) < Math.max(g[0].height, word.height) * .8);
        if (group) group.push(word); else lineGroups.push([word]);
      }
      let lastBottom = marker.y + marker.word.height;
      for (const group of lineGroups) {
        if (Math.min(...group.map(w => w.y)) > lastBottom + rowHeight * .9) break;
        const sorted = group.sort((a,b) => a.x - b.x);
        let edge = marker.word.x + marker.word.width;
        for (const word of sorted) {
          if (word.x + word.width < left) continue;
          const gap = word.x - edge;
          if (gap > Math.max(.08, rowHeight * ocr.imageHeight / ocr.imageWidth * 2.4)) break;
          optionWords.push(word);
          edge = Math.max(edge, word.x + word.width);
          lastBottom = Math.max(lastBottom, word.y + word.height);
        }
      }
      // The detected label itself is always real OCR evidence, never a guessed box.
      if (!optionWords.includes(marker.word)) optionWords.push(marker.word);
      regions.push({ id: `option-${marker.letter.toLowerCase()}`, label: `${marker.letter} Seçeneği`,
        type: ('option-' + marker.letter.toLowerCase()) as AnnotationRegion['type'], ...bounds(optionWords), content: optionWords.map((word) => word.text).join(' ') });
    }
  }
  const detectedOptions = ['A', 'B', 'C', 'D', 'E'].filter((letter) =>
    regions.some((region) => region.id === `option-${letter.toLowerCase()}`));
  return { regions, detectedOptions, questionPromptRegion: regions.find((region) => region.id === 'question-root') };
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
