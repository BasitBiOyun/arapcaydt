import test from 'node:test';
import assert from 'node:assert/strict';
import { cannotPrepare, prepareOne } from '../src/features/batch/prepareMarks';
import { CURRENT_PIPELINE_VERSION } from '../src/features/question-editor/readiness';
import type { QuestionProject } from '../src/types';

const option = (l: string) => ({ id: `option-${l}`, type: `option-${l}`, label: l.toUpperCase(), x: 0, y: .1, width: .1, height: .1 }) as any;
const question = (extra: Partial<QuestionProject> = {}) => ({
  id: 'p', title: 'Soru 1', examYear: '', questionNumber: 1, category: 'soru-coz', correctAnswer: 'C', status: 'audio_approved',
  createdAt: '', updatedAt: '', imageUrl: 'data:image/png;base64,x', solutionText: 'Doğru cevap C.', audioApproved: true,
  narrationSource: { type: 'uploaded', audioUrl: 'a.mp3', duration: 10, words: [], isApproved: true },
  videoConfig: { aspectRatio: '16:9', fps: 30, backgroundColor: '#fff', showWatermark: false, annotations: [] },
  ...extra,
}) as QuestionProject;

test('bulk marks: finished, voiceless or empty questions are left out with a reason', () => {
  assert.equal(cannotPrepare(question()), null);
  assert.match(cannotPrepare(question({ completedAt: '2026-09-30T10:00:00Z' }))!, /Tamamlanmış/);
  assert.match(cannotPrepare(question({ audioApproved: false, narrationSource: undefined }))!, /Ses adımını/);
  assert.match(cannotPrepare(question({ solutionText: '  ' }))!, /Çözüm metni yok/);
});

test('bulk marks: a prepared question carries the new plan and says what is left to check', async () => {
  const seen: unknown[] = [];
  const { project, row } = await prepareOne(question(), async params => {
    seen.push(params);
    return {
      success: true, regions: 'abcde'.split('').map(option), duration: 10, timingQuality: 'word-aligned', captions: [],
      actions: [{ id: 'c', type: 'correct', targetRegionId: 'option-c', start: 3, duration: 2 }],
      warnings: [], ocrEngine: 'tesseract', stats: {} as any,
    } as any;
  });
  assert.equal(seen.length, 1);
  assert.equal(project!.videoConfig.pipelineVersion, CURRENT_PIPELINE_VERSION);
  assert.equal(row.state, 'ready');
  assert.match(row.note!, /tarayıcıdaki okuyucuyla/);
  const skipped = await prepareOne(question({ completedAt: 'x' }), async () => { throw new Error('not run'); });
  assert.deepEqual([skipped.project, skipped.row.state], [null, 'skipped']);
});
