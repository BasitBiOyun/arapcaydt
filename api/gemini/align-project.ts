import { requireMember, serviceDatabase } from '../../server/auth.js';

export const config = { maxDuration: 120 };

function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
  return key;
}

function parseOffset(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = parseFloat(String(value).replace(/s$/i, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

async function uploadGeminiFile(apiKey: string, bytes: Buffer, mimeType: string, displayName: string) {
  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
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

  const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) return res.status(503).json({ error: 'Gemini API anahtarı yapılandırılmamış.' });

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

  const stored = source.audioUrl;
  const mimeType = typeof source.mimeType === 'string' ? source.mimeType : 'audio/wav';
  let audioBlob: Blob | null = null;

  if (stored && typeof stored === 'object' && typeof stored.assetPath === 'string') {
    const { data, error } = await db.storage.from('project-assets').download(stored.assetPath);
    if (error || !data) return res.status(502).json({ error: 'Kaydedilmiş ses dosyası okunamadı.' });
    audioBlob = data;
  } else if (typeof stored === 'string' && /^https?:\/\//.test(stored)) {
    const audioResponse = await fetch(stored);
    if (!audioResponse.ok) return res.status(502).json({ error: 'Ses dosyası indirilemedi.' });
    audioBlob = await audioResponse.blob();
  }

  if (!audioBlob) return res.status(400).json({ error: 'Zamanlama için ses dosyası bulunamadı.' });
  const bytes = Buffer.from(await audioBlob.arrayBuffer());
  if (!bytes.length) return res.status(400).json({ error: 'Ses dosyası boş.' });

  let uploadedName = '';
  try {
    const uploaded = await uploadGeminiFile(apiKey, bytes, mimeType, `narration-${projectId}.wav`);
    uploadedName = uploaded.name;

    const interaction = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      signal: AbortSignal.timeout(100000),
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3.5-transcribe',
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
    if (!interaction.ok) {
      let detail = '';
      try { detail = JSON.parse(raw)?.error?.message || ''; } catch {}
      return res.status(interaction.status).json({
        error: detail || `Gemini 3.5 Transcribe hata döndürdü (HTTP ${interaction.status}).`,
        code: 'GEMINI_TRANSCRIBE_ERROR',
      });
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

    if (!words.length) return res.status(502).json({ error: 'Gemini Transcribe kelime zaman damgası döndürmedi.' });
    return res.status(200).json({
      words,
      modelId: 'gemini-3.5-transcribe',
      timingSource: 'gemini-transcribe',
    });
  } catch (error: any) {
    console.error('[Gemini Transcribe alignment]', error?.message || error);
    return res.status(502).json({ error: error?.message || 'Gemini zamanlama servisine ulaşılamadı.' });
  } finally {
    await deleteGeminiFile(apiKey, uploadedName);
  }
}
