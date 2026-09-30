import type { AnnotationRegion } from '../../types';
import type { OCRWord } from './ocrTypes';
import { extractArabicPhrases, groupOcrWordsIntoLines, normalizeArabic, type ArabicMatchResult } from './arabicMatcher';

/**
 * A long Arabic passage quoted in the solution (a reading text read aloud in full) is found on
 * the picture as a whole, not word by word: OCR misreads a few words of every long text, and
 * exact matching then breaks the passage into scattered pieces. The passage is aligned to the
 * words on the picture in reading order, tolerating misread, missing and extra words, and gets
 * one underline per printed line, drawn while the words of that line are read.
 */

/** A solution line with at least this many Arabic words (and hardly any Latin) is a passage. */
export const PASSAGE_MIN_WORDS = 10;
/** Share of the passage's words that must be found on the picture, in order. */
const MIN_FOUND = .5;
/** A wider gap between two words of one row separates two columns. */
const COLUMN_GAP = .05;

const ARABIC_WORD = /[ء-غف-يً-ٰٟـٱ-ۓ]+/g;

interface PassageToken { norm: string; from: number; to: number }

/**
 * The Arabic passages of the solution, with each word's place in the text: runs of ten or more
 * Arabic words with no Turkish word between them (sentence numbers like "II." do not count). A passage may share its line with Turkish
 * ("Önce paragrafı okuyalım. اِسْتَخْرَجَ …").
 */
export function findPassages(solutionText: string): PassageToken[][] {
  const passages: PassageToken[][] = [];
  let run: PassageToken[] = [];
  const close = () => { if (run.length >= PASSAGE_MIN_WORDS) passages.push(run); run = []; };
  for (const m of solutionText.matchAll(/\S+/g)) {
    const word = m[0];
    // Numbered sentences ("I. …", "(II) …", "3. …") are one passage read sentence by sentence.
    if (/^[([]?(?:[IVX]{1,4}|\d{1,2})[)\].:]*$/.test(word)) continue;
    if (/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(word)) { close(); continue; }
    // A line break between Arabic lines keeps the passage; a blank line ends it.
    if (/\n[ \t]*\n/.test(solutionText.slice(run.length ? run[run.length - 1].to : m.index!, m.index!))) close();
    for (const a of word.matchAll(ARABIC_WORD)) {
      const norm = normalizeArabic(a[0]);
      if (norm) run.push({ norm, from: m.index! + a.index!, to: m.index! + a.index! + a[0].length });
    }
  }
  close();
  return passages;
}

/** Without the article and the joined "and", which OCR often reads apart or loses. */
const stem = (w: string) => w.replace(/^و(?=..)/, '').replace(/^(?:ال|لل)(?=..)/, '');

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = row;
  }
  return previous[b.length];
}

/** How alike two normalized words are, 0–1. */
export function wordLikeness(a: string, b: string): number {
  if (a === b) return 1;
  const ratio = (x: string, y: string) => 1 - levenshtein(x, y) / Math.max(x.length, y.length, 1);
  return Math.max(ratio(a, b), ratio(stem(a), stem(b)) - .05);
}

interface PictureToken { norm: string; word: OCRWord; segment: number; row: number }

/**
 * The Arabic words on the picture in reading order: column by column (right first), top to
 * bottom, right to left. A row is cut where a wide gap separates two columns, so a passage
 * beside the question stays one run of words.
 */
export function readingOrder(words: OCRWord[]): { tokens: PictureToken[]; segments: OCRWord[][] } {
  const arabic = words.filter(w => /[\u0621-\u064A]/.test(w.text));
  // A watermark or a drawing read as a "word" can be taller than a line (the ÖSYM watermark
  // swells words it crosses); such a box would pull printed lines into one row and put the
  // underline under the next line. Boxes half again taller than a usual word are left out.
  const heights = arabic.map(w => w.height).sort((a, b) => a - b);
  const usual = heights[Math.floor(heights.length / 2)] || 0;
  const rows = groupOcrWordsIntoLines(usual ? arabic.filter(w => w.height <= usual * 1.5) : arabic);
  const segments: OCRWord[][] = [];
  const rowOf = new Map<OCRWord, number>();
  rows.forEach((row, r) => row.forEach(w => rowOf.set(w, r)));
  for (const row of rows) {
    let current: OCRWord[] = [];
    for (const word of row) {
      const previous = current[current.length - 1];
      if (previous && previous.x - (word.x + word.width) > COLUMN_GAP) { segments.push(current); current = []; }
      current.push(word);
    }
    if (current.length) segments.push(current);
  }
  // Columns: segments whose widths overlap belong together.
  const span = (s: OCRWord[]) => ({ left: Math.min(...s.map(w => w.x)), right: Math.max(...s.map(w => w.x + w.width)), top: Math.min(...s.map(w => w.y)) });
  const spans = segments.map(span);
  const column = segments.map((_, i) => i);
  const find = (i: number): number => (column[i] === i ? i : (column[i] = find(column[i])));
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = spans[i], b = spans[j];
    const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    if (overlap > .3 * Math.min(a.right - a.left, b.right - b.left)) column[find(i)] = find(j);
  }
  const groups = new Map<number, number[]>();
  segments.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) || []), i]));
  const ordered = [...groups.values()]
    .sort((a, b) => Math.max(...b.map(i => spans[i].right)) - Math.max(...a.map(i => spans[i].right)))
    // Within a column, line after line; a line cut by a gap (words the reader lost) keeps its
    // right part first.
    .flatMap(group => group.sort((a, b) => rowOf.get(segments[a][0])! - rowOf.get(segments[b][0])! || spans[b].right - spans[a].right));
  const orderedSegments = ordered.map(i => segments[i]);
  const tokens = orderedSegments.flatMap((segment, index) => segment.flatMap(word =>
    normalizeArabic(word.text).split(' ').filter(Boolean).map(norm => ({ norm, word, segment: index, row: rowOf.get(word)! }))));
  return { tokens, segments: orderedSegments };
}

/** Local alignment (Smith–Waterman) of the passage to the picture's words; pairs of alike words. */
export function alignPassage(expected: string[], seen: string[]): Array<[number, number]> {
  const n = expected.length, m = seen.length;
  const score = (a: string, b: string) => { const s = wordLikeness(a, b); return s >= .8 ? 2 : s >= .6 ? 1 : -1; };
  const H = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  let best = 0, bi = 0, bj = 0;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const v = Math.max(0, H[i - 1][j - 1] + score(expected[i - 1], seen[j - 1]), H[i - 1][j] - 1, H[i][j - 1] - 1);
    H[i][j] = v;
    if (v > best) { best = v; bi = i; bj = j; }
  }
  const pairs: Array<[number, number]> = [];
  let i = bi, j = bj;
  while (i > 0 && j > 0 && H[i][j] > 0) {
    const s = score(expected[i - 1], seen[j - 1]);
    if (H[i][j] === H[i - 1][j - 1] + s) { if (s > 0) pairs.push([i - 1, j - 1]); i--; j--; }
    else if (H[i][j] === H[i - 1][j] - 1) i--;
    else j--;
  }
  return pairs.reverse();
}

export interface PassageMatch extends ArabicMatchResult {
  sourceStart: number;
  sourceEnd: number;
  /** End of the whole passage in the solution. */
  passageEnd: number;
}

function matchOne(solutionText: string, passage: PassageToken[], words: OCRWord[], index: number): PassageMatch[] {
  const { tokens, segments } = readingOrder(words);
  if (!tokens.length) return [];
  const pairs = alignPassage(passage.map(t => t.norm), tokens.map(t => t.norm));
  if (pairs.length < Math.max(6, passage.length * MIN_FOUND)) return [];
  // Each printed line the passage covers, with the passage words read on it. A line is a row of
  // the picture: a lost word can leave a gap in it, which does not make it two lines.
  const lines: Array<{ row: number; segment: number; firstWord: number; tokens: number[] }> = [];
  for (const [e, t] of pairs) {
    const { row, segment } = tokens[t], last = lines[lines.length - 1];
    if (last?.row === row) last.tokens.push(t);
    else lines.push({ row, segment, firstWord: e, tokens: [t] });
  }
  // Passage words before the first found one (or after the last) were misread: the words next to it on the picture.
  const lo = pairs[0][1] - pairs[0][0], hi = pairs[pairs.length - 1][1] + (passage.length - 1 - pairs[pairs.length - 1][0]);
  return lines.map((line, k) => {
    const next = lines[k + 1];
    const from = k === 0 ? 0 : line.firstWord;
    const to = next ? next.firstWord - 1 : passage.length - 1;
    const lineWords = [...new Set(tokens.filter((t, i) => t.row === line.row && i >= lo && i <= hi).map(t => t.word))];
    const shown = lineWords.length ? lineWords : segments[line.segment];
    const x = Math.max(0, Math.min(...shown.map(w => w.x)) - .005), y = Math.max(0, Math.min(...shown.map(w => w.y)) - .004);
    const right = Math.min(1, Math.max(...shown.map(w => w.x + w.width)) + .005), bottom = Math.min(1, Math.max(...shown.map(w => w.y + w.height)) + .004);
    const sourceStart = passage[from].from, sourceEnd = passage[Math.max(from, to)].to;
    const phrase = solutionText.slice(sourceStart, sourceEnd);
    const region: AnnotationRegion = {
      id: `arabic-passage-${index + 1}-line-${k + 1}`, label: `Paragraf, ${k + 1}. satır`, type: 'phrase',
      x, y, width: right - x, height: bottom - y, content: phrase,
    };
    return { phrase, region, matchedWords: shown, sourceStart, sourceEnd, passageEnd: passage[passage.length - 1].to };
  });
}

/**
 * Every Arabic passage of the solution found on the picture, as one underline per printed line.
 * The better of the two OCR passes is used for each passage.
 */
export function findPassageMatches(solutionText: string, primary: OCRWord[], alternative: OCRWord[] = []): PassageMatch[] {
  return findPassages(solutionText).flatMap((passage, index) => {
    const a = matchOne(solutionText, passage, primary, index);
    const b = alternative.length ? matchOne(solutionText, passage, alternative, index) : [];
    const words = (lines: PassageMatch[]) => lines.reduce((n, l) => n + l.matchedWords.length, 0);
    return words(b) > words(a) ? b : a;
  });
}

/**
 * A phrase of the explanation found inside a passage on the picture, tolerating misread words
 * (the exact search needs every word read right). One region per printed line it spans.
 */
export function findInPassage(phrase: string, lines: PassageMatch[], id: string): ArabicMatchResult[] {
  const raw = phrase.split(/\s+/);
  const expected = raw.map((w, i) => ({ norm: normalizeArabic(w), i })).filter(t => t.norm);
  if (expected.length < 2) return [];
  const seen = lines.flatMap((line, row) => [...line.matchedWords].sort((a, b) => b.x - a.x)
    .flatMap(word => normalizeArabic(word.text).split(' ').filter(Boolean).map(norm => ({ norm, word, row }))));
  const pairs = alignPassage(expected.map(t => t.norm), seen.map(t => t.norm));
  if (pairs.length < Math.max(2, Math.ceil(expected.length * .7))) return [];
  if (pairs[pairs.length - 1][1] - pairs[0][1] > expected.length + 1) return [];
  const rows = [...new Set(pairs.map(([, t]) => seen[t].row))];
  return rows.map((row, k) => {
    const inRow = pairs.filter(([, t]) => seen[t].row === row);
    const nextRow = rows[k + 1];
    // A misread first (or last) word is the word next to the found ones on the same line.
    let from = inRow[0][1], to = inRow[inRow.length - 1][1];
    if (k === 0) from = Math.max(from - pairs[0][0], seen.findIndex(t => t.row === row));
    if (nextRow === undefined) {
      const lastOnRow = seen.map(t => t.row).lastIndexOf(row);
      to = Math.min(to + (expected.length - 1 - pairs[pairs.length - 1][0]), lastOnRow);
    }
    const words = [...new Set(seen.slice(from, to + 1).map(t => t.word))];
    const eFrom = k === 0 ? 0 : inRow[0][0];
    const eTo = nextRow === undefined ? expected.length - 1 : pairs.find(([, t]) => seen[t].row === nextRow)![0] - 1;
    const text = raw.slice(expected[eFrom].i, expected[Math.max(eFrom, eTo)].i + 1).join(' ');
    const x = Math.max(0, Math.min(...words.map(w => w.x)) - .005), y = Math.max(0, Math.min(...words.map(w => w.y)) - .004);
    const right = Math.min(1, Math.max(...words.map(w => w.x + w.width)) + .005), bottom = Math.min(1, Math.max(...words.map(w => w.y + w.height)) + .004);
    return { phrase: text, matchedWords: words, region: {
      id: `${id}-line-${k + 1}`, label: `Arapça: "${phrase}"${rows.length > 1 ? ` (${k + 1})` : ''}`, type: 'phrase',
      x, y, width: right - x, height: bottom - y, content: text,
    } };
  });
}

/**
 * The explanation's phrases that the exact search missed but that are in a passage (the teacher
 * pointing back to the reading text): found there tolerantly. Pieces the exact search found of
 * such a phrase give way to the whole.
 */
export function withPassageReferences(text: string, found: ArabicMatchResult[], passages: PassageMatch[]): ArabicMatchResult[] {
  if (!passages.length) return found;
  let result = found;
  extractArabicPhrases(text).forEach((phrase, index) => {
    const whole = result.some(m => m.region.label === `Arapça: "${phrase}"` || m.region.label?.startsWith(`Arapça: "${phrase}" (`));
    if (whole) return;
    const tolerant = findInPassage(phrase, passages, `arabic-passage-ref-${index + 1}`);
    if (!tolerant.length) return;
    const covered = new Set(tolerant.flatMap(m => m.matchedWords));
    result = [...result.filter(m => !m.matchedWords.length || !m.matchedWords.every(w => covered.has(w))), ...tolerant];
  });
  return result;
}

/** A quote of an option ("A seçeneğinde şöyle deniyor. …"): its words are in the option, not to be looked for elsewhere. */
function quotesAnOption(text: string, phrase: string): boolean {
  const at = text.indexOf(phrase);
  return at >= 0 && /(?:şıkk|seçene)[^\n]{0,60}$/i.test(text.slice(Math.max(0, at - 120), at).split('\n').slice(-2).join(' '));
}

/**
 * An explanation phrase of three or more words that the exact search missed (one letter misread
 * is enough to miss it), looked for tolerantly anywhere on the picture, column by column. Found
 * in two places, it is left alone rather than drawn at the wrong one.
 */
export function findTolerantly(phrase: string, words: OCRWord[], id: string): ArabicMatchResult[] {
  const { segments, tokens } = readingOrder(words);
  // Pieces of one printed line (cut by a lost word) are one line: one underline.
  const rowOf = new Map(tokens.map(t => [t.word, t.row]));
  const lines = (list: OCRWord[][]) => list.filter(s => s.length).reduce<OCRWord[][]>((rows, s) => {
    const last = rows[rows.length - 1];
    if (last && rowOf.get(last[0]) === rowOf.get(s[0])) last.push(...s); else rows.push([...s]);
    return rows;
  }, []).map(s => ({ matchedWords: s }) as PassageMatch);
  const first = findInPassage(phrase, lines(segments), id);
  if (!first.length) return [];
  const used = new Set(first.flatMap(m => m.matchedWords));
  if (findInPassage(phrase, lines(segments.map(s => s.filter(w => !used.has(w)))), `${id}-again`).length) return [];
  return first;
}

/** The explanation's phrases of three or more words the exact search missed, found tolerantly; their found pieces give way. */
export function withTolerantPhrases(text: string, found: ArabicMatchResult[], words: OCRWord[]): ArabicMatchResult[] {
  let result = found;
  extractArabicPhrases(text).forEach((phrase, index) => {
    if (phrase.split(/\s+/).filter(w => normalizeArabic(w)).length < 3 || quotesAnOption(text, phrase)) return;
    if (result.some(m => m.region.label === `Arapça: "${phrase}"` || m.region.label?.startsWith(`Arapça: "${phrase}" (`))) return;
    const tolerant = findTolerantly(phrase, words, `arabic-tolerant-${index + 1}`);
    if (!tolerant.length) return;
    const covered = new Set(tolerant.flatMap(m => m.matchedWords));
    result = [...result.filter(m => !m.matchedWords.length || !m.matchedWords.every(w => covered.has(w))), ...tolerant];
  });
  return result;
}
