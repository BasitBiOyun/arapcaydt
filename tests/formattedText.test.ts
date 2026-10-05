import test from 'node:test';
import assert from 'node:assert/strict';
import { boldParts, formattedBlocks } from '../src/components/common/formattedText';

test('announcement text keeps bold and list lines as typed by Claude', () => {
  const text = '---\n**Yeni neler var?**\n\nDeğerli hocalarım:\n\n- **Mesajlar:** Artık yazabilirsiniz.\n- **Konu:** Süzebilirsiniz.\n\nKolay gelsin.\n---';
  assert.deepEqual(formattedBlocks(text), [
    { kind: 'line', text: '**Yeni neler var?**' },
    { kind: 'line', text: '' },
    { kind: 'line', text: 'Değerli hocalarım:' },
    { kind: 'line', text: '' },
    { kind: 'list', items: ['**Mesajlar:** Artık yazabilirsiniz.', '**Konu:** Süzebilirsiniz.'] },
    { kind: 'line', text: '' },
    { kind: 'line', text: 'Kolay gelsin.' },
  ]);
  assert.deepEqual(boldParts('- yok **Mesajlar:** var'), ['- yok ', 'Mesajlar:', ' var']);
  assert.deepEqual(boldParts('5 ** 2 tek yıldız'), ['5 ** 2 tek yıldız']);
});

test('plain text and HTML-looking text stay plain lines', () => {
  assert.deepEqual(formattedBlocks('<b>x</b>\r\n-5 puan'), [{ kind: 'line', text: '<b>x</b>' }, { kind: 'line', text: '-5 puan' }]);
});
