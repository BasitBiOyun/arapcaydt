import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReadiness, CURRENT_PIPELINE_VERSION } from '../src/features/question-editor/readiness';
import type { QuestionProject, VideoAction } from '../src/types';

const option = (l: string) => ({ id: `option-${l}`, type: `option-${l}`, label: l, x: 0, y: 0, width: .1, height: .1 }) as any;
const project = (over: Partial<QuestionProject['videoConfig']> = {}, extra: Partial<QuestionProject> = {}) => ({
  id: 'p', title: 't', examYear: '', questionNumber: 1, category: 'soru-coz', correctAnswer: 'C', status: 'video_ready',
  createdAt: '', updatedAt: '', imageUrl: 'x', solutionText: 'A şıkkı olmaz. Doğru cevap C.',
  videoConfig: { aspectRatio: '16:9', fps: 30, backgroundColor: '#fff', showWatermark: false, annotations: [],
    regions: 'abcde'.split('').map(option), pipelineVersion: CURRENT_PIPELINE_VERSION, timingQuality: 'word-aligned',
    timelineActions: [{ id: 'c', type: 'correct', targetRegionId: 'option-c', start: 3, duration: 2 }] as VideoAction[], warnings: [], ...over },
  ...extra,
}) as QuestionProject;

test('complete, word-aligned question with the check on the selected answer is ready', () => {
  const r = assessReadiness(project());
  assert.equal(r.level, 'ready');
  assert.ok(r.items.every(i => i.status === 'ok'));
});

test('check on the wrong option, missing check, or text/answer mismatch blocks publishing', () => {
  const wrong = assessReadiness(project({ timelineActions: [{ id: 'c', type: 'correct', targetRegionId: 'option-b', start: 1, duration: 1 }] }));
  assert.equal(wrong.level, 'blocked');
  assert.equal(wrong.items.find(i => i.id === 'answer')!.action, 'timing');
  assert.equal(assessReadiness(project({ timelineActions: [] })).level, 'blocked');
  const mismatch = assessReadiness(project({}, { solutionText: 'Doğru cevap D.' }));
  assert.equal(mismatch.items.find(i => i.id === 'script')!.action, 'text');
  assert.equal(assessReadiness(project({ pipelineVersion: 4 })).items.find(i => i.id === 'plan')!.action, 'regenerate');
});

test('missing options and unread Arabic are warnings; four-option questions are complete', () => {
  const missing = assessReadiness(project({ regions: 'abce'.split('').map(option) }));
  assert.equal(missing.level, 'check');
  assert.match(missing.items[0].label, /Eksik şık: D/);
  const lgs = assessReadiness(project({ regions: 'abcd'.split('').map(option) }));
  assert.equal(lgs.items[0].status, 'ok');
  const saysE = assessReadiness(project({ regions: 'abcd'.split('').map(option) }, { solutionText: 'E şıkkı olmaz. Doğru cevap C.' }));
  assert.equal(saysE.items[0].status, 'warn');
  const arabic = assessReadiness(project({ warnings: ['Görselde eşleştirilemeyen Arapça kelimeler: فِي، مِنْ. Görselde bulunanları …'] }));
  assert.match(arabic.items.find(i => i.id === 'arabic')!.label, /2 Arapça/);
  assert.equal(assessReadiness(project({ timingQuality: 'anchored' })).level, 'check');
  assert.equal(assessReadiness(project({ timingQuality: 'approximate' })).level, 'blocked');
});
