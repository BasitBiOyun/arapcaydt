import { requireMember, serviceDatabase } from '../../server/auth.js';
export const config = {
  maxDuration: 60,
};

const VOICE_CONFIG = {
  voiceId: 'eUUtjbi66JcWz3T4Gvvo',
  name: 'Eğitmen Sesi',
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
  voiceSettings: {
    speed: 1,
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    use_speaker_boost: true,
  },
};

function clampSetting(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function resolveVoiceSettings(value: any) {
  const defaults = VOICE_CONFIG.voiceSettings;
  const requested = value && typeof value === 'object' ? value : {};
  return {
    speed: clampSetting(requested.speed, 0.7, 1.2, defaults.speed),
    stability: clampSetting(requested.stability, 0, 1, defaults.stability),
    similarity_boost: clampSetting(requested.similarity_boost, 0, 1, defaults.similarity_boost),
    style: clampSetting(requested.style, 0, 1, defaults.style),
    use_speaker_boost:
      typeof requested.use_speaker_boost === 'boolean'
        ? requested.use_speaker_boost
        : defaults.use_speaker_boost,
  };
}

function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

function extractWordsFromAlignment(
  characters: string[] = [],
  startTimes: number[] = [],
  endTimes: number[] = []
) {
  const words: Array<{ text: string; start: number; end: number }> = [];
  let currentWord = '';
  let wordStart = 0;
  let wordEnd = 0;
  let inWord = false;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (!/\s/.test(char)) {
      if (!inWord) {
        inWord = true;
        wordStart = startTimes[i] ?? 0;
      }
      currentWord += char;
      wordEnd = endTimes[i] ?? wordStart + 0.1;
      continue;
    }

    if (inWord) {
      words.push({
        text: currentWord,
        start: Number(wordStart.toFixed(2)),
        end: Number(wordEnd.toFixed(2)),
      });
      currentWord = '';
      inWord = false;
    }
  }

  if (inWord && currentWord) {
    words.push({
      text: currentWord,
      start: Number(wordStart.toFixed(2)),
      end: Number(wordEnd.toFixed(2)),
    });
  }

  return words;
}

function getUpstreamError(status: number, raw: string): string {
  let upstreamMessage = '';
  let upstreamCode = '';

  try {
    const parsed = JSON.parse(raw);
    const detail = parsed?.detail;
    upstreamCode = detail?.status || parsed?.status || '';
    upstreamMessage =
      detail?.message ||
      (typeof detail === 'string' ? detail : '') ||
      parsed?.message ||
      parsed?.error ||
      '';
  } catch {
    upstreamMessage = raw.slice(0, 300);
  }

  if (status === 401 || upstreamCode === 'invalid_api_key') {
    return 'Ses servisi API anahtarı geçersiz. Vercel ortam değişkenindeki ELEVENLABS_API_KEY değerini kontrol edin.';
  }
  if (status === 403) {
    return 'Ses servisi isteği reddedildi. API anahtarının Text to Speech iznini ve varsa IP kısıtlamasını kontrol edin.';
  }
  if (status === 429 || upstreamCode === 'quota_exceeded') {
    return 'Ses servisi kullanım kotası dolmuş görünüyor. Hesap kotasını kontrol edin.';
  }
  if (upstreamCode === 'voice_not_found') {
    return 'Tanımlı ses hesabınızda kullanılamıyor veya voice ID erişilebilir değil.';
  }
  if (upstreamCode === 'max_character_limit_exceeded') {
    return 'Çözüm metni tek seslendirme isteği için izin verilen uzunluğu aşıyor.';
  }

  return upstreamMessage
    ? `Ses servisi hatası (${status}): ${upstreamMessage}`
    : `Ses servisi hatası (${status}).`;
}

export default async function handler(req: any, res: any) {
  const member=await requireMember(req,res);
  if(!member)return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = normalizeApiKey(process.env.ELEVENLABS_API_KEY);
  if (!apiKey || apiKey === 'MY_ELEVENLABS_API_KEY') {
    console.error('[ElevenLabs] ELEVENLABS_API_KEY is missing in Vercel runtime.');
    return res.status(500).json({
      error: 'Ses servisi yapılandırılmamış. Vercel ortam değişkeninde ELEVENLABS_API_KEY bulunamadı.',
      code: 'MISSING_ELEVENLABS_API_KEY',
    });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    return res.status(400).json({
      error: 'Seslendirme için geçerli bir çözüm metni gereklidir.',
      code: 'EMPTY_TEXT',
    });
  }

  const voiceSettings = resolveVoiceSettings(req.body?.voiceSettings);

  let audit: ReturnType<typeof serviceDatabase>;
  let eventId: string;
  try {
    audit=serviceDatabase();
    const {data,error}=await audit.rpc('reserve_voice',{member_id:member.user.id,target_project:req.body?.projectId||'',char_count:text.length});
    if(error) return res.status(403).json({error:error.message});
    eventId=data;
  } catch {return res.status(503).json({error:'Ses kullanım kaydı açılamadı; ücretli istek gönderilmedi.'});}
  const finish=async(state:string)=>{const {error}=await audit.from('activity').update({state}).eq('id',eventId);if(error)console.error('Voice audit update failed');};
  try {
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_CONFIG.voiceId}/with-timestamps?output_format=${encodeURIComponent(VOICE_CONFIG.outputFormat)}`;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(50000),
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: VOICE_CONFIG.modelId,
        voice_settings: voiceSettings,
      }),
    });

    if (!upstream.ok) {
      await finish('failed');
      const raw = await upstream.text();
      const message = getUpstreamError(upstream.status, raw);
      console.error('[ElevenLabs upstream]', upstream.status, raw.slice(0, 500));
      return res.status(upstream.status).json({
        error: message,
        code: 'ELEVENLABS_UPSTREAM_ERROR',
        upstreamStatus: upstream.status,
      });
    }

    const result: any = await upstream.json();
    if (!result?.audio_base64) {
      await finish('failed');
      console.error('[ElevenLabs] Successful response did not contain audio_base64.');
      return res.status(502).json({
        error: 'Ses servisi geçerli bir ses dosyası döndürmedi.',
        code: 'MISSING_AUDIO_PAYLOAD',
      });
    }

    const alignment = result.alignment || result.normalized_alignment || null;
    const words = alignment?.characters
      ? extractWordsFromAlignment(
          alignment.characters,
          alignment.character_start_times_seconds,
          alignment.character_end_times_seconds
        )
      : [];

    const endTimes = alignment?.character_end_times_seconds || [];
    const duration = endTimes.length ? endTimes[endTimes.length - 1] : 10;

    await finish('succeeded');
    return res.status(200).json({
      audioBase64: result.audio_base64,
      mimeType: 'audio/mpeg',
      alignment,
      words,
      wordAlignments: words.map((word) => ({ word: word.text, start: word.start, end: word.end })),
      mode: 'live',
      durationSeconds: Number(Number(duration).toFixed(1)),
      voiceId: VOICE_CONFIG.voiceId,
      voiceName: VOICE_CONFIG.name,
      modelId: VOICE_CONFIG.modelId,
      outputFormat: VOICE_CONFIG.outputFormat,
      voiceSettings,
    });
  } catch (error: any) {
    await finish('uncertain');
    console.error('[ElevenLabs network error]', error?.name);
    return res.status(502).json({
      error: `Ses servisine bağlanılamadı: ${error?.message || 'Bilinmeyen ağ hatası'}`,
      code: 'ELEVENLABS_NETWORK_ERROR',
    });
  }
}
