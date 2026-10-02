import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_REQUEST_CHARS, missingAudioReason, neededMs } from '../api/gemini/generate';
import { PART_CHARS } from '../src/services/narration/narrationParts';

test('a part always fits the time budget; a 5,000-character text leaves no room for a second model', () => {
  assert.ok(neededMs(PART_CHARS) < 95_000 / 2, 'one part fits the budget with room for a second model');
  assert.ok(neededMs(MAX_REQUEST_CHARS) > 95_000 / 2, 'no second slow try after a long first one');
});

test('a reply without audio says why, for the admin failure list', () => {
  assert.equal(missingAudioReason({ candidates: [{ finishReason: 'OTHER', content: { parts: [{ text: 'x' }] } }] }), 'neden OTHER, yalnız yazı döndü');
  assert.equal(missingAudioReason({ promptFeedback: { blockReason: 'SAFETY' } }), 'engel SAFETY, aday yok');
  assert.equal(missingAudioReason({ candidates: [{}] }), 'ayrıntı yok');
});

test('the best model being unavailable asks the teacher instead of a quota or retry message', async () => {
  const { voiceFailure, TopModelUnavailableError, askLowerWith } = await import('../src/services/narration/narrationService');
  const daily = voiceFailure(409, { code: 'TOP_MODEL_UNAVAILABLE', reason: 'daily', error: 'En üst düzey modelin bugünkü kullanım hakkı bitti.' });
  assert.ok(daily instanceof TopModelUnavailableError);
  assert.equal((daily as InstanceType<typeof TopModelUnavailableError>).reason, 'daily');
  assert.equal((voiceFailure(409, { code: 'TOP_MODEL_UNAVAILABLE', reason: 'busy' }) as any).reason, 'busy');
  let asked: any;
  assert.equal(await askLowerWith(async o => { asked = o; return true; })('daily'), true);
  assert.match(asked.title, /En üst düzey modelin bugünkü kullanım hakkı bitti/);
  assert.match(asked.message, /olumsuz cümleyi olumlu/);
  assert.equal(asked.confirmLabel, 'Yedek modelle seslendir');
});
