import test from 'node:test';
import assert from 'node:assert/strict';
import { pageHash, parseHash } from '../src/layouts/route';

test('studio addresses: every page round-trips and the editor names its question', () => {
  for (const page of ['dashboard', 'questions', 'batch', 'settings', 'admin', 'help'] as const) assert.equal(parseHash(pageHash(page)).page, page);
  assert.equal(pageHash('editor', 'a1b2'), '#/soru/a1b2');
  assert.deepEqual(parseHash('#/soru/a1b2'), { page: 'editor', projectId: 'a1b2' });
  assert.deepEqual(parseHash('#/soru'), { page: 'editor' });
  assert.equal(parseHash('').page, 'dashboard');
  assert.equal(parseHash('#access_token=abc&type=recovery').page, 'dashboard', 'sign-in callbacks open the dashboard');
  assert.equal(parseHash('#/bilinmeyen').page, 'dashboard');
  assert.equal(pageHash('help', 'google-anahtari'), '#/yardim/google-anahtari');
  assert.deepEqual(parseHash('#/yardim/google-anahtari'), { page: 'help', topic: 'google-anahtari' });
});
