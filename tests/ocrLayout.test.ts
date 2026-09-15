import test from 'node:test';
import assert from 'node:assert/strict';
import { detectYdtQuestionRegions } from '../src/services/ocr/ydtQuestionDetector';
import { findArabicMatchesInOcr, groupOcrWordsIntoLines } from '../src/services/ocr/arabicMatcher';
import type { OCRResult, OCRWord } from '../src/services/ocr/ocrTypes';

function word(text: string, x: number, y: number, width = 0.06, height = 0.04): OCRWord {
  return { text, confidence: 96, x, y, width, height, pixelX: x * 1920,
    pixelY: y * 1080, pixelWidth: width * 1920, pixelHeight: height * 1080 };
}
function ocr(words: OCRWord[]): OCRResult {
  return { words, text: words.map((word) => word.text).join(' '), lines: [], imageWidth: 1920, imageHeight: 1080 };
}

test('Konak two-column choices keep all five labels and use tight non-overlapping boxes', () => {
  const options = [
    word('A)', .26, .52, .025), word('استخدام', .29, .52, .075),
    word('B)', .515, .52, .025), word('اختيار', .55, .52, .06),
    word('C)', .26, .62, .025), word('استفهام', .29, .62, .075),
    word('D)', .515, .62, .025), word('اجتماع', .55, .62, .065),
    word('E)', .40, .71, .025), word('اكتمال', .435, .71, .065),
  ];
  const result = detectYdtQuestionRegions(ocr([
    word('YDT', .10, .07), word('برج', .7, .37), word('الساعة', .6, .37), word('يقع', .8, .37), ...options,
  ]));
  assert.deepEqual(result.detectedOptions, ['A', 'B', 'C', 'D', 'E']);
  const choices = result.regions.filter((region) => region.type.startsWith('option'));
  for (const region of choices) {
    assert.ok(region.width < .15, `${region.id} should hug its own option text`);
    assert.ok(region.height < .065, `${region.id} should not fill the space to next row`);
  }
  assert.ok(!choices[0].content?.includes('اختيار'));
  assert.ok(!result.questionPromptRegion?.content?.includes('YDT'));
});

test('single-column multiline choice includes continuation without swallowing next label', () => {
  const result = detectYdtQuestionRegions(ocr([
    word('A)', .10, .35, .03), word('الاختيار', .20, .35, .12), word('الأول', .20, .395, .07),
    word('B)', .10, .48, .03), word('الثاني', .20, .48, .10),
    word('C)', .10, .60, .03), word('الثالث', .20, .60, .10),
    word('D)', .10, .72, .03), word('الرابع', .20, .72, .10),
    word('E)', .10, .84, .03), word('الخامس', .20, .84, .10),
  ]));
  assert.deepEqual(result.detectedOptions, ['A', 'B', 'C', 'D', 'E']);
  const first = result.regions.find((region) => region.id === 'option-a')!;
  assert.ok(first.content?.includes('الأول'));
  assert.ok(!first.content?.includes('الثاني'));
  assert.ok(first.height < .11);
});

test('Arabic phrases match RTL physical order, punctuation, and vocalized narration', () => {
  const words = [word('الساعة،', .45, .2, .10), word('برج', .57, .201, .07), word('يقع', .65, .2, .06)];
  const matches = findArabicMatchesInOcr('يَقَعُ بُرْجُ السَّاعَةِ', words);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].matchedWords.map((word) => word.text), ['يقع', 'برج', 'الساعة،']);
  assert.ok(matches[0].region.height < .055);
});

test('wrapped Arabic phrase creates one tight region per physical line', () => {
  const words = [word('في', .3, .2, .04), word('ميدان', .2, .2, .08), word('كوناك', .70, .26, .09)];
  const matches = findArabicMatchesInOcr('فِي مَيْدَانِ كُونَاك', words);
  assert.equal(matches.length, 2);
  assert.notEqual(matches[0].region.id, matches[1].region.id);
  assert.ok(matches.every((match) => match.region.height < .055));
  assert.ok(matches.every((match) => match.region.width < .16));
});

test('Arabic matcher does not join unrelated columns or invent an unmatched region', () => {
  assert.equal(findArabicMatchesInOcr('اجتماع السكان', [word('اجتماع', .8, .3), word('السكان', .2, .3)]).length, 0);
  assert.equal(findArabicMatchesInOcr('اجتماع', [word('اكتمال', .8, .3)]).length, 0);
});

test('baseline grouping tolerates uneven Arabic ascenders and is independent of input order', () => {
  const a = word('يقع', .7, .202, .07, .03);
  const b = word('برج', .6, .195, .07, .05);
  const c = word('الساعة', .45, .203, .10, .04);
  const d = word('كوناك', .7, .3, .10, .04);
  assert.deepEqual(groupOcrWordsIntoLines([c, a, d, b]).map((row) => row.map((word) => word.text)),
    [['يقع', 'برج', 'الساعة'], ['كوناك']]);
});

test('real Konak OCR recovers damaged C marker only from confirmed grid and strips bidi controls', () => {
  // Coordinates/text transcribed from Tesseract's output for the original 1920x1080 slide.
  const raw: [string, number, number, number, number][] = [
    ['\u200fيقع',1399,410,1455,462], ['برج',1316,423,1384,463], ['الساعة',1182,405,1300,445],
    ['الذي',1095,406,1167,462], ['يعد',1028,420,1077,456], ['رمز',943,415,1012,455],
    ['إزمير',835,413,928,456], ['في',774,406,821,463], ['ميدان\u200e',664,413,759,456],
    ['\u200f”كوناك»؛',1288,472,1452,518], ['وهو',1196,481,1271,518], ['مكان',1101,475,1184,518],
    ['سكان',909,475,1001,518], ['إزمير',800,476,893,518], ['حاليا.\u200e',692,472,785,518],
    ['A)',510,559,548,594], ['\u200fاستخدام\u200e',561,564,685,612],
    ['B)',1003,559,1038,594], ['\u200fاختيار\u200e',1052,563,1152,607],
    ['0)',512,657,550,693], ['\u200fاستفهام\u200e',561,656,675,715],
    ['D)',1003,657,1039,693], ['\u200fاجتماع\u200e',1050,656,1163,716],
    ['E)',783,755,818,791], ['\u200fاكتمال\u200e',829,758,932,799],
  ];
  const words = raw.map(([text, x0, y0, x1, y1]) => word(text, x0 / 1920, y0 / 1080, (x1-x0)/1920, (y1-y0)/1080));
  const layout = detectYdtQuestionRegions(ocr(words));
  assert.deepEqual(layout.detectedOptions, ['A', 'B', 'C', 'D', 'E']);
  assert.ok(layout.regions.filter((region) => region.type.startsWith('option')).every((region) => region.width < .12));
  const phraseMatches = findArabicMatchesInOcr('يَقَعُ بُرْجُ السَّاعَةِ\nفِي مَيْدَانِ كُونَاك\nاِجْتِمَاعٌ', words);
  assert.equal(phraseMatches.length, 4); // tower; square across two lines; D word
  assert.ok(phraseMatches.every((match) => match.region.height < .065));
  assert.equal(detectYdtQuestionRegions(ocr([word('0)', .2, .4)])).detectedOptions.length, 0);
});
