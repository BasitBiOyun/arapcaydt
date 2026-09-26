import { requireMember, serviceDatabase } from '../../server/auth.js';
export const config = {
  maxDuration: 60,
};

/** Vercel rejects request bodies above 4.5 MB; base64 adds a third. */
export const MAX_ALIGN_AUDIO_BYTES = 3 * 1024 * 1024;

function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
  return key;
}

/**
 * Word timings for a teacher's own MP3: the known solution text is aligned to
 * the audio (ElevenLabs forced alignment), instead of guessing words by ASR.
 * Shares the voice usage reservation (daily limit, 10 s spacing); the audit
 * row ends as "aligned" so it is never counted as a generated voice.
 */
export default async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = normalizeApiKey(process.env.ELEVENLABS_API_KEY);
  if (!apiKey || apiKey === 'MY_ELEVENLABS_API_KEY') {
    return res.status(500).json({ error: 'Ses servisi yapılandırılmamış.', code: 'MISSING_ELEVENLABS_API_KEY' });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.replace(/^data:[^,]*,/, '') : '';
  const mimeType = typeof req.body?.mimeType === 'string' && /^audio\/[\w.+-]+$/.test(req.body.mimeType) ? req.body.mimeType : 'audio/mpeg';
  if (!text || !audioBase64) return res.status(400).json({ error: 'Hizalama için çözüm metni ve ses dosyası gereklidir.', code: 'EMPTY_INPUT' });
  const audio = Buffer.from(audioBase64, 'base64');
  if (!audio.length) return res.status(400).json({ error: 'Ses dosyası okunamadı.', code: 'EMPTY_INPUT' });
  if (audio.length > MAX_ALIGN_AUDIO_BYTES) return res.status(413).json({ error: 'Ses dosyası sunucu hizalaması için çok büyük.', code: 'AUDIO_TOO_LARGE' });

  let audit: ReturnType<typeof serviceDatabase>;
  let eventId: string;
  try {
    audit = serviceDatabase();
    const { data, error } = await audit.rpc('reserve_voice', { member_id: member.user.id, target_project: req.body?.projectId || '', char_count: text.length });
    if (error) return res.status(403).json({ error: error.message });
    eventId = data;
  } catch {
    return res.status(503).json({ error: 'Ses kullanım kaydı açılamadı; ücretli istek gönderilmedi.' });
  }
  const finish = async (state: string) => {
    const { error } = await audit.from('activity').update({ state }).eq('id', eventId);
    if (error) console.error('Alignment audit update failed');
  };

  try {
    const form = new FormData();
    form.append('file', new Blob([audio], { type: mimeType }), 'narration.mp3');
    form.append('text', text);
    const upstream = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
      method: 'POST',
      signal: AbortSignal.timeout(50000),
      headers: { 'xi-api-key': apiKey },
      body: form,
    });
    if (!upstream.ok) {
      await finish('align_failed');
      const raw = await upstream.text();
      console.error('[ElevenLabs align upstream]', upstream.status, raw.slice(0, 300));
      return res.status(502).json({ error: `Hizalama servisi hatası (${upstream.status}).`, code: 'ELEVENLABS_UPSTREAM_ERROR', upstreamStatus: upstream.status });
    }
    const result: any = await upstream.json();
    const words = (Array.isArray(result?.words) ? result.words : [])
      .filter((w: any) => typeof w?.text === 'string' && w.text.trim() && Number.isFinite(w.start) && Number.isFinite(w.end))
      .map((w: any) => ({ text: w.text.trim(), start: Number(w.start.toFixed(3)), end: Number(Math.max(w.start, w.end).toFixed(3)),
        ...(Number.isFinite(w.loss) ? { loss: Number(w.loss.toFixed(3)) } : {}) }));
    if (!words.length) {
      await finish('align_failed');
      return res.status(502).json({ error: 'Hizalama servisi kelime zamanı döndürmedi.', code: 'EMPTY_ALIGNMENT' });
    }
    await finish('aligned');
    return res.status(200).json({ words, loss: Number.isFinite(result?.loss) ? result.loss : null });
  } catch (error: any) {
    await finish('uncertain');
    console.error('[ElevenLabs align network error]', error?.name);
    return res.status(502).json({ error: 'Hizalama servisine bağlanılamadı.', code: 'ELEVENLABS_NETWORK_ERROR' });
  }
}
