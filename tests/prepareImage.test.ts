import test from 'node:test';
import assert from 'node:assert/strict';
import { binarize, readScale } from '../src/services/ocr/prepareImage';

test('reader clean-up turns ink black and watermark/paper white', () => {
  const px = new Uint8ClampedArray([
    20, 20, 20, 255, // ink
    200, 200, 200, 255, // light-gray watermark
    255, 255, 255, 255, // paper
    0, 0, 0, 0, // transparent
  ]);
  assert.deepEqual([...binarize(px)], [0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
});

test('reader enlarges twice but keeps big pictures within limits', () => {
  assert.equal(readScale(1000, 800), 2);
  assert.equal(readScale(4200, 1000), 1);
  assert.ok(readScale(3000, 1000) > 1 && readScale(3000, 1000) < 2);
});
