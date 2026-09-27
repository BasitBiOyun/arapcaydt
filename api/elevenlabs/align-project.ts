import { requireMember, serviceDatabase } from '../../server/auth.js';

export const config = { maxDuration: 120 };

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
  return key;
}

async function loadProjectAudio(db: ReturnType<typeof serviceDatabase>, source: any): Promise<{ bytes: Buffer; mimeType: string }> {
  const stored = source?.audioUrl;
  const mimeType = typeof source?.mimeType === 'string' && /^audio\/[\w.+-]+$/.test(source.mimeType)
    ? source.mimeType
    : 'audio/wav';

  if (stored && typeof stored === 'object' && typeof stored.assetPath === 'string') {
    const { data, error } = await db.storage.from('project-assets').download(stored.assetPath);
    if (error || !data) throw new Error('Kaydedilmiş ses dosyası okunamadı.');
    return { bytes: Buffer.from(await data.arrayBuffer()), mimeType };
  }

  if (typeof stored === 'string' && /^https?:\/\//.test(stored)) {
    const response = await fetch(stored, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Ses dosyası indirilemedi (HTTP ${response.status}).`);
    return { bytes: Buffer.from(await response.arrayBuffer()), mimeType: response.headers.get('content-type')?.split(';')[0] || mimeType };
  }

  throw new Error('Zamanlama için kaydedilmiş ses dosyası bulunamadı.');
}

export default async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = normalizeApiKey(process.env.ELEVENLABS_API_KEY);
  if (!apiKey || apiKey === 'MY_ELEVENLABS_API_KEY') {
    return res.status(503).json({ error: 'ElevenLabs Forced Alignment yapılandırılmamış.', code: 'MISSING_ELEVENLABS_API_KEY' });
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
  const text = typeof row.data?.solutionText === 'string' ? row.data.solutionText.trim() : '';
  if (!source || source.type !== 'gemini') {
    return res.status(400).json({ error: 'Bu proje için Gemini tarafından üretilmiş bir ses bulunamadı.' });
  }
  if (!text) return res.status(400).json({ error: 'Forced Alignment için çözüm metni bulunamadı.' });

  try {
    const { bytes, mimeType } = await loadProjectAudio(db, source);
    if (!bytes.length) return res.status(400).json({ error: 'Ses dosyası boş.' });
    if (bytes.length > MAX_AUDIO_BYTES) {
      return res.status(413).json({ error: 'Ses dosyası Forced Alignment için 25 MB sınırını aşıyor.' });
    }

    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mimeType }), mimeType.includes('wav') ? 'narration.wav' : 'narration.mp3');
    form.append('text', text);

    const upstream = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
      method: 'POST',
      signal: AbortSignal.timeout(100000),
      headers: { 'xi-api-key': apiKey },
      body: form,
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      let detail = '';
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.detail?.message || parsed?.detail || parsed?.message || '';
      } catch {
        detail = raw.slice(0, 240);
      }
      console.warn('[ElevenLabs Forced Alignment]', upstream.status, detail);
      return res.status(upstream.status).json({
        error: detail || `ElevenLabs Forced Alignment hata döndürdü (HTTP ${upstream.status}).`,
        code: 'ELEVENLABS_ALIGNMENT_ERROR',
        upstreamStatus: upstream.status,
      });
    }

    const result: any = JSON.parse(raw);
    const words = (Array.isArray(result?.words) ? result.words : [])
      .filter((word: any) =>
        typeof word?.text === 'string' &&
        word.text.trim() &&
        Number.isFinite(word.start) &&
        Number.isFinite(word.end)
      )
      .map((word: any) => ({
        text: word.text.trim(),
        start: Number(word.start.toFixed(3)),
        end: Number(Math.max(word.start, word.end).toFixed(3)),
        ...(Number.isFinite(word.loss) ? { loss: Number(word.loss.toFixed(3)) } : {}),
      }));

    if (!words.length) {
      return res.status(502).json({ error: 'ElevenLabs Forced Alignment kelime zaman damgası döndürmedi.', code: 'EMPTY_ALIGNMENT' });
    }

    return res.status(200).json({
      words,
      timingSource: 'forced-alignment',
      loss: Number.isFinite(result?.loss) ? Number(result.loss.toFixed(4)) : null,
    });
  } catch (error: any) {
    console.error('[ElevenLabs Forced Alignment project]', error?.message || error);
    return res.status(502).json({ error: error?.message || 'ElevenLabs Forced Alignment servisine ulaşılamadı.' });
  }
}
