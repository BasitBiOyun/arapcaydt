import test from 'node:test';
import assert from 'node:assert/strict';
import { PART_CHARS, SPOKEN_LIMIT, splitNarration } from '../src/services/narration/narrationParts';

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

test('a solution up to the part size stays one request, as before', () => {
  const text = 'A şıkkı olmaz. '.repeat(250).trim();
  assert.ok(text.length <= PART_CHARS);
  assert.deepEqual(splitNarration(text), [text]);
  assert.equal(SPOKEN_LIMIT, 10_000);
});

test('a long paragraph question is split at paragraph ends into even parts, nothing lost', () => {
  const arabic = 'يَقْرَأُ الطُّلَّابُ الْكُتُبَ الْمُفِيدَةَ فِي أَوْقَاتِهِمْ. '.repeat(40).trim();
  const turkish = 'Öğrenciler faydalı kitapları boş vakitlerinde okurlar. '.repeat(40).trim();
  const text = [arabic, turkish, 'Şimdi şıklara bakalım.\nA şıkkı olmaz.', turkish, 'Doğru cevap D şıkkı.'].join('\n\n');
  assert.ok(text.length > PART_CHARS && text.length <= SPOKEN_LIMIT);
  const parts = splitNarration(text);
  assert.ok(parts.length >= 2 && parts.length <= 3);
  for (const p of parts) assert.ok(p.length <= PART_CHARS, `part of ${p.length}`);
  assert.equal(squash(parts.join(' ')), squash(text));
  // Cuts fall on paragraph ends: no part starts inside a sentence.
  for (const p of parts.slice(1)) assert.match(p, /^(يَقْرَأُ|Öğrenciler|Şimdi|Doğru)/);
  const [a, b] = [parts[0].length, parts[1].length];
  assert.ok(Math.abs(a - b) < text.length * 0.35, `even parts: ${a} / ${b}`);
});

test('without paragraphs the cut is at a sentence end; a single huge sentence is cut at a space', () => {
  const sentences = 'Bu cümle ayrıntılı bir açıklamadır ve biraz uzundur. '.repeat(160).trim();
  const parts = splitNarration(sentences);
  for (const p of parts) { assert.ok(p.length <= PART_CHARS); assert.match(p, /\.$/); }
  assert.equal(squash(parts.join(' ')), squash(sentences));
  const oneSentence = 'kelime '.repeat(1500).trim();
  const cut = splitNarration(oneSentence);
  for (const p of cut) { assert.ok(p.length <= PART_CHARS); assert.doesNotMatch(p, /^\s|\s$/); }
  assert.equal(cut.join(' '), oneSentence);
});
