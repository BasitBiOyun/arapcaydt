import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_REQUEST_CHARS, missingAudioReason, neededMs } from '../api/gemini/generate';
import { PART_CHARS } from '../src/services/narration/narrationParts';

test('a part always fits the time budget; a 5,000-character text leaves no room for a second model', () => {
  assert.ok(neededMs(PART_CHARS) < 40_000, 'one part of a long solution is quick');
  assert.ok(neededMs(MAX_REQUEST_CHARS) > 95_000 / 2, 'no second slow try after a long first one');
});

test('a reply without audio says why, for the admin failure list', () => {
  assert.equal(missingAudioReason({ candidates: [{ finishReason: 'OTHER', content: { parts: [{ text: 'x' }] } }] }), 'neden OTHER, yalnız yazı döndü');
  assert.equal(missingAudioReason({ promptFeedback: { blockReason: 'SAFETY' } }), 'engel SAFETY, aday yok');
  assert.equal(missingAudioReason({ candidates: [{}] }), 'ayrıntı yok');
});
