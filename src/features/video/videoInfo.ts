import type { ProjectSummary } from '../../types';
import { getCategoryLabel } from '../../config/categories';

type InfoSource = Pick<ProjectSummary, 'title' | 'examName' | 'examYear' | 'questionNumber' | 'topic' | 'category' | 'correctAnswer'>
  & { narrationSource?: { duration?: number }; audioNarration?: { duration?: number } };

/** "1:42" for a narration length in seconds; empty when unknown. */
export const lengthLabel = (seconds?: number) => seconds && seconds > 0
  ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : '';

/** A question's video facts as label/value pairs, in the order a teacher fills an upload form. */
export function videoInfo(p: InfoSource): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Başlık', p.title?.trim() || ''],
    ['Koleksiyon', p.examName?.trim() || ''],
    ['Sınav / yıl', p.examYear?.trim() || ''],
    ['Soru no', p.questionNumber ? String(p.questionNumber) : ''],
    ['Konu', p.topic?.trim() || ''],
    ['Kategori', p.category ? getCategoryLabel(p.category) : ''],
    ['Doğru cevap', p.correctAnswer || ''],
    ['Süre', lengthLabel(p.narrationSource?.duration || p.audioNarration?.duration)],
  ];
  return rows.filter(([, value]) => value);
}

/** The facts as plain lines to copy ("Konu: Hal"). */
export const videoInfoText = (p: InfoSource) => videoInfo(p).map(([label, value]) => `${label}: ${value}`).join('\n');

const COLUMNS = ['Başlık', 'Koleksiyon', 'Sınav / yıl', 'Soru no', 'Konu', 'Kategori', 'Doğru cevap', 'Süre'];

/** One row per question, for Excel (semicolons and a BOM so Turkish Excel opens it with the right letters). */
export function videoInfoCsv(list: InfoSource[]): string {
  const cell = (v: string) => /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = list.map(p => { const info = new Map(videoInfo(p)); return COLUMNS.map(c => cell(info.get(c) || '')).join(';'); });
  return '﻿' + [COLUMNS.join(';'), ...lines].join('\r\n') + '\r\n';
}
