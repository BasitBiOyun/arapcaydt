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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === 'MY_ELEVENLABS_API_KEY') {
    console.error('[ElevenLabs] ELEVENLABS_API_KEY is missing in Vercel runtime.');
    return res.status(500).json({
      error: 'Ses servisi yapılandırılmamış. ELEVENLABS_API_KEY ortam değişkenini kontrol edin.',
    });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    return res.status(400).json({
      error: 'Seslendirme için geçerli bir çözüm metni gereklidir.',
    });
  }

  try {
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_CONFIG.voiceId}/with-timestamps?output_format=${encodeURIComponent(VOICE_CONFIG.outputFormat)}`;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: VOICE_CONFIG.modelId,
        voice_settings: VOICE_CONFIG.voiceSettings,
      }),
    });

    if (!upstream.ok) {
      const raw = await upstream.text();
      let message = `ElevenLabs API hatası (${upstream.status})`;
      try {
        const parsed = JSON.parse(raw);
        message = parsed?.detail?.message || parsed?.detail || parsed?.message || parsed?.error || message;
      } catch {
        if (raw) message = raw.slice(0, 300);
      }
      console.error('[ElevenLabs upstream]', upstream.status, message);
      return res.status(upstream.status).json({ error: String(message) });
    }

    const result: any = await upstream.json();
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
    });
  } catch (error: any) {
    console.error('[ElevenLabs network error]', error);
    return res.status(502).json({
      error: `Ses servisine bağlanılamadı: ${error?.message || 'Bilinmeyen ağ hatası'}`,
    });
  }
}
