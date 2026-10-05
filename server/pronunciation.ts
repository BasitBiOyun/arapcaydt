/**
 * "Telaffuz sözlüğü": before a text goes to the voice, every word the shared list names is
 * swapped for how it should be read. Only the spoken copy changes; the solution text the
 * teacher wrote (screen, captions, video) is never touched.
 */
export interface Pronunciation { written: string; spoken: string }

const HARAKAT = '[\\u064B-\\u065F\\u0670\\u0640]*';
const ARABIC_LETTER = /[ء-يٱ-ۓ]/;
const MARK = /[ً-ٰٟـ]/;
const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** An Arabic entry written without vowel marks also matches the word with its marks. */
function pattern(written: string): string {
  const plainArabic = ARABIC_LETTER.test(written) && !MARK.test(written);
  return [...written].map(c => /\s/.test(c) ? '\\s+' : escape(c) + (plainArabic && ARABIC_LETTER.test(c) ? HARAKAT : '')).join('');
}

/** Whole words only, case-insensitive, longest entry first, one pass (a replacement is not replaced again). */
export function applyPronunciations(text: string, entries: Pronunciation[]): string {
  const clean = entries
    .map(e => ({ written: e.written.trim(), spoken: e.spoken.trim() }))
    .filter(e => e.written && e.spoken)
    .sort((a, b) => b.written.length - a.written.length);
  if (!clean.length) return text;
  const regex = new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])(?:${clean.map(e => `(${pattern(e.written)})`).join('|')})(?![\\p{L}\\p{N}\\p{M}])`, 'giu');
  return text.replace(regex, (...match) => {
    const index = match.slice(1, clean.length + 1).findIndex(group => group !== undefined);
    return index >= 0 ? clean[index].spoken : match[0];
  });
}

/** The shared list; empty (never an error) before the migration is run or when it cannot be read. */
export async function loadPronunciations(db: any): Promise<Pronunciation[]> {
  try {
    const { data, error } = await db.from('pronunciations').select('written, spoken').limit(1000);
    return error || !Array.isArray(data) ? [] : data;
  } catch {
    return [];
  }
}
