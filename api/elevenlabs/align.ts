import { requireMember } from '../../server/auth.js';

export const config = { maxDuration: 60 };

/** Vercel request bodies are limited; base64 adds roughly one third. */
export const MAX_ALIGN_AUDIO_BYTES = 3 * 1024 * 1024;

function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
  return key;
}

/**
 * Forced-aligns a teacher-uploaded MP3 to the already known solution text.
 * This is deliberately independent from ElevenLabs TTS character reservations:
 * alignment consumes the alignment/STT service only and never reserves TTS characters.
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
    return res.status(503).json({ error: 'ElevenLabs Forced Alignment yapılandırılmamış.', code: 'MISSING_ELEVENLABS_API_KEY' });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.replace(/^data:[^,]*,/, '') : '';
  const mimeType = typeof req.body?.mimeType === 'string' && /^audio\/[\w.+-]+$/.test(req.body.mimeType) ? req.body.mimeType : 'audio/mpeg';
  if (!text || !audioBase64) return res.status(400).json({ error: 'Hizalama için çözüm metni ve ses dosyası gereklidir.', code: 'EMPTY_INPUT' });

  const audio = Buffer.from(audioBase64, 'base64');
  if (!audio.length) return res.status(400).json({ error: 'Ses dosyası okunamadı.', code: 'EMPTY_INPUT' });
  if (audio.length > MAX_ALIGN_AUDIO_BYTES) {
    return res.status(413).json({ error: 'Ses dosyası sunucu hizalaması için çok büyük.', code: 'AUDIO_TOO_LARGE' });
  }

  try {
    const form = new FormData();
    form.append('file', new Blob([audio], { type: mimeType }), mimeType.includes('wav') ? 'narration.wav' : 'narration.mp3');
    form.append('text', text);

    const upstream = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
      method: 'POST',
      signal: AbortSignal.timeout(50000),
      headers: { 'xi-api-key': apiKey },
      body: form,
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error('[ElevenLabs align upstream]', upstream.status, raw.slice(0, 300));
      return res.status(502).json({
        error: `Hizalama servisi hatası (${upstream.status}).`,
        code: 'ELEVENLABS_UPSTREAM_ERROR',
        upstreamStatus: upstream.status,
      });
    }

    const result: any = JSON.parse(raw);
    const words = (Array.isArray(result?.words) ? result.words : [])
      .filter((w: any) => typeof w?.text === 'string' && w.text.trim() && Number.isFinite(w.start) && Number.isFinite(w.end))
      .map((w: any) => ({
        text: w.text.trim(),
        start: Number(w.start.toFixed(3)),
        end: Number(Math.max(w.start, w.end).toFixed(3)),
        ...(Number.isFinite(w.loss) ? { loss: Number(w.loss.toFixed(3)) } : {}),
      }));

    if (!words.length) {
      return res.status(502).json({ error: 'Hizalama servisi kelime zamanı döndürmedi.', code: 'EMPTY_ALIGNMENT' });
    }

    return res.status(200).json({
      words,
      timingSource: 'forced-alignment',
      loss: Number.isFinite(result?.loss) ? result.loss : null,
    });
  } catch (error: any) {
    console.error('[ElevenLabs align network error]', error?.name || error?.message);
    return res.status(502).json({ error: 'Hizalama servisine bağlanılamadı.', code: 'ELEVENLABS_NETWORK_ERROR' });
  }
}
