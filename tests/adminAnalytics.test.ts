import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProjects, CURRENT_PIPELINE_VERSION, type ProjectRow } from '../api/admin/analytics';
import { CURRENT_PIPELINE_VERSION as EDITOR_VERSION } from '../src/features/question-editor/readiness';

const options = ['option-a', 'option-b', 'option-c', 'option-d', 'option-e'];
const row = (id: string, over: Partial<ProjectRow> = {}): ProjectRow => ({
  id, owner_id: 't1', updated_at: `2026-09-2${id.slice(-1)}T10:00:00+00:00`, title: `Soru ${id}`, category: 'soru-coz',
  status: 'video_ready', videoReady: true, correctAnswer: 'C', pipelineVersion: CURRENT_PIPELINE_VERSION, timingQuality: 'word-aligned',
  regionIds: options, actions: [{ type: 'correct', targetRegionId: 'option-c' }], warnings: [], ...over,
});

test('admin analytics counts engines, Gemini models, fallbacks and timestamp sources from project audio', () => {
  const s = summarizeProjects([
    row('p1', { narrationType: 'gemini', modelId: 'gemini-3.8-flash-lite-tts', timingSource: 'gemini-transcribe' }),
    row('p2', { narrationType: 'gemini', modelId: 'gemini-3.8-flash-tts', timingSource: 'forced-alignment' }),
    row('p3', { narrationType: 'elevenlabs', fallbackReason: 'Gemini TTS başarısız. HTTP 429' }),
    row('p4', { narrationType: 'uploaded', timingSource: 'whisper' }),
    row('p5', { legacyModelId: 'eleven_multilingual_v2', actions: [] }),
    row('p6', { status: 'draft', videoReady: false, actions: [] }),
  ]);
  assert.deepEqual({ g: s.voice.gemini, e: s.voice.elevenlabs, f: s.voice.geminiFallbacks, u: s.voice.uploaded, n: s.voice.none }, { g: 2, e: 2, f: 1, u: 1, n: 1 });
  assert.deepEqual(s.voice.models, { 'gemini-3.8-flash-lite-tts': 1, 'gemini-3.8-flash-tts': 1 });
  assert.deepEqual(s.voice.timing, { 'gemini-transcribe': 1, 'forced-alignment': 1, 'elevenlabs-tts': 2, whisper: 1 });
  assert.deepEqual(s.funnel, { total: 6, withAudio: 5, withMarkers: 4, ready: 4 });
  assert.equal(s.members.t1.gemini, 2);
  assert.equal(s.members.t1.geminiFallbacks, 1);
  assert.ok(s.issues.some(i => i.projectId === 'p3' && i.detail.includes('ElevenLabs yedeği')));
});

test('admin quality mirrors the editor publish check', () => {
  assert.equal(CURRENT_PIPELINE_VERSION, EDITOR_VERSION, 'server and editor plan versions must match');
  const s = summarizeProjects([
    row('p1'),
    row('p2', { actions: [{ type: 'correct', targetRegionId: 'option-b' }] }),
    row('p3', { pipelineVersion: 4 }),
    row('p4', { timingQuality: 'anchored' }),
    row('p5', { regionIds: options.slice(0, 4) }),
    row('p6', { regionIds: options.slice(0, 3) }),
    row('p7', { narrationType: 'gemini', timingSource: 'none', warnings: ['Görselde eşleştirilemeyen Arapça kelimeler: فِي.'] }),
  ]);
  assert.deepEqual(s.quality, { ready: 2, check: 3, blocked: 2 });
  assert.ok(s.issues.some(i => i.projectId === 'p7' && i.detail.includes('kelime zamanı alınamadı')));
  assert.equal(s.issues.filter(i => i.detail.startsWith('Yayın kontrolü')).length, 2);
});
