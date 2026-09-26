import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectYdtQuestionRegions } from '../src/services/ocr/ydtQuestionDetector';
import { learnTemplate, matchProfile, signatureFromGray, stripTemplateWords, type TemplateProfile } from '../src/services/ocr/templateProfile';
import type { OCRResult } from '../src/services/ocr/ocrTypes';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/layout-${name}-ocr.json`, import.meta.url), 'utf8')) as OCRResult;
const learn = (profiles: TemplateProfile[], sig: number[], name: string) => {
  const ocr = load(name);
  return learnTemplate(profiles, sig, ocr.words, detectYdtQuestionRegions(ocr).regions);
};

test('slide signature matches the same template and rejects a different one', () => {
  const w = 40, h = 30;
  const slide = (header: number) => Array.from({ length: w * h }, (_, i) => Math.floor(i / w) < 2 ? header : 255);
  const a = signatureFromGray(slide(90), w, h), b = signatureFromGray(slide(92), w, h), other = signatureFromGray(slide(255), w, h);
  const profiles = learnTemplate([], a, [], []);
  assert.ok(matchProfile(profiles, b));
  assert.equal(matchProfile(profiles, other), undefined);
});

test('instruction box and footer text learned from two slides are ignored on the third; options and stem stay', () => {
  const sig = Array(144).fill(200);
  const profiles = learn(learn([], sig, 'row5'), sig, 'column');
  const profile = matchProfile(profiles, sig)!;
  assert.equal(profile.seen, 2);
  const grid = load('grid');
  const stripped = stripTemplateWords(grid, profile);
  const removed = grid.words.filter(w => !stripped.words.includes(w)).map(w => w.text);
  assert.ok(removed.includes('bulunuz.') && removed.includes('ARAPÇA'), `instruction and footer words not learned: ${removed}`);
  assert.ok(!removed.some(w => /^[A-E]\)$/.test(w) || /[ء-ي]/.test(w)), `labels or Arabic removed: ${removed}`);
  const before = detectYdtQuestionRegions(grid), after = detectYdtQuestionRegions(stripped);
  assert.deepEqual(after.detectedOptions, before.detectedOptions);
  assert.deepEqual(after.regions.find(r => r.id === 'question-root'), before.regions.find(r => r.id === 'question-root'));
});

test('a single slide never removes anything', () => {
  const sig = Array(144).fill(200);
  const profile = matchProfile(learn([], sig, 'row5'), sig)!;
  const grid = load('grid');
  assert.equal(stripTemplateWords(grid, profile).words.length, grid.words.length);
});
