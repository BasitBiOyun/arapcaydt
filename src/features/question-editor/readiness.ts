import type { QuestionProject } from '../../types';
import { checkNarration } from './workflow';

export const CURRENT_PIPELINE_VERSION = 5;

export type ReadinessAction = 'regions' | 'timing' | 'regenerate' | 'text';
export interface ReadinessItem {
  id: 'options' | 'answer' | 'script' | 'timing' | 'arabic' | 'plan';
  status: 'ok' | 'warn' | 'fail';
  label: string;
  action?: ReadinessAction;
}
export interface Readiness {
  level: 'ready' | 'check' | 'blocked';
  items: ReadinessItem[];
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** One glance "can this be published?" summary of an animated question. */
export function assessReadiness(project: QuestionProject): Readiness {
  const config = project.videoConfig;
  const regions = config.regions || [];
  const actions = config.timelineActions || [];
  const items: ReadinessItem[] = [];

  const found = LETTERS.filter(l => regions.some(r => r.id === `option-${l.toLowerCase()}`));
  const missing = LETTERS.filter(l => !found.includes(l));
  const saysE = /(?<![\p{L}])E\s*(?:seçene|şı[kğ])|(?<![\p{L}])E['’]/u.test(project.solutionText);
  // Four options (A–D) is a complete LGS question unless the script talks about E.
  const complete = missing.length === 0 || (missing.join() === 'E' && !saysE && project.correctAnswer !== 'E');
  items.push(found.length === 0
    ? { id: 'options', status: 'fail', label: 'Görselde şık bulunamadı.', action: 'regions' }
    : complete
      ? { id: 'options', status: 'ok', label: `${found.length} şık bulundu (${found[0]}–${found[found.length - 1]}).` }
      : { id: 'options', status: 'warn', label: `Eksik şık: ${missing.join(', ')}. Görsel üzerinde işaretleyin.`, action: 'regions' });

  // Ticks on premises (I, II, III…) or phrases explain the text; the answer is the ticked option.
  const optionType = new Map((config.regions || []).map(r => [r.id, r.type]));
  const isOption = (id: string) => /^option-[a-e]$/i.test(id) || String(optionType.get(id) ?? '').startsWith('option-');
  const correctTargets = [...new Set(actions.filter(a => a.type === 'correct' && isOption(a.targetRegionId)).map(a => a.targetRegionId))];
  const answerId = `option-${project.correctAnswer.toLowerCase()}`;
  items.push(correctTargets.includes(answerId) && correctTargets.length === 1
    ? { id: 'answer', status: 'ok', label: `Doğru cevap ${project.correctAnswer} işaretleniyor.` }
    : correctTargets.length
      ? { id: 'answer', status: 'fail', label: `Tik ${correctTargets.map(id => id.slice(-1).toUpperCase()).join(', ')} şıkkında; seçili cevap ${project.correctAnswer}.`, action: 'timing' }
      : { id: 'answer', status: 'fail', label: 'Doğru cevaba tik eklenmemiş.', action: 'timing' });

  const script = checkNarration(project.solutionText, project.correctAnswer);
  if (script.mismatch) items.push({ id: 'script', status: 'fail', label: `Metin ${script.mismatch} diyor; seçili cevap ${project.correctAnswer}.`, action: 'text' });

  const quality = config.timingQuality;
  items.push(quality === 'word-aligned'
    ? { id: 'timing', status: 'ok', label: 'İşaretler kelime kelime sese bağlı.' }
    : quality === 'anchored'
      ? { id: 'timing', status: 'warn', label: 'Bazı işaretlerin zamanı komşu kelimelerden hesaplandı. Önizlemede dinleyin.', action: 'timing' }
      : { id: 'timing', status: 'fail', label: 'Ses zamanlaması bulunamadı; süreler yaklaşık.', action: 'timing' });

  const unread = (config.warnings || []).find(w => w.startsWith('Görselde eşleştirilemeyen Arapça kelimeler'));
  const count = unread ? (unread.split(':')[1]?.split('.')[0].split('،').filter(w => w.trim()).length ?? 0) : 0;
  items.push(unread
    ? { id: 'arabic', status: 'warn', label: `Görselde bulunamayan ${count || 'bazı'} Arapça kelime vurgulanmayacak.`, action: 'regions' }
    : { id: 'arabic', status: 'ok', label: 'Çözümdeki Arapça ifadeler görselde bulundu.' });

  if (config.pipelineVersion !== CURRENT_PIPELINE_VERSION)
    items.push({ id: 'plan', status: 'fail', label: 'Eski animasyon planı; yeniden hazırlanmalı.', action: 'regenerate' });

  const level = items.some(i => i.status === 'fail') ? 'blocked' : items.some(i => i.status === 'warn') ? 'check' : 'ready';
  return { level, items };
}
