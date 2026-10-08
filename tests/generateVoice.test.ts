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

test('a used-up best model asks plainly, with today’s count; no answer from Google says so', async () => {
  const { voiceFailure, TopModelUnavailableError, askLowerWith, VOICE_RETRY_MESSAGE } = await import('../src/services/narration/narrationService');
  const daily = voiceFailure(409, { code: 'TOP_MODEL_UNAVAILABLE', reason: 'daily', used: 10, limit: 30, error: 'En üst düzey modelin bugünkü kullanım hakkı bitti.' });
  assert.ok(daily instanceof TopModelUnavailableError);
  let asked: any;
  assert.equal(await askLowerWith(async o => { asked = o; return true; })(daily as InstanceType<typeof TopModelUnavailableError>), true);
  assert.equal(asked.title, 'En üst düzey modelin bugünkü kullanım hakkı bitti');
  assert.match(asked.message, /Bugün 10 \/ 30 ses kullanıldı/);
  assert.doesNotMatch(asked.message, /yedek|olumsuz|telaffuz/i);
  assert.equal(asked.confirmLabel, 'Sonraki modele geç');
  assert.equal(asked.cancelLabel, 'Kapat');

  const quiet = voiceFailure(503, { code: 'GOOGLE_NO_ANSWER', fallbackAllowed: false, error: 'Google’dan cevap gelmedi. Birkaç dakika sonra tekrar deneyin.' });
  assert.ok(!(quiet instanceof TopModelUnavailableError));
  assert.equal(quiet.message, VOICE_RETRY_MESSAGE);
  const refused = voiceFailure(422, { code: 'CONTENT_REFUSED', fallbackAllowed: false, error: 'Google bu metni seslendirmedi.' });
  assert.equal(refused.message, 'Google bu metni seslendirmedi.');
});
