import { requireMember } from '../../server/auth.js';

export const config = { maxDuration: 120 };

const GEMINI_MODELS = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
] as const;

const VOICE_NAME = 'Achernar';
const STYLE = [
  'Experienced teacher solving an exam question in a quiet classroom.',
  'Natural, clear, confident and instructional delivery at a moderate pace.',
  'Use native pronunciation for every language in the transcript, including Turkish and Arabic,',
  'and switch languages naturally without carrying the accent of one language into the other.',
  'Naturally emphasize important clues, eliminated choices, contrasts and the final correct answer.',
  'Use brief natural pauses between reasoning steps.',
  'Do not sound like an announcer.',
  'Read the transcript faithfully without adding, omitting, translating, paraphrasing or repeating words.',
].join(' ');

function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

function hashKey(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function modelOrder(routeKey: string) {
  const start = hashKey(routeKey || 'default') % GEMINI_MODELS.length;
  return [...GEMINI_MODELS.slice(start), ...GEMINI_MODELS.slice(0, start)];
}

function legacyPrompt(text: string) {
  return `# AUDIO PROFILE: Achernar
## "Experienced Exam Teacher"

## THE SCENE
A teacher is solving an exam question in a quiet classroom.

### SAMPLE CONTEXT
There is an exam question on the board and the teacher is explaining the solution clearly to students.

### DIRECTOR'S NOTES
Style: Natural, clear, confident and instructional. Sound like an experienced teacher, not an announcer.
Pace: Moderate and steady. Use brief natural pauses between reasoning steps.
Pronunciation: Use native pronunciation for Turkish and Arabic. Switch languages naturally without carrying one language's accent into the other.
Emphasis: Naturally emphasize important clues, eliminated choices, contrasts and the final correct answer.
Fidelity: Read the transcript faithfully. Do not add, omit, translate, paraphrase or repeat words.

#### TRANSCRIPT
${text}`;
}

function makeRequestBody(model: string, text: string) {
  const is38 = model.startsWith('gemini-3.8-');
  return {
    contents: [{
      role: 'user',
      parts: is38 ? [{ text, speechMetadata: { style: STYLE } }] : [{ text: legacyPrompt(text) }],
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: VOICE_NAME },
        },
      },
    },
  };
}

function pcmToWav(pcm: Buffer, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function wavDurationSeconds(buffer: Buffer): number {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return 0;
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ' && size >= 16 && offset + 20 <= buffer.length) byteRate = buffer.readUInt32LE(offset + 16);
    else if (id === 'data') {
      dataSize = Math.min(size, Math.max(0, buffer.length - offset - 8));
      break;
    }
    offset += 8 + size + (size % 2);
  }
  return byteRate > 0 && dataSize > 0 ? dataSize / byteRate : 0;
}

function sampleRateFromMime(mime: string) {
  const match = /rate=(\d+)/i.exec(mime || '');
  return match ? Number(match[1]) : 24000;
}

function safeHeader(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '').slice(0, 180);
}

export default async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return res.status(503).json({
      error: 'Gemini ses servisi yapılandırılmamış.',
      code: 'MISSING_GEMINI_API_KEY',
      fallbackAllowed: true,
    });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 5000) {
    return res.status(400).json({
      error: 'Seslendirme metni 1–5000 karakter arasında olmalıdır.',
      code: 'INVALID_TEXT',
      fallbackAllowed: false,
    });
  }

  const routeKey = String(req.body?.projectId || member.user.id || 'default');
  const attempts: Array<{ model: string; status: number; detail?: string }> = [];

  for (const model of modelOrder(routeKey)) {
    try {
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(105000),
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(makeRequestBody(model, text)),
        }
      );

      const raw = await upstream.text();
      if (!upstream.ok) {
        let detail = '';
        try {
          const parsed = JSON.parse(raw);
          detail = parsed?.error?.message || parsed?.message || '';
        } catch {
          detail = raw.slice(0, 180);
        }
        attempts.push({ model, status: upstream.status, detail });
        if (upstream.status === 401 || upstream.status === 403) break;
        continue;
      }

      const payload = JSON.parse(raw);
      const parts = payload?.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find((part: any) => part?.inlineData?.data);
      if (!audioPart?.inlineData?.data) {
        attempts.push({ model, status: 502, detail: 'Gemini yanıtında ses verisi yok.' });
        continue;
      }

      const upstreamMime = String(audioPart.inlineData.mimeType || '');
      let audio = Buffer.from(audioPart.inlineData.data, 'base64');
      if (audio.toString('ascii', 0, 4) !== 'RIFF') audio = pcmToWav(audio, sampleRateFromMime(upstreamMime));
      const duration = wavDurationSeconds(audio);

      res.status(200);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Provider', 'gemini');
      res.setHeader('X-TTS-Model', safeHeader(model));
      res.setHeader('X-TTS-Voice', VOICE_NAME);
      res.setHeader('X-Audio-Duration', Number(duration.toFixed(3)).toString());
      res.setHeader('X-Gemini-Attempts', String(attempts.length + 1));
      const chunkSize = 64 * 1024;
      for (let i = 0; i < audio.length; i += chunkSize) res.write(audio.subarray(i, i + chunkSize));
      return res.end();
    } catch (error: any) {
      attempts.push({ model, status: 502, detail: error?.message || 'Ağ hatası' });
    }
  }

  console.warn('[Gemini TTS] all free-tier models failed', attempts);
  return res.status(429).json({
    error: 'Gemini ücretsiz TTS modelleri şu anda kullanılamıyor veya günlük/dakikalık kota doldu.',
    code: 'GEMINI_TTS_EXHAUSTED',
    fallbackAllowed: true,
    attempts: attempts.map(a => ({ model: a.model, status: a.status })),
  });
}
