import { createHash } from 'node:crypto';
import { requireMember, serviceDatabase } from '../../server/auth.js';
import { recordUsage, type UsageEvent } from '../../server/usage.js';
import { storedNarrationAudio } from '../../server/mp3.js';
import {
  GEMINI_TTS_MODELS as GEMINI_MODELS, isDailyQuotaError, isInvalidKeyError, quotaTag, markTeacherKeyInvalid, normalizeApiKey,
  readDailyState, readTeacherKey, usageDetail, type KeySource,
} from '../../server/quota.js';

export const config = { maxDuration: 120 };
export const REQUEST_BUDGET_MS = 95_000;
const MIN_ATTEMPT_MS = 10_000;

const VOICE_NAME = 'Achernar';
const STYLE = [
  'Experienced teacher solving an exam question in a quiet classroom.',
  'Natural, clear, confident and instructional delivery at a moderate pace.',
  'Use native pronunciation for every language in the transcript, including Turkish and Arabic,',
  'and switch languages naturally without carrying the accent of one language into the other.',
  'Naturally emphasize important clues, eliminated choices, contrasts and the final correct answer.',
  'Use brief natural pauses between reasoning steps.',
  'Do not sound like an announcer.',
  'Speak only the given text, word for word and exactly once: never add, omit, translate, paraphrase or repeat words, and add no greeting or closing remark.',
].join(' ');

/**
 * Older TTS models (3.1) read a director's prompt. No classroom scene: a scene invites the
 * model to improvise teacher talk. Fidelity comes first and the notes say they are not spoken.
 */
function legacyPrompt(text: string) {
  return `# AUDIO PROFILE: Achernar, experienced exam teacher

### DIRECTOR'S NOTES (never read these notes aloud)
Fidelity (most important): Speak only the transcript below, word for word, exactly once, from its first word to its last word. Do not add, drop, reorder, repeat, translate, summarize or explain anything. No greeting, no introduction, no closing remark, no words of your own.
Pronunciation: Read Turkish with native Turkish pronunciation and Arabic with native Arabic pronunciation, exactly as written, including Arabic vowel marks and Turkish circumflex letters (â, î, û). Switch languages without carrying one accent into the other.
Style: Natural, clear, calm and instructional, like a teacher explaining a solution. Not an announcer.
Pace: Moderate and steady, with brief natural pauses between reasoning steps.

#### TRANSCRIPT
${text}`;
}

function makeRequestBody(model: string, text: string) {
  const is38 = model.startsWith('gemini-3.8-');
  return {
    contents: [{
      role: 'user',
      parts: is38 ? [{ text, speech_metadata: { style: STYLE } }] : [{ text: legacyPrompt(text) }],
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: is38
          ? { voice: VOICE_NAME }
          : { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
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
  let offset = 12, byteRate = 0, dataSize = 0;
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

async function saveGeneratedAudio(memberId: string, projectId: string, text: string, audio: Buffer, extension: string, contentType: string) {
  const db = serviceDatabase();
  const digest = createHash('sha256').update(text).digest('hex').slice(0, 20);
  const path = `${memberId}/${projectId}/gemini-${digest}.${extension}`;
  const bucket = db.storage.from('project-assets');
  const { error: uploadError } = await bucket.upload(path, audio, { contentType, upsert: true });
  if (uploadError) throw new Error(`Gemini sesi depoya kaydedilemedi: ${uploadError.message}`);
  const { data, error: signedError } = await bucket.createSignedUrl(path, 21600);
  if (signedError || !data?.signedUrl) throw new Error('Gemini sesi için oynatma bağlantısı oluşturulamadı.');
  return { path, signedUrl: data.signedUrl };
}

interface Attempt { model: string; status: number; detail?: string; daily?: boolean; quota?: string; keySource: KeySource }

/** Each model attempt is its own request against that key's per-model free-tier quota. */
function failedUsage(attempts: Attempt[], characters: number): UsageEvent[] {
  return attempts.map(a => ({ kind: 'gemini_tts', state: 'failed', detail: usageDetail(a.model, a.status, a.daily, a.quota), characters, keySource: a.keySource }));
}

export default async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
  if (!text || text.length > 5000) {
    return res.status(400).json({ error: 'Seslendirme metni 1–5000 karakter arasında olmalıdır.', code: 'INVALID_TEXT', fallbackAllowed: false });
  }
  if (!projectId) {
    return res.status(400).json({ error: 'Gemini seslendirmesi için proje kimliği gerekli.', code: 'MISSING_PROJECT_ID', fallbackAllowed: false });
  }

  const db = serviceDatabase();
  const { data: project, error: projectError } = await db.from('projects').select('id').eq('id', projectId).eq('owner_id', member.user.id).maybeSingle();
  if (projectError || !project) {
    return res.status(403).json({ error: 'Gemini seslendirmesi için proje erişimi doğrulanamadı.', code: 'PROJECT_ACCESS_DENIED', fallbackAllowed: false });
  }

  // Teacher's own key first (their own free quota), then the studio key; models already
  // out of daily quota on that key are skipped until the Pacific reset.
  const systemKey = normalizeApiKey(process.env.GEMINI_API_KEY);
  const [teacherKey, today] = await Promise.all([readTeacherKey(db, member.user.id), readDailyState(db, member.user.id)]);
  const lanes: Array<{ source: KeySource; key: string; skip: string[] }> = [];
  if (teacherKey) lanes.push({ source: 'teacher', key: teacherKey, skip: today.own.ttsExhausted });
  if (systemKey) lanes.push({ source: 'system', key: systemKey, skip: today.shared.ttsExhausted });
  if (!lanes.length) {
    return res.status(503).json({ error: 'Gemini ses servisi yapılandırılmamış.', code: 'MISSING_GEMINI_API_KEY', fallbackAllowed: true });
  }

  // The function stops at 120 s: keep ~25 s for storing the audio and logging usage.
  const deadline = Date.now() + REQUEST_BUDGET_MS;
  const attempts: Attempt[] = [];
  lanes: for (const lane of lanes) {
    for (const model of GEMINI_MODELS.filter(m => !lane.skip.includes(m))) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) break lanes;
      try {
        const upstream = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(remaining),
            headers: { 'x-goog-api-key': lane.key, 'Content-Type': 'application/json' },
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
          attempts.push({ model, status: upstream.status, detail, daily: isDailyQuotaError(upstream.status, raw), quota: quotaTag(upstream.status, raw), keySource: lane.source });
          if (lane.source === 'teacher' && isInvalidKeyError(upstream.status, raw)) await markTeacherKeyInvalid(db, member.user.id);
          if (upstream.status === 401 || upstream.status === 403 || isInvalidKeyError(upstream.status, raw)) break;
          continue;
        }

        const payload = JSON.parse(raw);
        const audioPart = (payload?.candidates?.[0]?.content?.parts || []).find((part: any) => part?.inlineData?.data);
        if (!audioPart?.inlineData?.data) {
          attempts.push({ model, status: 502, detail: 'Gemini yanıtında ses verisi yok.', keySource: lane.source });
          continue;
        }

        const upstreamMime = String(audioPart.inlineData.mimeType || '');
        let wav = Buffer.from(audioPart.inlineData.data, 'base64');
        if (wav.toString('ascii', 0, 4) !== 'RIFF') wav = pcmToWav(wav, sampleRateFromMime(upstreamMime));
        const duration = wavDurationSeconds(wav);
        const audio = await storedNarrationAudio(wav);
        const stored = await saveGeneratedAudio(member.user.id, projectId, text, audio.bytes, audio.extension, audio.mimeType);

        await recordUsage(member.user.id, projectId, [...failedUsage(attempts, text.length),
          { kind: 'gemini_tts', state: 'succeeded', detail: model, characters: text.length, keySource: lane.source }]);
        return res.status(200).json({
          audioUrl: stored.signedUrl,
          assetPath: stored.path,
          mimeType: audio.mimeType,
          mode: 'live',
          durationSeconds: Number(duration.toFixed(3)),
          provider: 'gemini',
          modelId: model,
          voiceId: VOICE_NAME,
          voiceName: VOICE_NAME,
          attempts: attempts.length + 1,
          keySource: lane.source,
        });
      } catch (error: any) {
        attempts.push({ model, status: 502, detail: error?.message || 'Ağ hatası', keySource: lane.source });
      }
    }
  }

  await recordUsage(member.user.id, projectId, failedUsage(attempts, text.length));
  const compact = attempts.length
    ? attempts.map(a => `${a.keySource === 'teacher' ? 'kendi anahtarı' : 'ortak anahtar'} ${a.model}: HTTP ${a.status}${a.detail ? ` (${a.detail.slice(0, 120)})` : ''}`).join(' | ')
    : 'Bugünkü Gemini seslendirme kotaları dolu.';
  console.warn('[Gemini TTS] all free-tier models failed', attempts);
  return res.status(429).json({
    error: `Gemini TTS başarısız. ${compact || 'Model yanıtı alınamadı.'}`,
    code: 'GEMINI_TTS_EXHAUSTED',
    fallbackAllowed: true,
    attempts,
  });
}
