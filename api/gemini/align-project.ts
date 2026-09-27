import { requireMember, serviceDatabase } from '../../server/auth.js';
import { recordUsage } from '../../server/usage.js';
import { ProjectAudioError, loadProjectAudio } from '../../server/projectAudio.js';
import {
  TRANSCRIBE_MODEL, isCapped, isDailyQuotaError, isInvalidKeyError, markTeacherKeyInvalid,
  normalizeApiKey, readDailyState, readTeacherKey, sharedTranscribeAllowed, usageDetail, type KeySource,
} from '../../server/quota.js';

export const config = { maxDuration: 120 };
const REQUEST_BUDGET_MS = 100_000;

function parseOffset(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = parseFloat(String(value).replace(/s$/i, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

async function uploadGeminiFile(apiKey: string, bytes: Buffer, mimeType: string, displayName: string) {
  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) throw new Error(`Dosya yükleme oturumu açılamadı (HTTP ${start.status}).`);
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini dosya yükleme adresi döndürmedi.');

  const upload = await fetch(uploadUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'Content-Length': String(bytes.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mimeType,
    },
    body: bytes,
  });
  const raw = await upload.text();
  if (!upload.ok) throw new Error(`Ses Gemini Files API'ye yüklenemedi (HTTP ${upload.status}).`);
  const info = JSON.parse(raw);
  const uri = info?.file?.uri;
  if (!uri) throw new Error('Gemini yüklenen ses için URI döndürmedi.');
  return { uri: String(uri), name: String(info?.file?.name || ''), mimeType: String(info?.file?.mimeType || mimeType) };
}

async function deleteGeminiFile(apiKey: string, name: string) {
  if (!name) return;
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
    method: 'DELETE',
    headers: { 'x-goog-api-key': apiKey },
  }).catch(() => undefined);
}

export default async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
  if (!projectId) return res.status(400).json({ error: 'Proje kimliği gerekli.' });

  const db = serviceDatabase();
  const { data: row, error: projectError } = await db
    .from('projects')
    .select('owner_id,data')
    .eq('id', projectId)
    .eq('owner_id', member.user.id)
    .maybeSingle();

  if (projectError || !row) return res.status(404).json({ error: 'Proje bulunamadı.' });

  const source = row.data?.narrationSource;
  if (!source || source.type !== 'gemini') {
    return res.status(400).json({ error: 'Bu proje için Gemini tarafından üretilmiş bir ses bulunamadı.' });
  }

  let bytes: Buffer, mimeType: string;
  try {
    ({ bytes, mimeType } = await loadProjectAudio(db, member.user.id, source));
  } catch (error: any) {
    return res.status(error instanceof ProjectAudioError ? error.status : 502).json({ error: error?.message || 'Ses dosyası okunamadı.' });
  }

  // Teacher's own Transcribe quota first, then the studio key (capped per teacher per day).
  // When neither is available the caller continues with ElevenLabs, then local Whisper.
  const systemKey = normalizeApiKey(process.env.GEMINI_API_KEY);
  const [teacherKey, today] = await Promise.all([readTeacherKey(db, member.user.id), readDailyState(db, member.user.id)]);
  const lanes: Array<{ source: KeySource; key: string }> = [];
  if (teacherKey && !today.own.transcribeExhausted) lanes.push({ source: 'teacher', key: teacherKey });
  if (systemKey && sharedTranscribeAllowed(today, isCapped(member))) lanes.push({ source: 'system', key: systemKey });
  if (!lanes.length) {
    const reason = !systemKey && !teacherKey ? 'Gemini API anahtarı yapılandırılmamış.'
      : today.shared.transcribeExhausted ? 'Bugünkü Gemini kelime zamanı kotaları doldu.'
      : `Bugünkü Gemini kelime zamanı hakkınız doldu (ortak kotadan günlük ${today.limits.sharedTranscribe}).`;
    return res.status(429).json({ error: reason, code: 'TRANSCRIBE_LIMIT' });
  }

  const failures: string[] = [];
  let lastStatus = 502;
  const deadline = Date.now() + REQUEST_BUDGET_MS;
  for (const lane of lanes) {
    const remaining = deadline - Date.now();
    if (remaining < 15_000) { failures.push('Süre doldu.'); break; }
    const result = await transcribe(lane.key, bytes, mimeType, projectId, remaining);
    if (result.status) {
      await recordUsage(member.user.id, projectId, [{ kind: 'gemini_transcribe', state: result.words ? 'succeeded' : 'failed',
        detail: usageDetail(TRANSCRIBE_MODEL, result.status, !result.words && isDailyQuotaError(result.status, result.raw)), keySource: lane.source }]);
    }
    if (result.words?.length) {
      return res.status(200).json({ words: result.words, modelId: TRANSCRIBE_MODEL, timingSource: 'gemini-transcribe', keySource: lane.source });
    }
    if (lane.source === 'teacher' && result.status && isInvalidKeyError(result.status, result.raw)) await markTeacherKeyInvalid(db, member.user.id);
    failures.push(`${lane.source === 'teacher' ? 'Kendi anahtarınız' : 'Ortak anahtar'}: ${result.error}`);
    lastStatus = result.status && result.status >= 400 ? result.status : 502;
  }
  return res.status(lastStatus).json({ error: failures.join(' · '), code: 'GEMINI_TRANSCRIBE_ERROR' });
}

interface TranscribeResult { status: number; raw: string; error?: string; words?: Array<{ text: string; start: number; end: number }> }

/** One Transcribe request with one key; status 0 means the model was never called (upload/network failure). */
async function transcribe(apiKey: string, bytes: Buffer, mimeType: string, projectId: string, budgetMs: number): Promise<TranscribeResult> {
  const deadline = Date.now() + budgetMs;
  let uploadedName = '';
  let status = 0;
  try {
    const uploaded = await uploadGeminiFile(apiKey, bytes, mimeType, `narration-${projectId}.${mimeType === 'audio/mpeg' ? 'mp3' : 'wav'}`);
    uploadedName = uploaded.name;

    const interaction = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      signal: AbortSignal.timeout(Math.max(5_000, deadline - Date.now())),
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TRANSCRIBE_MODEL,
        input: [{
          type: 'audio',
          uri: uploaded.uri,
          mime_type: uploaded.mimeType,
        }],
        generation_config: {
          transcription_config: {
            language_codes: [],
            mode: {
              type: 'verbatim',
              timestamp_granularities: ['word'],
            },
          },
        },
      }),
    });

    const raw = await interaction.text();
    status = interaction.status;
    if (!interaction.ok) {
      let detail = '';
      try { detail = JSON.parse(raw)?.error?.message || ''; } catch {}
      return { status, raw, error: detail || `Gemini 3.5 Transcribe hata döndürdü (HTTP ${status}).` };
    }

    const payload = JSON.parse(raw);
    const words: Array<{ text: string; start: number; end: number }> = [];
    for (const step of payload?.steps || []) {
      for (const content of step?.content || []) {
        for (const annotation of content?.annotations || []) {
          if (annotation?.type !== 'word_info' || typeof annotation?.text !== 'string') continue;
          const start = parseOffset(annotation.start_offset);
          const end = parseOffset(annotation.end_offset);
          if (start == null || end == null) continue;
          words.push({
            text: annotation.text.trim(),
            start: Number(start.toFixed(3)),
            end: Number(Math.max(start, end).toFixed(3)),
          });
        }
      }
    }

    if (!words.length) return { status, raw: '', error: 'Gemini Transcribe kelime zaman damgası döndürmedi.' };
    return { status, raw: '', words };
  } catch (error: any) {
    console.error('[Gemini Transcribe alignment]', error?.message || error);
    return { status, raw: '', error: error?.message || 'Gemini zamanlama servisine ulaşılamadı.' };
  } finally {
    await deleteGeminiFile(apiKey, uploadedName);
  }
}
