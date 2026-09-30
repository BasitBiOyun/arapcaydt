import { requireMember, serviceDatabase } from '../../server/auth.js';
import { DEFAULT_LIMITS, GEMINI_TTS_MODELS, nextQuotaReset, readLimits, quotaDay, summarizeDay, type Limits } from '../../server/quota.js';

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

export interface ActivityRow { owner_id: string; kind: string; state: string; detail?: string | null; key_source?: string | null; created_at: string }
type Counter = { succeeded: number; failed: number };
const SERVICES = ['gemini_tts', 'gemini_transcribe', 'elevenlabs_align', 'voice'] as const;
type Service = typeof SERVICES[number];
const emptyCounters = () => Object.fromEntries(SERVICES.map(k => [k, { succeeded: 0, failed: 0 }])) as Record<Service, Counter>;
export { quotaDay };
/** Today's per-teacher view of the key chain (Pacific quota day). */
export interface MemberToday { ownTts: number; ownTranscribe: number; ownTranscribeExhausted: boolean; ownTtsExhausted: number; sharedTts: number; sharedTranscribe: number; elevenlabsAlign: number }

/**
 * Request counts from the per-request usage log: every Gemini TTS model
 * attempt, Transcribe call, Forced Alignment call and ElevenLabs TTS request
 * is one row, so regenerated narrations and failures are all counted.
 */
export function summarizeRequests(rows: ActivityRow[], nowIso = new Date().toISOString(), limits: Limits = DEFAULT_LIMITS) {
  const today = quotaDay(nowIso);
  const monthAgo = new Date(new Date(nowIso).getTime() - 30 * 86400_000).toISOString();
  const totals = { today: emptyCounters(), last30Days: emptyCounters(), all: emptyCounters() };
  /** Per voice model: all keys, plus the studio key's own use today and the last quota Google reported. */
  const geminiModels: Record<string, { today: Counter; last30Days: Counter; sharedToday: number; lastQuota?: string }> = {};
  const members: Record<string, Record<Service, number>> = {};
  /** The latest failed requests of the last 7 days, with the reason the service gave. */
  const failures: Array<{ at: string; ownerId: string; kind: Service; keySource: string | null; model: string; status: string; reason: string }> = [];
  const weekAgo = new Date(new Date(nowIso).getTime() - 7 * 86400_000).toISOString();
  /** Per teacher, last 7 days: voice and timing requests that worked and that failed (failures alone mislead). */
  const membersWeek: Record<string, { voice: Counter; timing: Counter }> = {};
  for (const row of rows) {
    if (!(SERVICES as readonly string[]).includes(row.kind)) continue;
    const kind = row.kind as Service;
    // ElevenLabs TTS rows stay "requested" until the server marks them; only "succeeded" counts as success.
    const outcome: keyof Counter = row.state === 'succeeded' ? 'succeeded' : 'failed';
    const isToday = quotaDay(row.created_at) === today;
    const recent = row.created_at >= monthAgo;
    totals.all[kind][outcome]++;
    if (recent) totals.last30Days[kind][outcome]++;
    if (isToday) totals.today[kind][outcome]++;
    (members[row.owner_id] ??= { gemini_tts: 0, gemini_transcribe: 0, elevenlabs_align: 0, voice: 0 })[kind]++;
    if (row.created_at >= weekAgo) {
      const week = membersWeek[row.owner_id] ??= { voice: { succeeded: 0, failed: 0 }, timing: { succeeded: 0, failed: 0 } };
      week[kind === 'gemini_tts' || kind === 'voice' ? 'voice' : 'timing'][outcome]++;
    }
    if (outcome === 'failed' && row.created_at >= weekAgo && failures.length < 25) {
      const [model, status, ...rest] = (row.detail || '').split(' · ');
      failures.push({ at: row.created_at, ownerId: row.owner_id, kind, keySource: row.key_source || null, model: model || '', status: status || '',
        reason: rest.find(p => p.startsWith('neden: '))?.slice(7) || (rest.includes('daily') ? 'Günlük kota doldu' : status === '429' ? 'Dakikalık sınır (kısa süre bekleyip tekrar denenir)' : '') });
    }
    // Retired voice models (older experiments) are not shown as model cards.
    if (kind === 'gemini_tts' && (GEMINI_TTS_MODELS as readonly string[]).includes((row.detail || '').split(' · ')[0])) {
      const model = (row.detail || 'bilinmiyor').split(' · ')[0];
      const m = geminiModels[model] ??= { today: { succeeded: 0, failed: 0 }, last30Days: { succeeded: 0, failed: 0 }, sharedToday: 0 };
      if (isToday) m.today[outcome]++;
      const [, status, tag] = (row.detail || '').split(' · ');
      if (isToday && row.key_source === 'system' && status !== '429') m.sharedToday++;
      // Rows come newest first, so the first tagged 429 today is the latest one.
      if (isToday && status === '429' && tag && tag !== 'daily' && !tag.startsWith('neden:') && !m.lastQuota)
        m.lastQuota = `${row.key_source === 'system' ? 'ortak anahtar' : 'öğretmen anahtarı'}: ${tag}`;
      if (recent) m.last30Days[outcome]++;
    }
  }
  // Key chain today: the teacher's own key vs. the studio key, and what is already out of daily quota.
  const todayRows = rows.filter(r => quotaDay(r.created_at) === today);
  const studio = summarizeDay(todayRows, '').shared;
  const membersToday: Record<string, MemberToday> = {};
  for (const owner of new Set(todayRows.map(r => r.owner_id))) {
    const day = summarizeDay(todayRows, owner, limits);
    const sharedTts = todayRows.filter(r => r.owner_id === owner && r.kind === 'gemini_tts' && r.key_source === 'system' && (r.detail || '').split(' · ')[1] !== '429').length;
    membersToday[owner] = { ownTts: day.own.ttsUsed, ownTranscribe: day.own.transcribeUsed, ownTranscribeExhausted: day.own.transcribeExhausted,
      ownTtsExhausted: day.own.ttsExhausted.length, sharedTts, sharedTranscribe: day.shared.transcribeUsed, elevenlabsAlign: day.elevenlabsAlignUsed };
  }
  return { quotaDay: today, resetsAt: nextQuotaReset(nowIso), failures, totals, geminiModels, members, membersToday, membersWeek,
    studio: { transcribeUsed: studio.transcribeUsedAll, transcribeExhausted: studio.transcribeExhausted, ttsExhausted: studio.ttsExhausted },
    limits: { sharedTranscribePerTeacher: limits.sharedTranscribe, elevenlabsAlignPerTeacher: limits.elevenlabsAlign } };
}

async function readUsage(db: any): Promise<{ rows: ActivityRow[]; migrationPending: boolean }> {
  const rows: ActivityRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('activity').select('owner_id,kind,state,detail,key_source,created_at')
      .in('kind', SERVICES as unknown as string[]).order('created_at', { ascending: false }).range(from, from + 999);
    // Before supabase/migrations/20260928_teacher_keys.sql there is no detail/key_source column and no new kinds.
    if (error) return { rows: [], migrationPending: true };
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return { rows, migrationPending: false };
}

/** Which teachers saved their own Google key: last four characters and state only, never the key. */
async function readTeacherKeys(db: any): Promise<Record<string, { last4: string; status: string; updatedAt: string }>> {
  const { data, error } = await db.from('teacher_gemini_keys').select('owner_id,last4,status,updated_at');
  if (error) return {};
  return Object.fromEntries((data || []).map((r: any) => [r.owner_id, { last4: r.last4, status: r.status, updatedAt: r.updated_at }]));
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
    const db = serviceDatabase();
    const [projects, usage, teacherKeys, limits] = await Promise.all([readAllProjects(db), readUsage(db), readTeacherKeys(db), readLimits(db)]);
    return res.status(200).json({ ...summarizeProjects(projects), teacherKeys,
      requests: { ...summarizeRequests(usage.rows, undefined, limits), migrationPending: usage.migrationPending } });
  } catch (error: any) {
    console.error('[Admin analytics]', error?.message || error);
    return res.status(500).json({ error: 'Yönetim istatistikleri hazırlanamadı.' });
  }
}
