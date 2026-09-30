import type { QuestionProject } from '../../types';
import { checkNarration } from './workflow';

export const CURRENT_PIPELINE_VERSION = 5;

export type ReadinessAction = 'regions' | 'timing' | 'regenerate' | 'text';
export interface ReadinessItem {
  id: 'options' | 'answer' | 'script' | 'timing' | 'arabic' | 'paragraph' | 'note' | 'plan';
  status: 'ok' | 'warn' | 'fail';
  label: string;
  action?: ReadinessAction;
  /** For a missing option: the letter to draw on the picture. */
  letter?: string;
}
export interface Readiness {
  level: 'ready' | 'check' | 'blocked';
  items: ReadinessItem[];
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * A note from "İşaretleri hazırla" as one plain "what to do" line, or null when a check above
 * already says it (missing options, timing, no tick). Older questions keep their stored notes.
 */
export function adviceFor(warning: string): ReadinessItem | null {
  if (/^(Görselde eşleştirilemeyen Arapça|Şu şıklar bulunamadı|Ses zamanlamaları|Bazı ifadelerin süreleri|Çözüm metninde kesin doğru cevap)/.test(warning)) return null;
  const paragraph = /^Çözümdeki Arapça paragraf \(“([^…”]*)/.exec(warning);
  if (paragraph) return { id: 'paragraph', status: 'warn', label: `Arapça paragrafın (“${paragraph[1].trim()}…”) altı çizilemedi. Görselde satır satır çizebilirsiniz.`, action: 'regions' };
  const answer = /^Çözüm metni ([A-E]) diyor; seçili cevap ([A-E])/.exec(warning);
  if (answer) return { id: 'note', status: 'warn', label: `Seçili cevap ${answer[2]} idi; çözüm metni ${answer[1]} dediği için ${answer[1]} işaretlendi.`, action: 'text' };
  if (warning.startsWith('Animasyon adımı bulunamadı')) return { id: 'note', status: 'warn', label: 'Hiç işaret hazırlanamadı. Görselde elle işaret ekleyin.', action: 'regions' };
  return { id: 'note', status: 'warn', label: warning };
}

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
    ? { id: 'options', status: 'fail', label: 'Görselde şık bulunamadı.', action: 'regions', letter: 'A' }
    : complete
      ? { id: 'options', status: 'ok', label: `${found.length} şık bulundu (${found[0]}–${found[found.length - 1]}).` }
      : { id: 'options', status: 'warn', label: `Eksik şık: ${missing.join(', ')}. Görselde yerini gösterin.`, action: 'regions', letter: missing[0] });

  // Ticks on premises (I, II, III…) or phrases explain the text; the answer is the ticked option.
  const optionType = new Map((config.regions || []).map(r => [r.id, r.type]));
  const isOption = (id: string) => /^option-[a-e]$/i.test(id) || String(optionType.get(id) ?? '').startsWith('option-');
  const correctTargets = [...new Set(actions.filter(a => a.type === 'correct' && isOption(a.targetRegionId)).map(a => a.targetRegionId))];
  const answerId = `option-${project.correctAnswer.toLowerCase()}`;
  items.push(correctTargets.includes(answerId) && correctTargets.length === 1
    ? { id: 'answer', status: 'ok', label: `Doğru cevap ${project.correctAnswer} işaretleniyor.` }
    : correctTargets.length
      ? { id: 'answer', status: 'fail', label: `Tik ${correctTargets.map(id => id.slice(-1).toUpperCase()).join(', ')} şıkkında; seçili cevap ${project.correctAnswer}.`, action: 'timing' }
      : { id: 'answer', status: 'fail', label: 'Doğru cevaba tik yok. Zaman şeridinden ekleyin.', action: 'timing' });

  const script = checkNarration(project.solutionText, project.correctAnswer);
  if (script.mismatch) items.push({ id: 'script', status: 'fail', label: `Metin ${script.mismatch} diyor; seçili cevap ${project.correctAnswer}.`, action: 'text' });

  const quality = config.timingQuality;
  items.push(quality === 'word-aligned'
    ? { id: 'timing', status: 'ok', label: 'İşaretler kelime kelime sese bağlı.' }
    : quality === 'anchored'
      ? { id: 'timing', status: 'warn', label: 'Birkaç işaretin zamanı tahmini. Önizlemeyi bir kez dinleyin.', action: 'timing' }
      : { id: 'timing', status: 'fail', label: 'Ses ile yazı eşleşmedi; işaretler yaklaşık zamanda çıkar. Zamanlamayı kontrol edin.', action: 'timing' });

  const unread = (config.warnings || []).find(w => w.startsWith('Görselde eşleştirilemeyen Arapça kelimeler'));
  const words = unread ? (unread.split(':')[1]?.split('.')[0].split('،').map(w => w.trim()).filter(Boolean) ?? []) : [];
  items.push(unread
    ? { id: 'arabic', status: 'warn', label: `${words.length || 'Bazı'} Arapça kelimenin altı çizilmeyecek${words.length ? ` (${words.slice(0, 4).join('، ')}${words.length > 4 ? '…' : ''})` : ''}. İsterseniz görselde çizin.`, action: 'regions' }
    : { id: 'arabic', status: 'ok', label: 'Çözümdeki Arapça ifadeler görselde bulundu.' });

  for (const warning of config.warnings || []) {
    const advice = adviceFor(warning);
    if (advice) items.push(advice);
  }

  if (config.pipelineVersion !== CURRENT_PIPELINE_VERSION)
    items.push({ id: 'plan', status: 'fail', label: 'Bu soru eski sürümle hazırlanmış. İşaretleri yeniden hazırlayın.', action: 'regenerate' });

  const level = items.some(i => i.status === 'fail') ? 'blocked' : items.some(i => i.status === 'warn') ? 'check' : 'ready';
  return { level, items };
}
