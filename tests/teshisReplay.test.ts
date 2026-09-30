import test from 'node:test';
import assert from 'node:assert/strict';
import { differences, loadTeshisFiles, replay } from './support/teshis';

// Every teşhis file a teacher sent, once its problem was fixed, stays fixed. Add one with
// `npm run teshis:ekle -- <indirilen-dosya.json> <kısa-ad>` after checking its underlines are right.
for (const { name, teshis } of loadTeshisFiles()) {
  test(`teşhis ${name}: underlines are still where they were found right`, () => {
    assert.ok(teshis.expect, `${name} has no kept result; add it with npm run teshis:ekle`);
    const found = differences(teshis.expect!, replay(teshis));
    assert.deepEqual(found, [], `${teshis.note || name}\n${found.join('\n')}`);
  });
}
