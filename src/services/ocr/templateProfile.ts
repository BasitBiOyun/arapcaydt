import type { AnnotationRegion } from '../../types';
import type { OCRResult, OCRWord } from './ocrTypes';

/**
 * Teachers' slides share a fixed template (header band, instruction box,
 * footer). Text that appears at the same place on several slides of the same
 * template is template text: it is learned per browser and removed before
 * option/stem detection, so it can never become an option or part of a stem.
 * Nothing is cropped - question content is never cut off.
 */
export interface TemplateWord { text: string; x: number; y: number; width: number; height: number; hits: number }
export interface TemplateProfile { id: string; signature: number[]; words: TemplateWord[]; seen: number }

const COLS = 24;
const STRIP_ROWS = 3;
const STRIP = .09;
const MATCH_DISTANCE = 14;
const MAX_PROFILES = 12;
const MAX_WORDS = 160;

/** Coarse luminance grid of the top and bottom strips, where fixed template parts live. */
export function signatureFromGray(gray: ArrayLike<number>, width: number, height: number): number[] {
  const out: number[] = [];
  for (const [y0, y1] of [[0, STRIP], [1 - STRIP, 1]]) {
    for (let row = 0; row < STRIP_ROWS; row++) for (let col = 0; col < COLS; col++) {
      const ya = Math.floor((y0 + (y1 - y0) * row / STRIP_ROWS) * height), yb = Math.max(ya + 1, Math.floor((y0 + (y1 - y0) * (row + 1) / STRIP_ROWS) * height));
      const xa = Math.floor(col / COLS * width), xb = Math.max(xa + 1, Math.floor((col + 1) / COLS * width));
      let sum = 0, n = 0;
      for (let y = ya; y < Math.min(yb, height); y++) for (let x = xa; x < Math.min(xb, width); x++) { sum += gray[y * width + x]; n++; }
      out.push(n ? Math.round(sum / n) : 255);
    }
  }
  return out;
}

export function signatureDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return Infinity;
  return a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
}

export function matchProfile(profiles: TemplateProfile[], signature: number[]): TemplateProfile | undefined {
  return profiles.map(p => ({ p, d: signatureDistance(p.signature, signature) }))
    .filter(x => x.d < MATCH_DISTANCE).sort((a, b) => a.d - b.d)[0]?.p;
}

const norm = (text: string) => text.replace(/[‎‏‪-‮⁦-⁩]/g, '').trim().toLocaleLowerCase('tr-TR');
const same = (w: { text: string; x: number; y: number }, t: TemplateWord) =>
  norm(w.text) === t.text && Math.abs(w.x - t.x) < .012 && Math.abs(w.y - t.y) < .012;

/** Words confirmed on at least two slides of this template. */
export function isTemplateWord(word: OCRWord, profile?: TemplateProfile): boolean {
  return !!profile && profile.words.some(t => t.hits >= 2 && same(word, t));
}

export function stripTemplateWords(ocr: OCRResult, profile?: TemplateProfile): OCRResult {
  if (!profile) return ocr;
  const keep = (w: OCRWord) => !isTemplateWord(w, profile);
  return { ...ocr, words: ocr.words.filter(keep), lines: (ocr.lines || []).map(l => ({ ...l, words: (l.words || []).filter(keep) })),
    ...(ocr.optionMarkers ? { optionMarkers: ocr.optionMarkers.filter(keep) } : {}) };
}

/**
 * Learns from a slide whose options were detected. Only words outside the
 * stem and option boxes are candidates; short tokens (labels "A)", numbers)
 * are never learned, so option labels on a repeated layout stay intact.
 */
export function learnTemplate(profiles: TemplateProfile[], signature: number[], words: OCRWord[], regions: AnnotationRegion[]): TemplateProfile[] {
  const inside = (w: OCRWord) => regions.some(r => {
    const cx = w.x + w.width / 2, cy = w.y + w.height / 2;
    return cx >= r.x - .01 && cx <= r.x + r.width + .01 && cy >= r.y - .01 && cy <= r.y + r.height + .01;
  });
  const candidates = words.filter(w => norm(w.text).length >= 4 && !inside(w) && !/[ء-ي]/.test(w.text));
  const existing = matchProfile(profiles, signature);
  const profile: TemplateProfile = existing
    ? { ...existing, seen: existing.seen + 1, words: existing.words.map(t => ({ ...t })) }
    : { id: `tpl-${Date.now().toString(36)}`, signature, words: [], seen: 1 };
  for (const w of candidates) {
    const known = profile.words.find(t => same(w, t));
    if (known) known.hits++;
    else profile.words.push({ text: norm(w.text), x: w.x, y: w.y, width: w.width, height: w.height, hits: 1 });
  }
  profile.words = profile.words.sort((a, b) => b.hits - a.hits).slice(0, MAX_WORDS);
  return [profile, ...profiles.filter(p => p.id !== profile.id)].slice(0, MAX_PROFILES);
}
