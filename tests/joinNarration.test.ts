import test from 'node:test';
import assert from 'node:assert/strict';
import { joinNarrationAudio, pcmFromWav } from '../server/mp3';

function wav(samples: number[], rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + samples.length * 2, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(samples.length * 2, 40);
  const body = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => body.writeInt16LE(s, i * 2));
  return Buffer.concat([h, body]);
}

test('voiced parts of a long solution become one narration in order', async () => {
  const mp3 = await joinNarrationAudio([Buffer.from([1, 2, 3]), Buffer.from([4, 5])]);
  assert.equal(mp3.mimeType, 'audio/mpeg');
  assert.deepEqual([...mp3.bytes], [1, 2, 3, 4, 5], 'MP3 parts are joined frame after frame');

  const tone = (n: number, v: number) => Array.from({ length: n }, (_, i) => (i % 2 ? v : -v));
  const joined = await joinNarrationAudio([wav(tone(24000, 3000)), wav(tone(12000, 5000))]);
  assert.equal(joined.mimeType, 'audio/mpeg', 'WAV parts are encoded once as MP3');
  assert.ok(joined.bytes.length > 1000);

  await assert.rejects(joinNarrationAudio([wav(tone(100, 1)), Buffer.from([1, 2])]), /farklı biçimde/);
  await assert.rejects(joinNarrationAudio([wav(tone(100, 1), 24000), wav(tone(100, 1), 16000)]), /örnekleme/);
  assert.ok(pcmFromWav(wav([1, 2, 3])));
});
