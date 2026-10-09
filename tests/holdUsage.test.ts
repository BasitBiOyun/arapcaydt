import test from 'node:test';
import assert from 'node:assert/strict';
import { holdUsage } from '../server/usage';

/** A tiny activity table: insert → select id, count with filters, delete by id. */
function fakeDb() {
  const rows: Array<{ id: string; owner_id: string; kind: string; created_at: string }> = [];
  let next = 0;
  return {
    rows,
    from() {
      return {
        insert(row: any) {
          const r = { ...row, id: `r${++next}`, created_at: new Date().toISOString() };
          rows.push(r);
          return { select: () => ({ single: async () => ({ data: { id: r.id }, error: null }) }) };
        },
        select(_: string, _opts: unknown) {
          const filters: Array<(r: any) => boolean> = [];
          const q: any = {
            eq(k: string, v: string) { filters.push(r => r[k] === v); return q; },
            gte(k: string, v: string) { filters.push(r => r[k] >= v); return q; },
            then(resolve: (v: unknown) => void) { resolve({ count: rows.filter(r => filters.every(f => f(r))).length, error: null }); },
          };
          return q;
        },
        delete() { return { eq: async (_k: string, id: string) => { rows.splice(rows.findIndex(r => r.id === id), 1); return { error: null }; } }; },
      };
    },
  };
}

test('requests sent at once cannot all pass the daily ElevenLabs cap', async () => {
  const db = fakeDb();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const results = await Promise.all(Array.from({ length: 5 }, () => holdUsage(db, 't1', 'p1', 'elevenlabs_align', since, 2)));
  assert.ok(results.filter(r => r.allowed).length <= 2);
  assert.equal(db.rows.length, results.filter(r => r.allowed).length);
  // Another teacher's requests are counted on their own.
  assert.equal((await holdUsage(db, 't2', 'p9', 'elevenlabs_align', since, 2)).allowed, true);
});
