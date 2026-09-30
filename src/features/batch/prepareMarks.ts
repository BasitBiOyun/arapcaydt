import type { QuestionProject } from '../../types';
import type { LocalPipelineResult } from '../../services/pipeline/localVideoPipeline';
import { applyPipelineResult, pipelineParams } from '../question-editor/projectUpdates';
import { assessReadiness } from '../question-editor/readiness';

/** Where one chosen question is in "İşaretleri hazırla" for many questions. */
export type MarkState = 'waiting' | 'working' | 'ready' | 'check' | 'blocked' | 'skipped' | 'failed' | 'stopped';
export interface MarkRow { id: string; title: string; state: MarkState; note?: string }

/** Why a question is left out, or null when its marks can be prepared. */
export function cannotPrepare(project: QuestionProject): string | null {
  if (project.completedAt) return 'Tamamlanmış soru; değişmesin diye atlandı.';
  if (!project.imageUrl) return 'Soru görseli yok.';
  if (!project.solutionText?.trim()) return 'Çözüm metni yok.';
  if (!(project.audioApproved || project.narrationSource?.isApproved || project.audioNarration?.isApproved))
    return 'Seçili ses yok. Önce Ses adımını bitirin.';
  return null;
}

/**
 * Prepares one question's marks the way the editor does. Returns the changed question (null when
 * it was left out) and how it went: the publish check's level and its first open point.
 */
export async function prepareOne(project: QuestionProject, run: (params: ReturnType<typeof pipelineParams>) => Promise<LocalPipelineResult>): Promise<{ project: QuestionProject | null; row: Omit<MarkRow, 'id' | 'title'> }> {
  const reason = cannotPrepare(project);
  if (reason) return { project: null, row: { state: 'skipped', note: reason } };
  const result = await run(pipelineParams(project));
  const next = { ...project, ...applyPipelineResult(project, result) };
  const { level, items } = assessReadiness(next);
  const open = items.find(i => i.status !== 'ok')?.label;
  const reader = result.ocrEngine === 'vision' ? '' : 'Görsel tarayıcıdaki okuyucuyla okundu.';
  return { project: next, row: { state: level, note: [open, reader].filter(Boolean).join(' ') || undefined } };
}
