import test from 'node:test';
import assert from 'node:assert/strict';
import { arabicConfidence, preferStockArabic } from '../src/services/ocr/modelChoice';

const page = (words: [string, number][]) => ({ blocks: [{ paragraphs: [{ lines: [{ words: words.map(([text, confidence]) => ({ text, confidence })) }] }] }] });

test('Arabic confidence ignores Latin words and weighs by letters', () => {
  const c = arabicConfidence(page([['A)', 99], ['كتب', 90], ['الطالب', 60], ['soru', 10]]));
  assert.equal(c.words, 2);
  assert.equal(c.mean, (90 * 3 + 60 * 6) / 9);
});

test('stock model wins only when more confident over enough Arabic words', () => {
  assert.equal(preferStockArabic({ words: 30, mean: 88 }, { words: 30, mean: 90 }), true);
  assert.equal(preferStockArabic({ words: 30, mean: 91 }, { words: 30, mean: 90 }), false);
  assert.equal(preferStockArabic({ words: 4, mean: 50 }, { words: 4, mean: 60 }), false);
  assert.equal(arabicConfidence(undefined).words, 0);
});
