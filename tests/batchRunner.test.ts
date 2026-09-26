import test from 'node:test';
import assert from 'node:assert/strict';
import { runBatch, VOICE_SPACING_MS, type BatchDeps, type BatchRowState } from '../src/features/batch/batchRunner';
import type { BatchItem } from '../src/features/batch/batchPlan';
import type { QuestionProject } from '../src/types';

type F = { name: string };
const item = (number: number, extra: Partial<BatchItem<F>> = {}): BatchItem<F> =>
  ({ number, image: { name: `soru${number}.png` }, solution: `Soru ${number}\nDoğru cevap B.`, answer: 'B', problems: [], notes: [], ...extra });

function fakeDeps(overrides: Partial<BatchDeps<F>> = {}) {
  let clock = 0, ids = 0;
  const calls: string[] = [];
  const voiceTimes: number[] = [];
  const deps: BatchDeps<F> = {
    readDataUrl: async f => `data:image/png;base64,${f.name}`,
    createProject: async p => { calls.push(`create ${p.questionNumber}`); return { ...p, id: `p${++ids}`, createdAt: '', updatedAt: '' } as QuestionProject; },
    saveProject: async p => p,
    generateVoice: async p => { voiceTimes.push(clock); calls.push(`voice ${p.questionNumber}`); return { audioBase64: 'AA', mimeType: 'audio/mpeg', mode: 'live', durationSeconds: 10, words: [] }; },
    prepareUpload: async (p, f) => { voiceTimes.push(clock); calls.push(`upload ${f.name}`); return { source: { type: 'uploaded', audioUrl: 'x', duration: 9, words: [] }, compat: {} as any }; },
    runPipeline: async (p, declared) => { calls.push(`markers ${p.questionNumber} ${declared}`); clock += 3000;
      return { success: true, regions: ['a', 'b', 'c', 'd', 'e'].map(l => ({ id: `option-${l}`, type: `option-${l}`, label: l, x: 0, y: 0, width: .1, height: .1 })) as any,
        actions: [{ id: 'c', type: 'correct', targetRegionId: 'option-b', start: 1, duration: 1 }], stats: {} as any, duration: 10,
        captions: [], timingQuality: 'word-aligned', warnings: [], deducedCorrectAnswer: 'B' }; },
    exportVideo: async p => { calls.push(`export ${p.questionNumber}`); return new Blob(['mp4']); },
    download: (_b, p) => { calls.push(`download ${p.questionNumber}`); },
    recordExport: async () => {},
    wait: async ms => { clock += ms; },
    now: () => clock,
    ...overrides,
  };
  return { deps, calls, voiceTimes };
}
const collect = () => { const rows = new Map<number, BatchRowState>(); return { rows, update: (n: number, s: BatchRowState) => rows.set(n, s) }; };
const options = { category: 'soru-coz', examName: 'Deneme 3', examYear: '2026', generateVoice: true, exportVideo: true };

test('each question goes project → voice → markers → MP4 in order, with paid voice requests spaced', async () => {
  const { deps, calls, voiceTimes } = fakeDeps();
  const { rows, update } = collect();
  await runBatch([item(1), item(2, { audio: { name: 'soru2.mp3' } })], options, deps, update);
  assert.deepEqual(calls, ['create 1', 'voice 1', 'markers 1 B', 'export 1', 'download 1', 'create 2', 'upload soru2.mp3', 'markers 2 B', 'export 2', 'download 2']);
  assert.ok(voiceTimes[1] - voiceTimes[0] >= VOICE_SPACING_MS);
  assert.equal(rows.get(1)!.stage, 'done');
  assert.equal(rows.get(1)!.readiness, 'ready');
});

test('a failing question does not stop the batch; incomplete items are skipped', async () => {
  const { deps, calls } = fakeDeps({ runPipeline: async p => { if (p.questionNumber === 1) throw new Error('OCR hatası'); return fakeDeps().deps.runPipeline(p); } });
  const { rows, update } = collect();
  await runBatch([item(1), item(2, { problems: ['Görsel yok'] }), item(3)], options, deps, update);
  assert.equal(rows.get(1)!.stage, 'failed');
  assert.equal(rows.get(1)!.message, 'OCR hatası');
  assert.ok(rows.get(1)!.projectId, 'the created project stays available for the editor');
  assert.equal(rows.get(2)!.stage, 'skipped');
  assert.equal(rows.get(3)!.stage, 'done');
  assert.ok(!calls.includes('create 2'));
});

test('without paid narration, questions without MP3 are created and wait for audio; nothing paid is called', async () => {
  const { deps, calls } = fakeDeps({ generateVoice: async () => { throw new Error('must not be called'); } });
  const { rows, update } = collect();
  await runBatch([item(1)], { ...options, generateVoice: false }, deps, update);
  assert.deepEqual(calls, ['create 1']);
  assert.equal(rows.get(1)!.stage, 'done');
  assert.match(rows.get(1)!.message!, /ses bekleniyor/);
});

test('stop leaves remaining questions untouched', async () => {
  const controller = new AbortController();
  const { deps, calls } = fakeDeps({ exportVideo: async () => { controller.abort(); throw new DOMException('iptal', 'AbortError'); } });
  const { rows, update } = collect();
  await runBatch([item(1), item(2)], options, deps, update, controller.signal);
  assert.equal(rows.get(1)!.stage, 'stopped');
  assert.equal(rows.get(2)!.stage, 'stopped');
  assert.ok(!calls.includes('create 2'));
});
