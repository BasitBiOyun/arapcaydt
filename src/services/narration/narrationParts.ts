/**
 * Long solutions are voiced in parts: one TTS request for a very long text runs out of time
 * (the request is cut off but still counts against the day's allowance) and tends to skip
 * passages. A part of about 1,800 characters is 1.5–2 minutes of speech, which every model
 * makes in time. Up to PART_CHARS the whole text is one request.
 */
export const SPOKEN_LIMIT = 10_000;
export const PART_CHARS = 1_800;

/** Where a part may end, best first: a paragraph, a sentence, a clause, a word. */
const BREAKS = [/\n\s*\n/g, /\n/g, /[.!?؟…:](?=\s)/g, /[;،,](?=\s)/g, /\s/g];

/**
 * Splits the text into parts of at most `max` characters, as even as the text allows, cutting at
 * the strongest break near each even share. Joining the parts with a space gives back the text
 * (apart from whitespace at the cuts), so nothing is lost or reordered.
 */
export function splitNarration(text: string, max = PART_CHARS): string[] {
  const whole = text.trim();
  if (whole.length <= max) return whole ? [whole] : [];
  const parts: string[] = [];
  let rest = whole;
  while (rest.length > max) {
    const count = Math.ceil(rest.length / max);
    const target = Math.ceil(rest.length / count);
    let cut = -1;
    for (const pattern of BREAKS) {
      // The break closest to the even share, never beyond `max`, and not in the first third.
      let best = -1;
      for (const m of rest.matchAll(pattern)) {
        const end = m.index! + m[0].length;
        if (end > max) break;
        if (end < target / 3) continue;
        if (best < 0 || Math.abs(end - target) < Math.abs(best - target)) best = end;
      }
      if (best > 0) { cut = best; break; }
    }
    if (cut <= 0) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}
