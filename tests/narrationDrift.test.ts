import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { narrationDrift, speechSeconds } from '../src/services/analysis/timelineAligner';
import { sentenceRanges, spokenSpan } from '../src/services/narration/revoice';
import type { NarrationWord } from '../src/types';

const solution = readFileSync(new URL('./fixtures/solution-54.txt', import.meta.url), 'utf8').trim();
const isArabic = (line: string) => /[؀-ۿ]/.test(line) && !/[a-zçğıöşü]/i.test(line.replace(/[A-E]\)/g, ''));

/**
 * A transcript like Gemini Transcribe gives for this question: Turkish word for word, but each
 * Arabic line as a few Latin-letter or missing words, while the voice spent the normal time on it.
 */
function transcript(options: { dropLine?: string; arabic?: 'latin' | 'missing' } = {}) {
  const words: NarrationWord[] = [];
  let t = 0.3;
  for (const line of solution.split('\n')) {
    if (!line.trim()) { t += 0.6; continue; }
    if (options.dropLine && line.startsWith(options.dropLine)) continue; // the voice really skipped it
    if (isArabic(line)) {
      const seconds = speechSeconds(line);
      if (options.arabic !== 'missing') for (const w of ['leyteke', 'kunte', 'akva']) { words.push({ text: w, start: t, end: t + 0.3 }); t += seconds / 3; }
      else t += seconds;
    } else {
      for (const w of line.split(/\s+/)) { const d = 0.07 * w.length + 0.05; words.push({ text: w, start: t, end: t + d }); t += d + 0.05; }
    }
    t += 0.35;
  }
  return { words, duration: t + 0.5 };
}

test('Arabic the transcript missed or wrote in Latin letters is not reported as unread', () => {
  for (const arabic of ['latin', 'missing'] as const) {
    const { words, duration } = transcript({ arabic });
    assert.deepEqual(narrationDrift(solution, words, duration).skipped, [], arabic);
  }
});

test('a sentence the voice really skipped is still reported', () => {
  const { words, duration } = transcript({ dropLine: '“Seninle gurur' });
  const skipped = narrationDrift(solution, words, duration).skipped;
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].text, /^Seninle gurur duyuyorum/);
});

test('fixing an Arabic option the transcript missed replaces it in place, never adds a second copy', () => {
  const { words, duration } = transcript({ arabic: 'missing' });
  const optionA = sentenceRanges(solution).find(s => s.text.startsWith('لَيْتَكَ'))!;
  const span = spokenSpan(solution, words, duration, optionA)!;
  assert.equal(span.skipped, false);
  assert.ok(span.end - span.start >= speechSeconds(optionA.text) * 0.9, 'the whole spoken line is replaced');
  const reallySkipped = transcript({ dropLine: '“Seninle gurur' });
  const line = sentenceRanges(solution).find(s => s.text.startsWith('“Seninle gurur'))!;
  const gap = spokenSpan(solution, reallySkipped.words, reallySkipped.duration, line)!;
  assert.equal(gap.skipped, true, 'a sentence that is really missing is inserted');
});
