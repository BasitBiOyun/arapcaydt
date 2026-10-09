import { spokenLength } from '../../services/narration/narrationParts';

/**
 * Where a "Seslendirme Oluştur" run is. Google sends the voice in one piece, so within a part there
 * is no real percentage: the teacher sees which step is running, how long it has been, and how long
 * such a text usually takes.
 */
export type VoiceStage = 'saving' | 'voicing' | 'joining' | 'timing';
export interface VoiceProgress {
  stage: VoiceStage;
  /** 1-based part being voiced, and how many there are (1 for most solutions). */
  part: number;
  parts: number;
  /** Date.now() when the run started, and when the current stage started. */
  startedAt: number;
  stageAt: number;
  /** Seconds a text of this length usually takes to voice (all parts). */
  expected: number;
}

/** Usual voicing time: Google takes roughly 10 s plus 1 s for every 40 spoken letters, per part. */
export function expectedVoiceSeconds(text: string, parts = 1): number {
  return Math.round(10 * parts + spokenLength(text) / 40);
}

export function startVoiceProgress(text: string, parts: number, now = Date.now()): VoiceProgress {
  return { stage: 'saving', part: 1, parts, startedAt: now, stageAt: now, expected: expectedVoiceSeconds(text, parts) };
}

export function nextVoiceStage(progress: VoiceProgress, stage: VoiceStage, part = progress.part, now = Date.now()): VoiceProgress {
  return { ...progress, stage, part, stageAt: now };
}

export interface VoiceStep { label: string; state: 'done' | 'active' | 'todo' }

/** The steps as the teacher reads them, in order. */
export function voiceSteps(progress: VoiceProgress): VoiceStep[] {
  const order: VoiceStage[] = ['saving', 'voicing', ...(progress.parts > 1 ? ['joining' as const] : []), 'timing'];
  const at = order.indexOf(progress.stage);
  const label = (stage: VoiceStage) => stage === 'saving' ? 'Soru kaydediliyor'
    : stage === 'voicing' ? (progress.parts > 1 ? `Ses üretiliyor (${Math.min(progress.part, progress.parts)}/${progress.parts}. bölüm)` : 'Ses üretiliyor')
    : stage === 'joining' ? 'Bölümler birleştiriliyor'
    : 'Kelime zamanları alınıyor';
  return order.map((stage, i) => ({ label: label(stage), state: i < at ? 'done' : i === at ? 'active' : 'todo' }));
}

/** "1:05" */
export const clockOf = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** A plain line under the steps: elapsed time against the usual time, and what to do if it runs long. */
export function voiceWaitNote(progress: VoiceProgress, now = Date.now()): string {
  const elapsed = Math.max(0, (now - progress.startedAt) / 1000);
  const usual = `Bu uzunlukta bir metin genelde ${clockOf(Math.max(15, progress.expected))} sürer.`;
  if (elapsed > progress.expected * 1.6 + 30) return `${clockOf(elapsed)} geçti. Google bugün yavaş cevap veriyor; sayfayı kapatmayın, cevap gelmezse kendiliğinden bildiririz.`;
  return `${clockOf(elapsed)} geçti. ${usual}`;
}
