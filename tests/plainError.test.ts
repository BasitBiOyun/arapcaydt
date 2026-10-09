import test from 'node:test';
import assert from 'node:assert/strict';
import { NETWORK_MESSAGE, plainMessage } from '../src/services/plainError';

test('studio messages stay as written; technical English becomes plain Turkish', () => {
  assert.equal(plainMessage(new Error('Bu tarayıcı MP4 kodlamayı desteklemiyor.'), 'x'), 'Bu tarayıcı MP4 kodlamayı desteklemiyor.');
  assert.equal(plainMessage(new TypeError('Failed to fetch'), 'x'), NETWORK_MESSAGE);
  assert.equal(plainMessage(new TypeError("Cannot read properties of undefined (reading 'words')"), 'İşaretler hazırlanamadı.'),
    'İşaretler hazırlanamadı. Tekrar deneyin; sürerse "Sorun bildir" ile bize iletin.');
  assert.equal(plainMessage(undefined, 'Kaydedilemedi.'), 'Kaydedilemedi.');
  assert.equal(plainMessage({ message: 'duplicate key value violates unique constraint' }, 'Kaydedilemedi.'), 'Kaydedilemedi. Tekrar deneyin; sürerse "Sorun bildir" ile bize iletin.');
});
