import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTimeline, movedTime, partRanges, sentenceRanges, spliceAudio, spokenSpan, wholeSentences } from '../src/services/narration/revoice';
import type { NarrationWord } from '../src/types';

const solution = 'Soru 3. Öğrenciler kitap okur.\nA şıkkı olmaz. B şıkkını eliyoruz!\nDoğru cevap D şıkkı.';

test('sentences keep their exact place in the text; "Soru 3." does not end one', () => {
  const s = sentenceRanges(solution);
  assert.deepEqual(s.map(r => r.text), ['Soru 3. Öğrenciler kitap okur.', 'A şıkkı olmaz.', 'B şıkkını eliyoruz!', 'Doğru cevap D şıkkı.']);
  for (const r of s) assert.equal(solution.slice(r.from, r.to), r.text);
  assert.deepEqual(sentenceRanges('I. öncül doğrudur. II. öncül yanlıştır.').map(r => r.text), ['I. öncül doğrudur.', 'II. öncül yanlıştır.']);
  assert.deepEqual(sentenceRanges('الجواب هو د؟ نعم.').map(r => r.text), ['الجواب هو د؟', 'نعم.']);
  const picked = wholeSentences(solution, solution.indexOf('olmaz'), solution.indexOf('olmaz') + 3)!;
  assert.equal(picked.text, 'A şıkkı olmaz.');
  assert.equal(wholeSentences(solution, solution.indexOf('olmaz'), solution.indexOf('eliyoruz'))!.text, 'A şıkkı olmaz. B şıkkını eliyoruz!');
});

test('parts of a long solution are found in the text in order', () => {
  const long = ('Birinci paragraf cümlesi burada. '.repeat(90) + '\n\n').repeat(3).trim();
  const parts = partRanges(long);
  assert.ok(parts.length >= 2);
  for (const p of parts) assert.equal(long.slice(p.from, p.to), p.text);
  for (let i = 1; i < parts.length; i++) assert.ok(parts[i].from >= parts[i - 1].to);
});

// Heard words: every sentence except "B şıkkını eliyoruz!" (skipped by the voice).
const heard = (list: string[], gaps: Record<number, number> = {}): NarrationWord[] => {
  let t = 0.2;
  return list.map((text, i) => { t += gaps[i] ?? 0.1; const w = { text, start: t, end: t + 0.4 }; t += 0.4; return w; });
};
const spoken = heard(['Soru', '3', 'Öğrenciler', 'kitap', 'okur', 'A', 'şıkkı', 'olmaz', 'Doğru', 'cevap', 'D', 'şıkkı'], { 5: 0.6, 8: 0.8 });

test('a heard sentence is cut in the pauses around it; a skipped one is a single insert point', () => {
  const a = sentenceRanges(solution)[1];
  const span = spokenSpan(solution, spoken, 8, a)!;
  const [okur, A, olmaz, dogru] = [spoken[4], spoken[5], spoken[7], spoken[8]];
  assert.equal(span.skipped, false);
  assert.ok(span.start > okur.end && span.start < A.start);
  assert.ok(span.end > olmaz.end && span.end < dogru.start);
  const b = sentenceRanges(solution)[2];
  const gap = spokenSpan(solution, spoken, 8, b)!;
  assert.equal(gap.skipped, true);
  assert.equal(gap.start, gap.end);
  assert.ok(gap.start > olmaz.end && gap.start < dogru.start);
});

test('new audio replaces the stretch with soft edges; later times move by the difference', () => {
  const rate = 1000;
  const base = new Float32Array(10 * rate).fill(0.5);
  const insert = new Float32Array(3 * rate);
  insert.fill(0.4, 500, 2500); // 0.5 s silence, 2 s of voice, 0.5 s silence
  const out = spliceAudio(base, insert, rate, 4, 6);
  // 4 s kept + pause + ~2.06 s voice + pause + 4 s kept
  assert.ok(Math.abs(out.samples.length / rate - (8 + 0.36 + 2.06)) < 0.02, `length ${out.samples.length / rate}`);
  assert.equal(out.newStart, 4);
  assert.ok(Math.abs(out.shift - (out.newEnd - 6)) < 1e-9);
  assert.ok(Math.abs(out.samples[Math.round(2 * rate)] - 0.5) < 1e-6, 'audio before the cut is untouched');
  assert.ok(Math.abs(out.samples[out.samples.length - 1000] - 0.5) < 1e-6, 'audio after the cut is untouched');
  assert.ok(Math.abs(out.samples[4 * rate - 1]) < 0.1, 'faded out at the cut');
  assert.equal(movedTime(2, 4, 6, 4, out.newEnd), 2);
  assert.ok(Math.abs(movedTime(8, 4, 6, 4, out.newEnd) - (8 + out.shift)) < 1e-9);
});

test('marks, captions and words follow the new narration', () => {
  const change = { start: 4, end: 6, newStart: 4, newEnd: 7.5 };
  const moved = moveTimeline(change,
    [{ id: 'x', type: 'reject', targetRegionId: 'option-a', start: 2, duration: 1 }, { id: 'y', type: 'correct', targetRegionId: 'option-d', start: 8, duration: 2 }, { id: 'z', type: 'focus', targetRegionId: 'option-b', start: 5, duration: 0.5 }],
    [{ text: 'Doğru cevap D.', start: 8, end: 9, words: [{ from: 0, to: 5, start: 8, end: 8.5 }] }],
    [{ text: 'A', start: 3, end: 3.5 }, { text: 'eski', start: 4.5, end: 5 }, { text: 'Doğru', start: 8, end: 8.5 }]);
  assert.deepEqual(moved.actions.map(a => a.start), [2, 9.5, 4 + 0.5 * 3.5]);
  assert.equal(moved.actions[1].duration, 2);
  assert.equal(moved.captions[0].start, 9.5);
  assert.equal(moved.captions[0].words![0].end, 10);
  assert.deepEqual(moved.words.map(w => [w.text, w.start]), [['A', 3], ['Doğru', 9.5]]);
});
