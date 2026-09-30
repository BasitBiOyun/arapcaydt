import { readdirSync, readFileSync } from 'node:fs';
import type { OCRWord } from '../../src/services/ocr/ocrTypes';
import { normalizeArabic } from '../../src/services/ocr/arabicMatcher';
import { planArabicMarks, wordsOutside } from '../../src/services/pipeline/arabicMarks';

/**
 * A teacher's teşhis file (İşaretler → "Teşhis dosyasını indir") kept as a test: the words the
 * reader saw, the solution text, the boxes found, and the underlines that were right for it.
 */
export interface Teshis {
  note?: string;
  solutionText: string;
  words: Array<Pick<OCRWord, 'text' | 'confidence' | 'x' | 'y' | 'width' | 'height'>>;
  regions: Array<{ id: string; type: string; x: number; y: number; width: number; height: number }>;
  expect?: Marks;
}
/** Underlines, by the height of their middle on the picture (0–1) and the words they carry. */
export interface Marks {
  passageLines: Array<{ y: number; phrase: string }>;
  phrases: Array<{ y: number; phrase: string }>;
}

export const TESHIS_DIR = new URL('../fixtures/teshis/', import.meta.url);

export function loadTeshisFiles(): Array<{ name: string; teshis: Teshis }> {
  return readdirSync(TESHIS_DIR).filter(f => f.endsWith('.json')).sort()
    .map(name => ({ name, teshis: JSON.parse(readFileSync(new URL(name, TESHIS_DIR), 'utf8')) }));
}

/** The underlines the studio plans today for this teşhis file (the same code "İşaretleri hazırla" runs). */
export function replay(teshis: Teshis): Marks {
  const words = teshis.words.map(w => ({ ...w, pixelX: 0, pixelY: 0, pixelWidth: 0, pixelHeight: 0 })) as OCRWord[];
  const options = teshis.regions.filter(r => r.type.startsWith('option'));
  const { passageMatches, arabicMatches } = planArabicMarks(teshis.solutionText, wordsOutside(words, options));
  const mark = (m: { region: { y: number; height: number }; phrase: string }) => ({ y: Math.round((m.region.y + m.region.height / 2) * 1000) / 1000, phrase: m.phrase });
  const lines = new Set(passageMatches.map(m => m.region));
  return {
    passageLines: passageMatches.map(mark),
    phrases: arabicMatches.filter(m => !lines.has(m.region)).map(mark).sort((a, b) => a.y - b.y || a.phrase.localeCompare(b.phrase)),
  };
}

/** How today's underlines differ from the ones kept as right (empty when they match). */
export function differences(expected: Marks, actual: Marks, tolerance = .02): string[] {
  const out: string[] = [];
  const same = (a: { y: number; phrase: string }, b: { y: number; phrase: string }) =>
    Math.abs(a.y - b.y) <= tolerance && normalizeArabic(a.phrase) === normalizeArabic(b.phrase);
  if (expected.passageLines.length !== actual.passageLines.length)
    out.push(`paragraf satırı sayısı ${expected.passageLines.length} olmalı, ${actual.passageLines.length} çıktı`);
  expected.passageLines.forEach((line, i) => {
    const got = actual.passageLines[i];
    if (got && !same(line, got)) out.push(`paragrafın ${i + 1}. satırı: beklenen “${line.phrase}” (y ${line.y}), çıkan “${got.phrase}” (y ${got.y})`);
  });
  for (const p of expected.phrases) if (!actual.phrases.some(a => same(p, a))) out.push(`eksik çizgi: “${p.phrase}” (y ${p.y})`);
  for (const a of actual.phrases) if (!expected.phrases.some(p => same(p, a))) out.push(`fazla çizgi: “${a.phrase}” (y ${a.y})`);
  return out;
}
