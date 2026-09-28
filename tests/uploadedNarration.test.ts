import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareUploadedNarration } from '../src/services/narration/uploadedNarration';

const file = (size = 1000) => ({ name: 'ders.mp3', type: 'audio/mpeg', size } as File);
const base = {
  readDataUrl: async () => 'data:audio/mpeg;base64,QUJD',
  readDuration: async () => 42.123,
  transcribe: async () => ({ words: [{ text: 'whisper', start: 0, end: 1 }], duration: 41 }),
};

test('a teacher\'s MP3 is stored first and timed on the server (Gemini, then ElevenLabs), however large', async () => {
  let stored: any;
  const big = file(12 * 1024 * 1024);
  const result = await prepareUploadedNarration(big, { ...base,
    align: async untimed => { stored = untimed; return { words: [{ text: 'A', start: 1, end: 1.2 }], timingSource: 'gemini-transcribe' }; },
    transcribe: async () => { throw new Error('Whisper must not run'); } });
  assert.equal(stored.source.type, 'uploaded');
  assert.equal(stored.source.mimeType, 'audio/mpeg', 'the server needs the real type to read an MP3');
  assert.deepEqual(stored.source.words, [], 'saved untimed, before the server is asked');
  assert.equal(result.source.timingSource, 'gemini-transcribe');
  assert.deepEqual(result.source.words, [{ text: 'A', start: 1, end: 1.2 }]);
  assert.equal(result.source.duration, 42.12);
  assert.equal(result.compat.modelId, 'gemini-transcribe');
  assert.equal(result.notice, undefined);
});

test('server failure or no words fall back to Whisper with a plain notice', async () => {
  const failed = await prepareUploadedNarration(file(), { ...base, align: async () => { throw new Error('Gemini Transcribe: 429 · ElevenLabs: 401'); } });
  assert.equal(failed.source.timingSource, 'whisper');
  assert.doesNotMatch(failed.notice!, /429|401/, 'the technical chain is not shown to the teacher');
  assert.match(failed.notice!, /bilgisayarınızda/);
  const empty = await prepareUploadedNarration(file(), { ...base, align: async () => ({ words: [], timingSource: 'forced-alignment' as const }) });
  assert.equal(empty.source.timingSource, 'whisper');
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
