import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { createZip, crc32, readZip, zipSafeName } from '../src/services/zip';
import { BACKUP_MANIFEST, backupFileName, buildBackup, readBackup } from '../src/features/projects/backup';
import { TRASH_DAYS, trashDaysLeft, trashExpired } from '../src/features/projects/trash';
import type { QuestionProject } from '../src/types';

const bytes = (text: string) => new TextEncoder().encode(text);

test('zip: files written are read back byte for byte, with Turkish and Arabic names', async () => {
  const entries = [
    { name: 'Deneme 1 – Soru 5.mp4', data: bytes('video') },
    { name: 'klasör/سؤال.txt', data: bytes('مرحبا') },
    { name: 'boş.txt', data: new Uint8Array() },
  ];
  const zip = await createZip(entries).arrayBuffer();
  const back = await readZip(zip);
  assert.deepEqual(back.map(e => e.name), entries.map(e => e.name));
  back.forEach((e, i) => assert.deepEqual([...e.data], [...entries[i].data]));
  assert.equal(crc32(bytes('123456789')), 0xcbf43926, 'standard CRC-32 check value');
});

test('zip: a deflated file (re-packed on a computer) is also read', async () => {
  const text = 'tekrar '.repeat(200);
  const packed = deflateRawSync(Buffer.from(text));
  // One-entry ZIP with method 8, built by hand.
  const name = bytes('a.txt');
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc32(bytes(text)), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(text.length, 22); local.writeUInt16LE(name.length, 26);
  const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(8, 10);
  dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(text.length, 24); dir.writeUInt16LE(name.length, 28); dir.writeUInt32LE(0, 42);
  const centralStart = 30 + name.length + packed.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(centralStart, 16);
  const file = Buffer.concat([local, name, packed, dir, name, end]);
  const [entry] = await readZip(file.buffer.slice(file.byteOffset, file.byteOffset + file.length));
  assert.equal(new TextDecoder().decode(entry.data), text);
});

test('zip: a file that is not a ZIP gets a Turkish message', async () => {
  await assert.rejects(readZip(bytes('merhaba').buffer as ArrayBuffer), /ZIP dosyası değil/);
  assert.equal(zipSafeName('a/b:c*?'), 'a b c');
});

const project = (id: string, extra: Partial<QuestionProject> = {}): QuestionProject => ({
  id, ownerId: 'teacher', title: `Soru ${id}`, examYear: '2026', questionNumber: 1, category: 'soru-coz', correctAnswer: 'C', status: 'draft',
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z', imageUrl: `https://signed/${id}/img`, solutionText: 'Cevap C. الجواب',
  narrationSource: { type: 'gemini', audioUrl: `https://signed/${id}/voice`, duration: 12, isApproved: true } as any,
  audioNarration: { audioUrl: `https://signed/${id}/voice`, duration: 12, voiceId: 'v' } as any,
  videoConfig: { aspectRatio: '16:9', fps: 30, backgroundColor: '#fff', showWatermark: true, annotations: [], regions: [{ id: 'option-c' }] } as any,
  ...extra,
});

test('backup: questions, pictures and voices survive a round trip; one voice file is stored once', async () => {
  const files: Record<string, Blob> = {
    'https://signed/p1/img': new Blob([bytes('IMG1')], { type: 'image/webp' }),
    'https://signed/p1/voice': new Blob([bytes('MP3-1')], { type: 'audio/mpeg' }),
    'https://signed/p2/img': new Blob([bytes('IMG2')], { type: 'image/png' }),
    'https://signed/p2/voice': new Blob([bytes('MP3-2')], { type: 'audio/mpeg' }),
  };
  const fetched: string[] = [];
  const progress: number[] = [];
  const zip = await buildBackup([project('p1'), project('p2', { deletedAt: '2026-09-03T00:00:00Z' })],
    async url => { fetched.push(url); return files[url]; }, p => progress.push(p.done));
  assert.equal(fetched.length, 4, 'shared narration fetched once per question');
  assert.deepEqual(progress, [1, 2]);
  const names = (await readZip(await zip.arrayBuffer())).map(e => e.name);
  assert.equal(names[0], BACKUP_MANIFEST);
  assert.ok(names.includes('dosyalar/p1/soru-gorseli.webp') && names.includes('dosyalar/p2/soru-gorseli.png') && names.includes('dosyalar/p1/seslendirme.mp3'));

  const made: Blob[] = [];
  const restored = await readBackup(await zip.arrayBuffer(), blob => { made.push(blob); return `blob:${made.length}`; });
  assert.equal(restored.length, 2);
  const [a, b] = restored;
  assert.equal(a.solutionText, 'Cevap C. الجواب');
  assert.equal(a.correctAnswer, 'C');
  assert.deepEqual((a.videoConfig as any).regions, [{ id: 'option-c' }]);
  assert.equal(a.ownerId, undefined, 'the restoring account becomes the owner');
  assert.equal(b.deletedAt, undefined, 'a restored question is not in the recycle bin');
  assert.equal(await (made[0]).text(), 'IMG1');
  assert.equal(made[0].type, 'image/webp');
  assert.equal(await made[1].text(), 'MP3-1');
});

test('backup: inline sample pictures stay in the JSON; a ZIP that is not a backup is refused', async () => {
  const svg = 'data:image/svg+xml;base64,PHN2Zy8+';
  const zip = await buildBackup([project('s', { imageUrl: svg, narrationSource: undefined, audioNarration: undefined })], async () => { throw new Error('no fetch'); });
  const [back] = await readBackup(await zip.arrayBuffer(), () => 'blob:x');
  assert.equal(back.imageUrl, svg);
  const other = await createZip([{ name: 'foto.jpg', data: bytes('x') }]).arrayBuffer();
  await assert.rejects(readBackup(other), /Soru Stüdyosu yedeği değil/);
  assert.equal(backupFileName(new Date('2026-09-29T10:00:00Z')), 'soru-yedegi-2026-09-29.zip');
});

test('recycle bin: 30 days, then gone', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  assert.equal(TRASH_DAYS, 30);
  assert.equal(trashDaysLeft('2026-09-30T12:00:00Z', now), 30);
  assert.equal(trashDaysLeft('2026-08-31T13:00:00Z', now), 1);
  assert.equal(trashExpired('2026-08-31T12:00:00Z', now), true);
  assert.equal(trashExpired('2026-09-01T12:00:01Z', now), false);
  assert.equal(trashExpired(undefined, now), false);
});
