import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsFile } from '../src/components/common/FileDrop';

test('file picker accepts by extension, exact type or wildcard, case-insensitively', () => {
  const images = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
  assert.equal(acceptsFile({ name: 'soru_3.PNG', type: '' }, images), true, 'extension, any case, missing type');
  assert.equal(acceptsFile({ name: 'x', type: 'image/webp' }, images), true);
  assert.equal(acceptsFile({ name: 'cozum.pdf', type: 'application/pdf' }, images), false);
  assert.equal(acceptsFile({ name: 'ses.mp3', type: 'audio/mpeg' }, '.mp3,audio/mpeg'), true);
  assert.equal(acceptsFile({ name: 'ses.wav', type: 'audio/wav' }, '.mp3,audio/mpeg'), false);
  assert.equal(acceptsFile({ name: 'a.gif', type: 'image/gif' }, 'image/*'), true);
  assert.equal(acceptsFile({ name: 'notlar.txt', type: 'text/plain' }, '.txt,.md,text/plain'), true);
});
