import { requireMember, serviceDatabase } from '../../server/auth.js';

/**
 * One row per project with only the JSON fields the panel needs. Narration
 * word lists, captions and solution text are never downloaded.
 */
export interface ProjectRow {
  id: string;
  owner_id: string;
  updated_at: string;
  title?: string | null;
  category?: string | null;
  status?: string | null;
  videoReady?: boolean | null;
  correctAnswer?: string | null;
  narrationType?: string | null;
  modelId?: string | null;
  legacyModelId?: string | null;
  timingSource?: string | null;
  fallbackReason?: string | null;
  pipelineVersion?: number | null;
  timingQuality?: string | null;
  regionIds?: string[] | null;
  actions?: Array<{ type?: string; targetRegionId?: string }> | null;
  warnings?: string[] | null;
}

const SELECT = [
  'id', 'owner_id', 'updated_at',
  'title:data->>title', 'category:data->>category', 'status:data->>status', 'videoReady:data->videoReady',
  'correctAnswer:data->>correctAnswer',
  'narrationType:data->narrationSource->>type', 'modelId:data->narrationSource->>modelId',
  'legacyModelId:data->audioNarration->>modelId',
  'timingSource:data->narrationSource->>timingSource', 'fallbackReason:data->narrationSource->>fallbackReason',
  'pipelineVersion:data->videoConfig->pipelineVersion', 'timingQuality:data->videoConfig->>timingQuality',
  'regions:data->videoConfig->regions', 'actions:data->videoConfig->timelineActions', 'warnings:data->videoConfig->warnings',
].join(',');

/** Mirrors the editor's publish check (src/features/question-editor/readiness.ts) on the stored plan. */
export const CURRENT_PIPELINE_VERSION = 5;
type Quality = 'ready' | 'check' | 'blocked';
function quality(row: ProjectRow): Quality | null {
  const actions = row.actions || [];
  if (!actions.length) return null;
  const answer = `option-${String(row.correctAnswer || '').toLowerCase()}`;
  const checks = [...new Set(actions.filter(a => a.type === 'correct').map(a => a.targetRegionId))];
  if (checks.length !== 1 || checks[0] !== answer || row.pipelineVersion !== CURRENT_PIPELINE_VERSION || row.timingQuality === 'approximate') return 'blocked';
  const options = (row.regionIds || []).filter(id => /^option-[a-e]$/.test(id)).length;
  const optionsComplete = options === 5 || (options === 4 && !(row.regionIds || []).includes('option-e') && answer !== 'option-e');
  if (!optionsComplete || row.timingQuality === 'anchored' || (row.warnings || []).length) return 'check';
  return 'ready';
}

export type VoiceEngine = 'gemini' | 'elevenlabs' | 'uploaded' | 'none';
function voiceEngine(row: ProjectRow): VoiceEngine {
  if (row.narrationType === 'gemini' || row.narrationType === 'elevenlabs' || row.narrationType === 'uploaded') return row.narrationType;
  if (row.legacyModelId) return row.legacyModelId.startsWith('gemini-') ? 'gemini' : 'elevenlabs';
  return 'none';
}

export interface MemberStats {
  categories: Record<string, number>;
  draft: number; audioGenerated: number; audioApproved: number; videoReady: number;
  withAudio: number; uploadedAudio: number; gemini: number; elevenlabs: number; geminiFallbacks: number;
  quality: Record<Quality, number>;
  lastProjectAt: string | null;
}
export interface Issue { projectId: string; ownerId: string; title: string; updatedAt: string; detail: string }

export function summarizeProjects(rows: ProjectRow[]) {
  const categoryTotals: Record<string, number> = {};
  const members: Record<string, MemberStats> = {};
  const voice = { gemini: 0, elevenlabs: 0, geminiFallbacks: 0, uploaded: 0, none: 0, models: {} as Record<string, number>, timing: {} as Record<string, number> };
  const funnel = { total: rows.length, withAudio: 0, withMarkers: 0, ready: 0 };
  const qualityTotals: Record<Quality, number> = { ready: 0, check: 0, blocked: 0 };
  const issues: Issue[] = [];

  for (const row of rows) {
    const owner = row.owner_id;
    const category = row.category?.trim() || 'belirtilmemis';
    const status = row.status || 'draft';
    const stats = members[owner] ??= { categories: {}, draft: 0, audioGenerated: 0, audioApproved: 0, videoReady: 0, withAudio: 0,
      uploadedAudio: 0, gemini: 0, elevenlabs: 0, geminiFallbacks: 0, quality: { ready: 0, check: 0, blocked: 0 }, lastProjectAt: null };
    stats.categories[category] = (stats.categories[category] || 0) + 1;
    categoryTotals[category] = (categoryTotals[category] || 0) + 1;
    if (status === 'draft') stats.draft++;
    if (status === 'audio_generated') stats.audioGenerated++;
    if (status === 'audio_approved') stats.audioApproved++;
    if (status === 'video_ready' || row.videoReady === true) stats.videoReady++;
    if (!stats.lastProjectAt || row.updated_at > stats.lastProjectAt) stats.lastProjectAt = row.updated_at;

    const engine = voiceEngine(row);
    voice[engine]++;
    if (engine !== 'none') { stats.withAudio++; funnel.withAudio++; }
    if (engine === 'uploaded') stats.uploadedAudio++;
    if (engine === 'gemini') {
      stats.gemini++;
      const model = row.modelId || row.legacyModelId || 'bilinmiyor';
      voice.models[model] = (voice.models[model] || 0) + 1;
    }
    if (engine === 'elevenlabs') {
      stats.elevenlabs++;
      // A fallback reason means Gemini was tried first and failed.
      if (row.fallbackReason) { stats.geminiFallbacks++; voice.geminiFallbacks++; }
    }
    if (engine !== 'none') {
      const timing = row.timingSource || (engine === 'elevenlabs' ? 'elevenlabs-tts' : 'none');
      voice.timing[timing] = (voice.timing[timing] || 0) + 1;
    }

    const level = quality(row);
    if (level) { funnel.withMarkers++; qualityTotals[level]++; stats.quality[level]++; if (level === 'ready') funnel.ready++; }

    const title = row.title || 'Adsız proje';
    const push = (detail: string) => issues.push({ projectId: row.id, ownerId: owner, title, updatedAt: row.updated_at, detail });
    if (engine === 'elevenlabs' && row.fallbackReason) push(`Gemini kullanılamadı, ElevenLabs yedeği kullanıldı: ${row.fallbackReason.slice(0, 180)}`);
    if (engine === 'gemini' && (!row.timingSource || row.timingSource === 'none')) push('Gemini sesi için kelime zamanı alınamadı; animasyon yaklaşık zamanlı.');
    if (level === 'blocked') push('Yayın kontrolü: düzeltme gerekli (tik, plan sürümü veya zamanlama).');
  }
  issues.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { totalProjects: rows.length, categoryTotals, members, voice, funnel, quality: qualityTotals, issues: issues.slice(0, 40) };
}

async function readAllProjects(db: any): Promise<ProjectRow[]> {
  const all: ProjectRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('projects').select(SELECT).order('updated_at', { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = ((data || []) as any[]).map(({ regions, ...row }) => ({
      ...row, regionIds: Array.isArray(regions) ? regions.map((r: any) => String(r?.id || '')) : [],
    })) as ProjectRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const member = await requireMember(req, res);
  if (!member) return;
  if (member.profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });
  }

  try {
    return res.status(200).json(summarizeProjects(await readAllProjects(serviceDatabase())));
  } catch (error: any) {
    console.error('[Admin analytics]', error?.message || error);
    return res.status(500).json({ error: 'Yönetim istatistikleri hazırlanamadı.' });
  }
}
