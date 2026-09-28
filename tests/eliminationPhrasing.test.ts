import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSolutionSemantics } from '../src/services/analysis/solutionParser';
import type { AnnotationRegion } from '../src/types';

const regions = ['A', 'B', 'C', 'D', 'E'].map(l => ({ id: `option-${l.toLowerCase()}`, type: 'option', label: l, x: 0, y: 0, width: .2, height: .1 })) as AnnotationRegion[];
const verdicts = (text: string, declared: 'A' | 'B' | 'C' | 'D' | 'E' = 'D') => parseSolutionSemantics(text, regions, [], declared).verdicts!;

test('every wrong option discussed in the text is crossed, however the teacher words it', () => {
  const v = verdicts([
    'Soru 5.',
    'A şıkkı الْكِتَابُ. Bu kelimenin cümleyle ilgisi yoktur.',
    'B ve E şıkları ise anlam bakımından bağlama oturmuyor.',
    'C şıkkı: الْقَلَمُ. Bu kelime kalem demektir.',
    'D şıkkı الْمَدْرَسَةُ, tam olarak uygundur.',
    'Doğru cevap D şıkkı.',
  ].join('\n'));
  assert.deepEqual(v.A, { stance: 'rejected', trigger: 'ilgisi yok', inferred: false });
  assert.equal(v.B?.trigger, 'oturmuyor');
  assert.equal(v.E?.trigger, 'oturmuyor');
  assert.deepEqual(v.C, { stance: 'rejected', trigger: 'demektir.', inferred: true }, 'no verdict at all: crossed at the end of its explanation');
  assert.equal(v.D?.stance, 'correct');
});

test('an explicit verdict later in the explanation sets the moment; a description only when none follows', () => {
  const v = verdicts('A şıkkı anlamsız bir ifade ortaya çıkarır. Olmaz.\nB şıkkı ise cümleye bir anlam katmamaktadır.\nDoğru cevap D.');
  assert.equal(v.A?.trigger, 'Olmaz');
  assert.equal(v.B?.trigger, 'katmamaktadır');
});

test('the answer is never crossed, and double negatives or look-alike words are not verdicts', () => {
  const v = verdicts('D şıkkı yanlış değildir; anlamı bozmaz, tam olarak uygundur.\nC şıkkı: namaz. Bu kelime burada namaz anlamındadır.\nDoğru cevap D şıkkı.');
  assert.equal(v.D?.stance, 'correct');
  assert.deepEqual(v.C, { stance: 'rejected', trigger: 'anlamındadır.', inferred: true }, '"namaz" is a noun, not "-maz"');
  const declaredOnly = verdicts('D şıkkı anlamı bozmaz ve cümleye uyar.\nA şıkkı olmaz.', 'D');
  assert.equal(declaredOnly.D?.stance, 'correct', 'the declared answer is not crossed by a descriptive negative');
});

test('options never mentioned stay unmarked', () => {
  const v = verdicts('A şıkkı olmaz.\nDoğru cevap D.');
  assert.equal(v.B, undefined);
  assert.equal(v.A?.trigger, 'olmaz');
});
