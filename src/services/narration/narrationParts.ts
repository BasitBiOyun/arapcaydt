/**
 * Long solutions are voiced in parts: one TTS request for a very long text runs out of time
 * (the request is cut off but still counts against the day's allowance) and tends to skip
 * passages. A solution is split only when it is really long, into as few parts as possible,
 * and only where a speaker would pause anyway: at a paragraph end, else a sentence end.
 */
export const SPOKEN_LIMIT = 10_000;
/**
 * Most spoken letters one request takes (about 3–4 minutes of speech). Counted without Arabic
 * vowel marks and formatting signs, which make the text longer but not the speech: a
 * 375-word solution stays one request.
 */
export const PART_CHARS = 3_200;

/** What the voice actually has to say: no Arabic vowel marks, tatweel or ** formatting, single spaces. */
export function spokenLength(text: string): number {
  return text.replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[*_#]+/g, '').replace(/\s+/g, ' ').trim().length;
}

/**
 * Where a part may end, best first. A colon never ends a part ("Durumda şöyle deniyor:" belongs
 * with what follows). Clause and word breaks are a last resort for a single enormous sentence;
 * a word is never cut in two.
 */
const BREAKS = [/(?<![:：][* \t]*)\n[ \t]*\n/g, /(?<![:：][* \t]*)\n/g, /[.!?؟…](?=\s)/g, /[;،,](?=\s)/g, /\s/g];
/** A new passage about an option or the answer: the best place for a part to start. */
const FRESH_START = /^\s*(?:\*\*)?\s*(?:[A-E]\s*(?:şıkkı|seçeneği|şıkkında|seçeneğinde|ve [A-E])|Şimdi|Doğru cevap|Sonuç)/i;

/**
 * Splits the text into the fewest parts of at most `max` spoken letters, as even as the text
 * allows. Joining the parts with a space gives back the text (apart from whitespace at the
 * cuts), so nothing is lost or reordered.
 */
/**
 * The voice keeps the accent of the language it starts in: a solution that opens in Arabic is read
 * with Arabic-accented Turkish. True when the first letter of the text is Arabic.
 */
export function startsWithArabic(text: string): boolean {
  const first = text.match(/\p{L}/u)?.[0];
  return !!first && /\p{Script=Arabic}/u.test(first);
}

export function splitNarration(text: string, max = PART_CHARS): string[] {
  const whole = text.trim();
  if (!whole) return [];
  if (spokenLength(whole) <= max) return [whole];
  // The same limit in written characters (vowel marks included) for this text.
  const rawMax = Math.floor(max * whole.length / spokenLength(whole));
  const parts: string[] = [];
  let rest = whole;
  while (spokenLength(rest) > max) {
    const count = Math.ceil(spokenLength(rest) / max);
    const target = Math.ceil(rest.length / count);
    let cut = -1;
    for (const pattern of BREAKS) {
      // The break closest to the even share (a fresh passage counts as a little closer),
      // never beyond the limit and not in the first third.
      let best = -1, bestScore = Infinity;
      for (const m of rest.matchAll(pattern)) {
        const end = m.index! + m[0].length;
        if (end > rawMax) break;
        if (end < target / 3) continue;
        const score = Math.abs(end - target) - (FRESH_START.test(rest.slice(end, end + 40)) ? target * 0.15 : 0);
        if (score < bestScore) { best = end; bestScore = score; }
      }
      if (best > 0) { cut = best; break; }
    }
    if (cut <= 0) cut = rawMax;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}
