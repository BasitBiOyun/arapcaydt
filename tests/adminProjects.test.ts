import test from 'node:test';
import assert from 'node:assert/strict';
import { progressLabel, projectsCsv, type AdminProjectRow } from '../src/features/admin/adminProjects';
import { activityKind } from '../src/features/admin/ActivityList';

const row = (over: Partial<AdminProjectRow> = {}): AdminProjectRow => ({
  id: 'p1', owner_id: 't1', updated_at: '2026-10-09T08:00:00Z', title: 'Soru 3', examName: 'Deneme 1', examYear: '2026', questionNumber: 3,
  topic: 'Hal', category: 'nahiv', correctAnswer: 'C', status: 'audio_approved', videoReady: false, completedAt: null, nsDuration: 102, anDuration: null, ...over,
});

test('the admin question list says where each question stands, finished first', () => {
  assert.equal(progressLabel(row()), 'Ses seçildi');
  assert.equal(progressLabel(row({ completedAt: '2026-10-08T00:00:00Z', status: 'draft' })), 'Tamamlandı');
  assert.equal(progressLabel(row({ videoReady: true })), 'Video hazır');
  assert.equal(progressLabel(row({ status: null })), 'Taslak');
});

test('the Excel list has one row per question with the teacher, collection and length', () => {
  const csv = projectsCsv([row({ title: 'Soru; "3"' })], () => 'Rabia Hoca');
  const [head, line] = csv.replace('﻿', '').split('\r\n');
  assert.equal(head.split(';')[0], 'Öğretmen');
  assert.ok(line.startsWith('Rabia Hoca;"Soru; ""3""";Deneme 1;2026;3;Hal;'));
  assert.ok(line.includes(';C;Ses seçildi;1:42;'));
});

test('every kind of activity row gets a plain label (no voice request shown as "Üyelik")', () => {
  assert.equal(activityKind({ kind: 'gemini_tts', state: 'succeeded' }), 'Gemini seslendirme');
  assert.equal(activityKind({ kind: 'member_status', state: 'role_admin' }), 'Rol değişikliği');
  assert.equal(activityKind({ kind: 'member_status', state: 'approved' }), 'Üyelik');
});
