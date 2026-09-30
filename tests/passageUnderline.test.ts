import test from 'node:test';
import assert from 'node:assert/strict';
import { findPassageMatches, findPassages, readingOrder, wordLikeness } from '../src/services/ocr/passageMatcher';
import { findBestArabicMatches } from '../src/services/ocr/arabicMatcher';
import { parseSolutionSemantics } from '../src/services/analysis/solutionParser';
import { alignEventsWithNarration } from '../src/services/analysis/timelineAligner';
import { underlineProgress } from '../src/features/video/engine/timeline';
import type { OCRWord } from '../src/services/ocr/ocrTypes';

// A reading text on the right, the question beside it on the left (as in YDT paragraph questions).
const PASSAGE = 'ظَهَرَتِ الْمَلَابِسُ فِي الْعَصْرِ الْحَجَرِيِّ الْقَدِيمِ، أَيْ مُنْذُ أَكْثَرَ مِنْ مِائَةٍ وَخَمْسِينَ أَلْفَ سَنَةٍ، وَكَانَتِ الْمَلَابِسُ فِي الْبِدَايَةِ مَصْنُوعَةً مِنْ أَوْرَاقِ الْأَشْجَارِ الْكَبِيرَةِ وَالرِّيشِ وَفِرَاءِ وَجُلُودِ الْحَيَوَانَاتِ. وَفِي أَوَاخِرِ الْعَصْرِ الْحَجَرِيِّ الْقَدِيمِ تَمَكَّنَ الْإِنْسَانُ مِنِ اسْتِخْلَاصِ الْخُيُوطِ مِنْ أَلْيَافِ النَّبَاتَاتِ وَاسْتِخْدَامِهَا فِي صِنَاعَةِ الْمَلَابِسِ. اِرْتَبَطَتِ الْمَلَابِسُ بِالْأَلْوَانِ حَتَّى إِنَّهَا كَانَتْ تَرْمُزُ لِطَبَقَةٍ أَوْ حَالَةٍ اجْتِمَاعِيَّةٍ أَوْ فِئَةٍ عُمُرِيَّةٍ أَوْ غَيْرِهَا مِنَ التَّصْنِيفَاتِ، وَكَثِيرٌ مِنَ الْبُلْدَانِ كَانَتْ لَهَا طَبَقَةٌ أَوْ مِهْنَةٌ تَتَمَيَّزُ بِأَزْيَائِهَا. وَنُلَاحِظُ هٰذَا فِي الْأَزْيَاءِ الرُّومَانِيَّةِ وَالْإِفْرِيقِيَّةِ وَالْمِصْرِيَّةِ الْقَدِيمَةِ.';
const SOLUTION = `Önce paragrafın tamamını okuyalım.
${PASSAGE}
Şimdi soruda verilen ifadeyi okuyalım. Soruda şöyle deniyor.
يَبْدُو أَنَّ الْبَشَرَ قَدْ بَدَأَ بِصِنَاعَةِ الْمَلَابِسِ الْمَخِيطَةِ ----.
Parçada başlangıçta giysilerin yaprak, tüy, kürk ve hayvan derilerinden yapıldığı söyleniyor. Daha sonra ise insanın bitki liflerinden iplik elde etmeyi, yani اِسْتِخْلَاصَ الْخُيُوطِ مِنْ أَلْيَافِ النَّبَاتَاتِ başardığı belirtiliyor.
Bu nedenle doğru cevap D seçeneğidir.`;

// The printed lines of the passage, as OCR reads them: a few words misread, one lost, one written
// differently in the book (واستخدمها for وَاسْتِخْدَامِهَا), one split in two.
const PRINTED = [
  'ظهرت الملابس في العصر الحجري القديم أي منذ أكثر',
  'من مائة وخمسين ألف سنة، وكانت الملابس في البداية',
  'مصنوعة من أوراق الاشجار الكبيرة والريش وفراء',
  'وجلود الحيوانات. وفي أواخر العصر الحجرى القديم',
  'تمكن الإنسان من استخلاص الخيوط من ألياف',
  'النباتات واستخدمها في صناعة الملابس. ارتبطت',
  'الملابس بالالوان حتى إنها كانت ترمز لطيقة أو حالة',
  'اجتماعية أو فئة عمرية أو غيرها من التصنيفات، وكثير',
  'من البلدان كانت لها طبقة أو مهنة تتميز بأزيائها.',
  'ونلاحظ هذا في الأزياء الرو مانية والإفريقية والمصرية',
  'القديمة.',
];
const QUESTION = ['يبدو أن البشر قد بدأ بصناعة الملابس المخيطة', 'في بداية العصر الحجري القديم أي منذ آلاف السنين'];

/** Words of one printed line, right to left from `right`, at height `y`. */
function line(text: string, right: number, y: number): OCRWord[] {
  let x = right;
  return text.split(' ').map(w => {
    const width = .008 * w.length + .004;
    x -= width;
    const word = { text: w, confidence: 80, x, y, width, height: .03, pixelX: 0, pixelY: 0, pixelWidth: 0, pixelHeight: 0 };
    x -= .008;
    return word;
  });
}
const passageWords = PRINTED.flatMap((text, i) => line(text, .97, .25 + i * .045)).filter(w => w.text !== 'الحيوانات.');
const questionWords = QUESTION.flatMap((text, i) => line(text, .47, .27 + i * .045));
const picture = [...passageWords, ...questionWords];

test('passage: an Arabic line of ten or more words is a passage; a quoted option is not', () => {
  const passages = findPassages(SOLUTION);
  assert.equal(passages.length, 1);
  assert.equal(SOLUTION.slice(passages[0][0].from, passages[0].at(-1)!.to), PASSAGE.slice(0, -1));
  assert.ok(wordLikeness('الحجري', 'الحجرى') >= .8 && wordLikeness('واستخدامها', 'واستخدمها') >= .8);
});

test('passage: the picture is read column by column, so the text beside the question stays in one run', () => {
  const { tokens } = readingOrder(picture);
  const first = tokens.findIndex(t => t.norm === 'ظهرت'), last = tokens.findIndex(t => t.norm === 'القديمه');
  assert.ok(first >= 0 && last > first);
  assert.ok(tokens.slice(first, last).every(t => t.word.x > .5), 'no question word inside the passage');
});

test('passage: one underline per printed line, in reading order, each timed by its own words', () => {
  const lines = findPassageMatches(SOLUTION, picture);
  assert.equal(lines.length, PRINTED.length, 'every printed line, despite misread words');
  lines.forEach((l, i) => {
    assert.ok(Math.abs(l.region.y - (.25 + i * .045)) < .01, `line ${i + 1} sits on printed line ${i + 1}`);
    assert.ok(l.region.x > .5, 'on the passage, not the question');
    if (i) assert.match(SOLUTION.slice(lines[i - 1].sourceEnd, l.sourceStart), /^[\s،.]+$/, 'lines follow each other in the text, no word left out');
  });
  assert.equal(lines[0].sourceStart, SOLUTION.indexOf('ظَهَرَتِ'));
  assert.equal(lines.at(-1)!.phrase, 'الْقَدِيمَةِ');
  assert.ok(lines[3].phrase.startsWith('وَجُلُودِ'), 'a word OCR lost still belongs to its line');

  // Narration: every word 0.4 s, the passage from 2 s.
  const spoken = SOLUTION.split(/\s+/).filter(Boolean).map((text, i) => ({ text, start: i * .4, end: i * .4 + .35 }));
  const parsed = parseSolutionSemantics(SOLUTION, lines.map(l => l.region), lines);
  const marks = alignEventsWithNarration(parsed.events, spoken, spoken.at(-1)!.end + 1, SOLUTION)
    .filter(a => a.targetRegionId.startsWith('arabic-passage'));
  assert.equal(marks.length, PRINTED.length);
  const passageEnd = marks.at(-1)!.start + marks.at(-1)!.duration;
  marks.forEach((m, i) => {
    if (i) assert.ok(m.start > marks[i - 1].start, 'line after line');
    assert.ok(Math.abs(m.start + m.duration - passageEnd) < .05, 'every line stays until the passage has been read');
  });
  // The first line is fully drawn once its words are read, long before the passage ends.
  const firstLineEnd = spoken[5 + 9].end;
  assert.ok(underlineProgress(marks[0], firstLineEnd - marks[0].start + .05) > .99);
  assert.ok(underlineProgress(marks[0], 1) < .4, 'and drawn as it is read');
});

test('passage: shorter phrases skip it while it is read, and a later mention points into it', () => {
  const lines = findPassageMatches(SOLUTION, picture);
  const text = SOLUTION.slice(0, lines[0].sourceStart) + ' '.repeat(lines.at(-1)!.passageEnd - lines[0].sourceStart) + SOLUTION.slice(lines.at(-1)!.passageEnd);
  const others = findBestArabicMatches(text, picture, [], lines.flatMap(l => l.matchedWords));
  const mention = others.find(m => m.phrase.includes('الْخُيُوطِ'));
  assert.ok(mention && mention.region.x > .5, 'the explanation underlines the passage, where the words are');
  const all = [...lines, ...others];
  const parsed = parseSolutionSemantics(SOLUTION, all.map(m => m.region), all);
  const inside = parsed.events.filter(e => !e.targetRegionId.startsWith('arabic-passage')
    && e.sourceStart! >= lines[0].sourceStart && e.sourceStart! < lines.at(-1)!.passageEnd);
  assert.deepEqual(inside, [], 'nothing else is underlined while the passage is read');
  assert.ok(parsed.events.some(e => e.targetRegionId === mention!.region.id && e.sourceStart! > SOLUTION.indexOf('Parçada')));
});
