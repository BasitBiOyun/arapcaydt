import test from 'node:test';
import assert from 'node:assert/strict';
import { detectYdtQuestionRegions } from '../src/services/ocr/ydtQuestionDetector';
import { parseSolutionSemantics } from '../src/services/analysis/solutionParser';
import { alignEventsWithNarration } from '../src/services/analysis/timelineAligner';
import { OCRResult, OCRWord } from '../src/services/ocr/ocrTypes';
import { NarrationWord } from '../src/types';

function word(text: string, x: number, y: number, width = 0.05, height = 0.03): OCRWord {
  return {
    text,
    confidence: 95,
    x,
    y,
    width,
    height,
    pixelX: Math.round(x * 1000),
    pixelY: Math.round(y * 1000),
    pixelWidth: Math.round(width * 1000),
    pixelHeight: Math.round(height * 1000),
  };
}

function buildSyntheticOcr(): OCRResult {
  const words: OCRWord[] = [
    word('Soru', 0.08, 0.08, 0.08),
    word('metni', 0.18, 0.08, 0.08),
    word('العربية', 0.55, 0.18, 0.12),
    word('A)', 0.08, 0.45, 0.04),
    word('الخيار', 0.18, 0.45, 0.12),
    word('B)', 0.08, 0.55, 0.04),
    word('الذين', 0.18, 0.55, 0.10),
    word('C)', 0.08, 0.65, 0.04),
    word('الذي', 0.18, 0.65, 0.10),
    word('D)', 0.08, 0.75, 0.04),
    word('هذه', 0.18, 0.75, 0.08),
    word('E)', 0.08, 0.85, 0.04),
    word('ذلك', 0.18, 0.85, 0.08),
  ];

  return {
    text: words.map((w) => w.text).join(' '),
    imageWidth: 1000,
    imageHeight: 1000,
    words,
    lines: [],
  };
}

test('YDT detector grounds A-E option regions from OCR word boxes', () => {
  const layout = detectYdtQuestionRegions(buildSyntheticOcr());
  assert.deepEqual(layout.detectedOptions, ['A', 'B', 'C', 'D', 'E']);
  assert.equal(layout.regions.filter((r) => r.id.startsWith('option-')).length, 5);
  assert.ok(layout.regions.some((r) => r.id === 'question-root'));
});

test('solution parser follows an option across sentences and creates reject/correct events', () => {
  const layout = detectYdtQuestionRegions(buildSyntheticOcr());
  const solution = [
    'A seçeneğine bakalım.',
    'Bu yapı burada kullanılamaz, bu yüzden eliyoruz.',
    'C seçeneğini değerlendirelim.',
    'Doğru cevabımız C.',
  ].join(' ');

  const parsed = parseSolutionSemantics(solution, layout.regions, []);

  assert.ok(parsed.events.some((e) => e.targetRegionId === 'option-a' && e.actionType === 'focus'));
  assert.ok(parsed.events.some((e) => e.targetRegionId === 'option-a' && e.actionType === 'reject'));
  assert.ok(parsed.events.some((e) => e.targetRegionId === 'option-c' && e.actionType === 'correct'));
  assert.equal(parsed.deducedCorrectAnswer, 'C');
});

test('timeline aligner uses narration timings and keeps focus/check pair close together', () => {
  const layout = detectYdtQuestionRegions(buildSyntheticOcr());
  const solution = [
    'A seçeneğine bakalım.',
    'Bu yapı burada kullanılamaz, bu yüzden eliyoruz.',
    'Doğru cevabımız C.',
  ].join(' ');
  const parsed = parseSolutionSemantics(solution, layout.regions, []);

  const narration: NarrationWord[] = [
    { text: 'A', start: 1.0, end: 1.1 },
    { text: 'seçeneğine', start: 1.12, end: 1.45 },
    { text: 'bakalım', start: 1.47, end: 1.8 },
    { text: 'Bu', start: 2.0, end: 2.1 },
    { text: 'yapı', start: 2.12, end: 2.3 },
    { text: 'burada', start: 2.32, end: 2.5 },
    { text: 'kullanılamaz', start: 2.52, end: 2.85 },
    { text: 'bu', start: 2.9, end: 3.0 },
    { text: 'yüzden', start: 3.02, end: 3.2 },
    { text: 'eliyoruz', start: 3.22, end: 3.5 },
    { text: 'Doğru', start: 6.0, end: 6.2 },
    { text: 'cevabımız', start: 6.22, end: 6.55 },
    { text: 'C', start: 6.57, end: 6.7 },
  ];

  const actions = alignEventsWithNarration(parsed.events, narration, 9);
  const rejectA = actions.find((a) => a.targetRegionId === 'option-a' && a.type === 'reject');
  const focusC = actions.find((a) => a.targetRegionId === 'option-c' && a.type === 'focus');
  const correctC = actions.find((a) => a.targetRegionId === 'option-c' && a.type === 'correct');

  assert.ok(rejectA, 'A reject action should exist');
  assert.ok(focusC, 'C focus action should exist');
  assert.ok(correctC, 'C correct action should exist');
  assert.ok(rejectA!.start >= 3.0 && rejectA!.start < 3.6);
  assert.ok(correctC!.start > focusC!.start);
  assert.ok(correctC!.start - focusC!.start < 0.7);
});
