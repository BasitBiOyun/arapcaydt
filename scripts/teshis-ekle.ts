/**
 * Keeps a teacher's teşhis file as a test, with today's underlines as the right ones:
 *   npm run teshis:ekle -- <teshis.json> <kısa-ad> ["not"]
 * Run it only after the underlines for that question are right; it prints them to check.
 * Running it again for a kept file (tests/fixtures/teshis/<ad>.json) takes today's result.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { replay, TESHIS_DIR, type Teshis } from '../tests/support/teshis';

const [source, name, note] = process.argv.slice(2);
if (!source || !name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('Kullanım: npm run teshis:ekle -- <teshis.json> <kısa-ad (a-z, 0-9, -)> ["not"]');
  process.exit(1);
}
const file: Teshis = JSON.parse(readFileSync(source, 'utf8'));
const teshis: Teshis = {
  note: note || file.note || `Teşhis dosyası: ${name}`,
  solutionText: file.solutionText,
  words: file.words.map(({ text, confidence, x, y, width, height }) => ({ text, confidence, x, y, width, height })),
  regions: file.regions.map(({ id, type, x, y, width, height }) => ({ id, type, x, y, width, height })),
  ...(file.image ? { image: { width: file.image.width, height: file.image.height } } : {}),
};
teshis.expect = replay(teshis);
writeFileSync(new URL(`${name}.json`, TESHIS_DIR), JSON.stringify(teshis, null, 1) + '\n');
console.log(`tests/fixtures/teshis/${name}.json yazıldı. Bugünkü çizgiler (doğru olduklarını kontrol edin):`);
for (const l of teshis.expect.passageLines) console.log(`  paragraf  y ${l.y}  ${l.phrase}`);
for (const p of teshis.expect.phrases) console.log(`  ifade     y ${p.y}  ${p.phrase}`);
