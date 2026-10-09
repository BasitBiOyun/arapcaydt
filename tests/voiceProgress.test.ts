import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedVoiceSeconds, nextVoiceStage, startVoiceProgress, voiceSteps, voiceWaitNote } from '../src/features/question-editor/voiceProgress';

test('voicing shows real steps in order, with the part being voiced for a long text', () => {
  const short = nextVoiceStage(startVoiceProgress('Doğru cevap C.', 1, 0), 'voicing', 1, 0);
  assert.deepEqual(voiceSteps(short).map(s => `${s.state}:${s.label}`), ['done:Soru kaydediliyor', 'active:Ses üretiliyor', 'todo:Kelime zamanları alınıyor']);
  const long = nextVoiceStage(startVoiceProgress('x'.repeat(6000), 2, 0), 'voicing', 2, 0);
  assert.deepEqual(voiceSteps(long).map(s => s.state), ['done', 'active', 'todo', 'todo']);
  assert.equal(voiceSteps(long)[1].label, 'Ses üretiliyor (2/2. bölüm)');
  assert.deepEqual(voiceSteps(nextVoiceStage(long, 'timing')).map(s => s.state), ['done', 'done', 'done', 'active']);
});

test('the wait note tells the elapsed and the usual time, and says so plainly when Google is slow', () => {
  const p = startVoiceProgress('a'.repeat(1200), 1, 0);
  assert.equal(expectedVoiceSeconds('a'.repeat(1200)), 40);
  assert.equal(voiceWaitNote(p, 25_000), '0:25 geçti. Bu uzunlukta bir metin genelde 0:40 sürer.');
  assert.match(voiceWaitNote(p, 120_000), /^2:00 geçti\. Google bugün yavaş/);
});
