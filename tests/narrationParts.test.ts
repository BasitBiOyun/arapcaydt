import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PART_CHARS, SPOKEN_LIMIT, splitNarration, spokenLength } from '../src/services/narration/narrationParts';

const solution = readFileSync(new URL('./fixtures/solution-54.txt', import.meta.url), 'utf8');
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const words = (s: string) => s.trim().split(/\s+/).length;

test('vowel marks and ** formatting do not count as speech', () => {
  assert.equal(spokenLength('**أَنْتَ تُلَاحِظُ**'), 'أنت تلاحظ'.length);
  assert.ok(spokenLength(solution) < solution.length * 0.9, 'the Arabic vowel marks make the text longer, not the speech');
  assert.equal(SPOKEN_LIMIT, 10_000);
});

test('a real solution (a teacher\'s question 54) and a 375-word one stay one request', () => {
  assert.deepEqual(splitNarration(solution), [solution.trim()]);
  const longer = `${solution.trim()}\n${solution.trim().split('\n').slice(3, 18).join('\n')}`;
  assert.ok(words(longer) >= 375, `${words(longer)} words`);
  assert.equal(splitNarration(longer).length, 1, `${spokenLength(longer)} spoken letters`);
});

test('a very long solution is split into the fewest parts, at paragraph ends, never after a colon', () => {
  const long = Array(5).fill(solution.trim()).join('\n\n');
  assert.ok(spokenLength(long) > PART_CHARS * 2 && long.length <= SPOKEN_LIMIT);
  const parts = splitNarration(long);
  assert.equal(parts.length, Math.ceil(spokenLength(long) / PART_CHARS));
  assert.equal(squash(parts.join(' ')), squash(long), 'nothing lost or reordered');
  for (const [i, p] of parts.entries()) {
    assert.ok(spokenLength(p) <= PART_CHARS, `part ${i + 1}: ${spokenLength(p)}`);
    if (i < parts.length - 1) {
      assert.doesNotMatch(p, /:\**\s*$/, 'a part never ends on a colon');
      assert.ok(long.includes(`${p}\n`), 'a part ends at the end of a line or paragraph');
    }
  }
  // Parts start at a fresh passage: an option, the answer or a new paragraph of its own.
  for (const p of parts.slice(1)) assert.match(p, /^(\*\*)?\s*([A-E] şıkkında|Doğru cevap|Durumda|Yani|Sonuç|Bu nedenle)/, p.slice(0, 40));
});

test('without paragraphs the cut is at a sentence end; a single huge sentence is cut at a space, never inside a word', () => {
  const sentences = 'Bu cümle ayrıntılı bir açıklamadır ve biraz uzundur. '.repeat(160).trim();
  const parts = splitNarration(sentences);
  for (const p of parts) { assert.ok(spokenLength(p) <= PART_CHARS); assert.match(p, /\.$/); }
  assert.equal(squash(parts.join(' ')), squash(sentences));
  const oneSentence = 'hayvanlar '.repeat(900).trim();
  const cut = splitNarration(oneSentence);
  assert.ok(cut.length > 1);
  for (const p of cut) for (const w of p.split(' ')) assert.equal(w, 'hayvanlar', 'no word is cut in two');
  assert.equal(cut.join(' '), oneSentence);
});
