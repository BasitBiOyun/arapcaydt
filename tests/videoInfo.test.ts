import test from 'node:test';
import assert from 'node:assert/strict';
import { videoInfoCsv, videoInfoText } from '../src/features/video/videoInfo';

const q = { title: 'Soru 3', examName: 'Eylül Denemesi; 1', examYear: '2026', questionNumber: 3, topic: 'İsm-i mevsul', category: 'deneme',
  correctAnswer: 'C' as const, narrationSource: { duration: 102.4 } };

test('video facts read as lines to copy; empty facts are left out', () => {
  assert.equal(videoInfoText(q), 'Başlık: Soru 3\nKoleksiyon: Eylül Denemesi; 1\nSınav / yıl: 2026\nSoru no: 3\nKonu: İsm-i mevsul\nKategori: Deneme\nDoğru cevap: C\nSüre: 1:42');
  assert.equal(videoInfoText({ ...q, topic: undefined, examYear: '', narrationSource: undefined }).includes('Konu'), false);
});

test('the Excel list has one row per question, quoting cells that hold a semicolon', () => {
  const csv = videoInfoCsv([q, { ...q, title: 'Soru "4"', questionNumber: 4, topic: undefined }]);
  const lines = csv.replace('﻿', '').trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], 'Soru 3;"Eylül Denemesi; 1";2026;3;İsm-i mevsul;Deneme;C;1:42');
  assert.equal(lines[2].split(';')[0], '"Soru ""4"""');
  assert.ok(csv.startsWith('﻿'));
});
