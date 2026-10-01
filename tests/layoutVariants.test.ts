import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectYdtQuestionRegions } from '../src/services/ocr/ydtQuestionDetector';
import type { OCRResult } from '../src/services/ocr/ocrTypes';

// Real Tesseract output on the fixed slide template (header band, instruction box, footer).
// Labels are misread ("B)" → "(5", "C)" → "0", "E)" → "3") or merged into their option text.
const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/layout-${name}-ocr.json`, import.meta.url), 'utf8')) as OCRResult;
const options = (name: string) => detectYdtQuestionRegions(load(name)).regions.filter(r => r.id.startsWith('option-'));
const center = (r: { x: number; y: number; width: number; height: number }) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

test('A B / C D / E grid from a real exam slide finds every option in its own cell', () => {
  const regions = options('q3');
  assert.deepEqual(regions.map(r => r.id).sort(), ['option-a', 'option-b', 'option-c', 'option-d', 'option-e']);
  const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map(l => center(regions.find(r => r.id === `option-${l}`)!));
  assert.ok(Math.abs(a.y - b.y) < .02 && Math.abs(c.y - d.y) < .02, 'A|B and C|D share rows');
  assert.ok(a.x < b.x && c.x < d.x && Math.abs(a.x - c.x) < .02);
  assert.ok(e.y > c.y + .05 && e.x > a.x && e.x < b.x, 'E sits alone below, between the columns');
});

test('five options in one row and five long options in one column are all found', () => {
  const row = options('row5').sort((p, q) => p.x - q.x);
  assert.deepEqual(row.map(r => r.id), ['option-a', 'option-b', 'option-c', 'option-d', 'option-e']);
  assert.ok(row.every(r => Math.abs(center(r).y - center(row[0]).y) < .02));
  const column = options('column').sort((p, q) => p.y - q.y);
  assert.deepEqual(column.map(r => r.id), ['option-a', 'option-b', 'option-c', 'option-d', 'option-e']);
  assert.ok(column.every(r => r.width > .25), 'long options keep their full text width');
  assert.equal(options('grid').length, 5);
});

test('option boxes never overlap, whatever the layout', () => {
  for (const name of ['q3', 'row5', 'column', 'grid']) {
    const regions = options(name);
    for (const a of regions) for (const b of regions) {
      if (a === b) continue;
      const overlap = Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
      assert.ok(!overlap, `${name}: ${a.id} overlaps ${b.id}`);
    }
    for (const r of regions) assert.ok(r.markerAnchor && r.markerAnchor.y >= 0 && r.markerAnchor.y <= 1, `${name}: ${r.id} marker anchor`);
  }
});

test('header, instruction box, question number and footer never become options or stem', () => {
  const layout = detectYdtQuestionRegions(load('q3'));
  const root = layout.regions.find(r => r.id === 'question-root')!;
  assert.ok(root.y > .3 && root.y + root.height < .45, 'stem is the Arabic sentence only');
  assert.ok(root.x + root.width > .75, 'first stem word (misread as Latin) stays in the stem');
  assert.ok(layout.regions.every(r => r.y > .3 && r.y + r.height < .9));
});

test('a reading passage printed beside the options never enters an option box', () => {
  const word = (text: string, x: number, y: number, width = .05, height = .025) =>
    ({ text, confidence: 95, x, y, width, height, pixelX: 0, pixelY: 0, pixelWidth: 0, pixelHeight: 0 });
  const words = [];
  // Options A–E in the left column (label at .29, two text lines each, ending near .51).
  'ABCDE'.split('').forEach((letter, i) => {
    const y = .34 + i * .09;
    words.push(word(`${letter})`, .29, y, .02));
    for (const [line, dy] of [[0, 0], [1, .035]] as const)
      for (let k = 0; k < 4; k++) words.push(word(`كلمة${letter}${line}${k}`, .32 + k * .048, y + dy));
  });
  // The passage on the right: it starts above the options and runs on beside A and B, close to their text.
  for (let line = 0; line < 9; line++)
    for (let k = 0; k < 7; k++) words.push(word(`نص${line}${k}`, .53 + k * .062, .18 + line * .035));
  const ocr = { text: '', imageWidth: 1600, imageHeight: 1200, words, lines: [] } as unknown as OCRResult;
  const found = detectYdtQuestionRegions(ocr).regions.filter(r => r.id.startsWith('option-'));
  assert.equal(found.length, 5);
  for (const option of found) {
    assert.ok(option.x + option.width < .53, `${option.id} ends before the passage (${(option.x + option.width).toFixed(3)})`);
    assert.ok(!/نص/.test(option.content || ''), `${option.id} holds no passage words`);
  }
});

test('long options in one column keep their full text when nothing is printed beside them', () => {
  const word = (text: string, x: number, y: number, width = .05) =>
    ({ text, confidence: 95, x, y, width, height: .025, pixelX: 0, pixelY: 0, pixelWidth: 0, pixelHeight: 0 });
  const words = [word('سؤال', .4, .25, .2)];
  // A and B run nearly across the page; C, D, E are short.
  'ABCDE'.split('').forEach((letter, i) => {
    const y = .34 + i * .07;
    words.push(word(`${letter})`, .1, y, .02));
    const count = i < 2 ? 14 : 4;
    for (let k = 0; k < count; k++) words.push(word(`كلمة${letter}${k}`, .13 + k * .055, y));
  });
  const ocr = { text: '', imageWidth: 1600, imageHeight: 1200, words, lines: [] } as unknown as OCRResult;
  const found = detectYdtQuestionRegions(ocr).regions.filter(r => r.id.startsWith('option-'));
  for (const id of ['option-a', 'option-b']) {
    const option = found.find(r => r.id === id)!;
    assert.ok(option.x + option.width > .85, `${id} keeps its long text`);
  }
});

test('cloze: E under an A B / C D grid is found in the grid, never on the passage beside it', async () => {
  const { loadTeshisFiles } = await import('./support/teshis');
  const { groupOcrWordsIntoLines } = await import('../src/services/ocr/arabicMatcher');
  const { optionMarkersFrom } = await import('../src/services/ocr/cloudOcr');
  const t = loadTeshisFiles().find(f => f.name === 'cloze-e-sikki-paragraf-yaninda.json')!.teshis;
  const words = groupOcrWordsIntoLines(t.words.map(w => ({ ...w, pixelX: 0, pixelY: 0, pixelWidth: 0, pixelHeight: 0 }))).flat();
  const found = detectYdtQuestionRegions({ text: '', imageWidth: t.image!.width, imageHeight: t.image!.height, words, lines: [], optionMarkers: optionMarkersFrom(words) })
    .regions.filter(r => r.id.startsWith('option-'));
  const e = found.find(r => r.id === 'option-e')!;
  assert.ok(e.x + e.width < .4 && e.y > .55 && e.y + e.height < .7, `E sits under the grid (${e.x.toFixed(2)}, ${e.y.toFixed(2)})`);
  assert.ok(/ع/.test(e.content || ''), 'and holds its own word');
});
