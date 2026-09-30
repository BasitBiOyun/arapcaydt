import test from 'node:test';
import assert from 'node:assert/strict';
import { visionPage } from '../api/vision/ocr';
import { optionMarkersFrom, visionToOcr } from '../src/services/ocr/cloudOcr';

/** A Vision word: its letters, a box, and the break after its last letter. */
const word = (text: string, x: number, y: number, w: number, brk?: string) => ({
  confidence: .97,
  boundingBox: { vertices: [{ x: x + w, y }, { x, y }, { x, y: y + 30 }, { x: x + w, y: y + 30 }] },
  symbols: [...text].map((c, i, all) => ({ text: c, ...(i === all.length - 1 && brk ? { property: { detectedBreak: { type: brk } } } : {}) })),
});
const annotation = {
  text: 'ظهرت الملابس\nA) في بداية',
  pages: [{ width: 1000, height: 500, blocks: [{ paragraphs: [
    { words: [word('ظهرت', 800, 100, 120, 'SPACE'), word('الملابس', 640, 100, 140, 'LINE_BREAK')] },
    { words: [word('A', 100, 300, 20), word(')', 121, 300, 10, 'SPACE'), word('في', 300, 300, 40, 'SPACE'), word('بداية', 180, 300, 100, 'LINE_BREAK')] },
  ] }] }],
};

test('Vision: words with their boxes and the printed lines they sit on', () => {
  const page = visionPage(annotation)!;
  assert.deepEqual(page.words.map(w => w.text), ['ظهرت', 'الملابس', 'A', ')', 'في', 'بداية']);
  assert.deepEqual(page.words[0], { text: 'ظهرت', confidence: 97, x: 800, y: 100, width: 120, height: 30 });
  assert.deepEqual(page.lines, [[0, 1], [2, 3, 4, 5]]);
  assert.equal(visionPage({}), null, 'nothing read');
});

test('Vision: shares of the picture like the in-browser reader, and option letters for the detector', () => {
  const ocr = visionToOcr(visionPage(annotation)!);
  assert.deepEqual([ocr.imageWidth, ocr.imageHeight], [1000, 500]);
  const first = ocr.words.find(w => w.text === 'ظهرت')!;
  assert.deepEqual([first.x, first.y, first.width, first.height], [.8, .2, .12, .06]);
  assert.equal(ocr.lines.length, 2);
  assert.deepEqual(ocr.words.slice(0, 2).map(w => w.text), ['ظهرت', 'الملابس'], 'right to left, top line first');
  assert.deepEqual(ocr.optionMarkers!.map(m => [m.text, +m.width.toFixed(3)]), [['A)', .031]], '"A" and ")" read apart make one label');
  assert.deepEqual(optionMarkersFrom(ocr.words.filter(w => w.text !== ')')), [], 'a lone letter is not a label');
});
