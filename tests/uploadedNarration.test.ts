import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareUploadedNarration, MAX_ALIGN_AUDIO_BYTES } from '../src/services/narration/uploadedNarration';

const file = (size = 1000) => ({ name: 'ders.mp3', type: 'audio/mpeg', size } as File);
const base = {
  readDataUrl: async () => 'data:audio/mpeg;base64,QUJD',
  readDuration: async () => 42.123,
  transcribe: async () => ({ words: [{ text: 'whisper', start: 0, end: 1 }], duration: 41 }),
};

test('uploaded MP3 uses forced alignment of the written solution when available', async () => {
  let sent = '';
  const result = await prepareUploadedNarration(file(), { ...base,
    align: async (audio, mime) => { sent = `${audio}|${mime}`; return [{ text: 'A', start: 1, end: 1.2 }]; },
    transcribe: async () => { throw new Error('Whisper must not run'); } });
  assert.equal(sent, 'QUJD|audio/mpeg');
  assert.equal(result.source.timingSource, 'forced-alignment');
  assert.deepEqual(result.source.words, [{ text: 'A', start: 1, end: 1.2 }]);
  assert.equal(result.source.duration, 42.12);
  assert.equal(result.notice, undefined);
});

test('alignment failure, oversize files and missing text fall back to Whisper with a notice', async () => {
  const failed = await prepareUploadedNarration(file(), { ...base, align: async () => { throw new Error('HTTP 502'); } });
  assert.equal(failed.source.timingSource, 'whisper');
  assert.match(failed.notice!, /HTTP 502/);
  const big = await prepareUploadedNarration(file(MAX_ALIGN_AUDIO_BYTES + 1), { ...base, align: async () => { throw new Error('must not be called'); } });
  assert.equal(big.source.timingSource, 'whisper');
  assert.match(big.notice!, /3 MB/);
  const offline = await prepareUploadedNarration(file(), base);
  assert.equal(offline.source.timingSource, 'whisper');
  assert.equal(offline.notice, undefined);
});

test('when no timing can be found the audio is still kept, never blocking the teacher', async () => {
  const result = await prepareUploadedNarration(file(), { ...base, transcribe: async () => { throw new Error('no model'); } });
  assert.equal(result.source.timingSource, 'none');
  assert.deepEqual(result.source.words, []);
  assert.equal(result.source.duration, 42.12);
  assert.ok(result.notice);
  assert.equal(result.compat.audioUrl, 'data:audio/mpeg;base64,QUJD');
});
