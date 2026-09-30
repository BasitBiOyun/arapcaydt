import test from 'node:test';
import assert from 'node:assert/strict';
import { logged } from '../server/errorLog';
import { tokenMatches } from '../api/admin/monitor';

const response = () => {
  const res: any = { code: 0, body: undefined };
  res.status = (code: number) => { res.code = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
};

test('server errors: 5xx answers and crashes are kept, the answer itself is unchanged', async () => {
  const kept: Array<[string, number, string]> = [];
  const save = async (route: string, status: number, message: string) => { kept.push([route, status, message]); };
  const failing = logged('/api/x', (_req, res) => res.status(502).json({ error: 'Google yanıt vermedi', code: 'UPSTREAM' }), save);
  const res = response();
  await failing({ headers: {} }, res);
  assert.deepEqual([res.code, res.body], [502, { error: 'Google yanıt vermedi', code: 'UPSTREAM' }]);
  assert.deepEqual(kept, [['/api/x', 502, 'Google yanıt vermedi [UPSTREAM]']]);

  await logged('/api/ok', (_req, res) => res.status(429).json({ error: 'kota' }), save)({ headers: {} }, response());
  assert.equal(kept.length, 1, 'only server failures are kept');

  await assert.rejects(logged('/api/crash', () => { throw new Error('boom'); }, save)({ headers: {} }, response()), /boom/);
  assert.deepEqual(kept[1], ['/api/crash', 500, 'Çöktü: boom']);
});

test('morning report: opened only with the long secret, never with a guess', () => {
  const secret = 'a'.repeat(40);
  assert.equal(tokenMatches(`Bearer ${secret}`, secret), true);
  assert.equal(tokenMatches(`Bearer ${'a'.repeat(39)}`, secret), false);
  assert.equal(tokenMatches(secret, secret), false, 'needs the Bearer form');
  assert.equal(tokenMatches('Bearer short', 'short'), false, 'a short secret switches the report off');
  assert.equal(tokenMatches('Bearer x', undefined), false);
});
