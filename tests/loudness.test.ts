import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGET_LUFS, integratedLoudness, normalizeLoudness } from '../src/features/video/engine/loudness';

const sine = (amp: number, seconds: number, rate = 48000, hz = 1000) =>
  Float32Array.from({ length: seconds * rate }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / rate));

test('a full-scale 1 kHz sine measures -3 LUFS (BS.1770 reference)', () => {
  assert.ok(Math.abs(integratedLoudness([sine(1, 3)], 48000) - -3.01) < 0.1);
  assert.ok(Math.abs(integratedLoudness([sine(1, 3, 44100)], 44100) - -3.01) < 0.1);
});

test('quiet and loud narration end at the same loudness', () => {
  const quiet = [sine(0.05, 3)], loud = [sine(0.3, 3)];
  normalizeLoudness(quiet, 48000); normalizeLoudness(loud, 48000);
  for (const ch of [quiet, loud]) assert.ok(Math.abs(integratedLoudness(ch, 48000) - TARGET_LUFS) < 0.2);
});

test('pauses do not pull the level up, and a loud spike never clips', () => {
  const speech = sine(0.1, 3), withSilence = new Float32Array(48000 * 6);
  withSilence.set(speech, 0);
  normalizeLoudness([speech], 48000); normalizeLoudness([withSilence], 48000);
  assert.ok(Math.abs(withSilence[1000] / speech[1000] - 1) < 0.05);
  const spiky = sine(0.02, 3); spiky[5000] = 1;
  normalizeLoudness([spiky], 48000);
  assert.ok(spiky.reduce((m, v) => Math.max(m, Math.abs(v)), 0) <= 0.8901);
});

test('silence is left alone', () => {
  const silent = [new Float32Array(48000 * 2)];
  assert.equal(normalizeLoudness(silent, 48000), 1);
});
