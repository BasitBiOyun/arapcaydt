import test from 'node:test';
import assert from 'node:assert/strict';
import { addMark, drawnRegion, placeFromStroke, snapToText } from '../src/features/video/PreviewEditOverlay';
import { tapMark } from '../src/features/video/MarkTimeline';
import { computeTimelineVisualState } from '../src/features/video/engine/timeline';
import type { AnnotationRegion, VideoAction } from '../src/types';

const fit = { x: 0, y: 0, width: 1000, height: 1000 };
const phrase = (id: string, x: number, y: number, width: number, height = .04) =>
  ({ id, type: 'phrase', label: id, content: id, x, y, width, height }) as AnnotationRegion;

test('alt çizgi: a flat drag becomes a line under one text line, dropped near text it sits exactly under it', () => {
  // Dragged right-to-left at y .505, a little under a printed line whose box ends at .50.
  const stroke = drawnRegion('drawing', .6, .505, .3, .505);
  const place = placeFromStroke(stroke, 'underline', fit, .04)!;
  assert.ok(place, 'a flat stroke is a line, not a stray click');
  assert.ok(Math.abs(place.y + place.height - .505) < 1e-9, 'the line is where it was drawn');
  const snapped = snapToText(place, [phrase('line', .2, .46, .5)], .04);
  assert.deepEqual([snapped.y, snapped.height], [.46, .04], 'dropped close under text, it takes that line');
  const far = snapToText(place, [phrase('other', .2, .30, .5)], .04);
  assert.equal(far.y, place.y, 'far from any text it stays where it was drawn');
  const aside = snapToText(place, [phrase('aside', .8, .46, .1)], .04);
  assert.equal(aside.y, place.y, 'text beside the line (not over it) is not used');
  assert.equal(placeFromStroke(drawnRegion('d', .5, .5, .5005, .5), 'underline', fit, .04), null, 'a click is not a line');
});

test('şimdi: first tap starts the mark, the second ends it; a cross only starts', () => {
  const line = { id: 'u', type: 'underline', targetRegionId: 'r', start: 2, duration: 2 } as VideoAction;
  const started = tapMark(line, 5, 30, 'start');
  assert.deepEqual([started.start, started.duration], [5, 2]);
  const ended = tapMark(started, 8.5, 30, 'end');
  assert.deepEqual([ended.start, ended.duration], [5, 3.5]);
  assert.equal(tapMark(started, 5.1, 30, 'end').duration, .3, 'never shorter than the shortest mark');
  const cross = { id: 'x', type: 'reject', targetRegionId: 'option-a', start: 1, duration: 29 } as VideoAction;
  assert.equal(tapMark(cross, 6, 30, 'end').start, 6, 'a cross only moves its start');
});

test('daire and direction: a ring is drawn in and kept; a left-to-right line flows left-to-right', () => {
  const marks = addMark([], 'box', 'circle', 3, 30);
  assert.deepEqual([marks[0].type, marks[0].duration], ['circle', 2.5]);
  const early = computeTimelineVisualState(3.3, marks, []);
  assert.equal(early.activeCircles.length, 1);
  assert.ok(early.activeCircles[0].progress > .4 && early.activeCircles[0].progress < .6, 'half drawn after 0.3 s');
  assert.equal(computeTimelineVisualState(4.5, marks, []).activeCircles[0].progress, 1);
  assert.equal(computeTimelineVisualState(6, marks, []).activeCircles.length, 0, 'gone after its time');
  const line = { id: 'u', type: 'underline', targetRegionId: 'r', start: 0, duration: 2 } as VideoAction;
  assert.equal(computeTimelineVisualState(1, [line], []).activeUnderlines[0].isRtl, true, 'Arabic default: right-to-left');
  assert.equal(computeTimelineVisualState(1, [{ ...line, fromLeft: true }], []).activeUnderlines[0].isRtl, false);
});

test('an option read aloud ("A) …") is not underlined where the same words stand in the passage', async () => {
  const { isOptionQuote } = await import('../src/services/pipeline/arabicMarks');
  const sentence = 'تعتمد الطيور المهاجرة على المجال المغناطيسي';
  const options = [{ content: `A) ${sentence} للأرض وحده` }];
  assert.equal(isOptionQuote(`Şıkları okuyalım:\nA) ${sentence} للأرض وحده.`, sentence, options), true, 'read as option A');
  assert.equal(isOptionQuote(`A şıkkı: ${sentence}.`, sentence, options), true);
  assert.equal(isOptionQuote(`Yani ${sentence} deniyor.`, sentence, options), true, 'mostly option A’s own text, not tied to the passage');
  assert.equal(isOptionQuote(`Parçada açıkça ${sentence} deniyor.`, sentence, options), false, 'pointed at the passage: underlined there');
  assert.equal(isOptionQuote(`Yani الطيور المهاجرة deniyor.`, 'الطيور المهاجرة', options), false, 'a short phrase is looked for as usual');
  assert.equal(isOptionQuote(`Bunu ve ${sentence}.`, sentence, []), false, 'no options known: nothing is skipped');
});

test('a coloured underline is drawn in its own colour; the default stays the studio orange', () => {
  const line = { id: 'u', type: 'underline', targetRegionId: 'r', start: 0, duration: 2 } as VideoAction;
  assert.equal(computeTimelineVisualState(1, [line], []).activeUnderlines[0].color, undefined);
  assert.equal(computeTimelineVisualState(1, [{ ...line, color: '#2563EB' }], []).activeUnderlines[0].color, '#2563EB');
});

test('long options read aloud are underlined in the option, line by line, timed by where each line is read', async () => {
  const { optionReadAt } = await import('../src/services/pipeline/arabicMarks');
  const text = 'Şimdi seçeneklere bakalım.\nA seçeneğinde şöyle deniyor:\nبدأ الأموريون بعد انفصالهم\nB) كانت المناطق';
  assert.equal(optionReadAt(text, text.indexOf('بدأ')), 'A', 'named on the line above');
  assert.equal(optionReadAt(text, text.indexOf('كانت')), 'B', '"B)" on the same line');
  assert.equal(optionReadAt('Parçada şöyle deniyor:\nبدأ', 'Parçada şöyle deniyor:\n'.length), null);
});
