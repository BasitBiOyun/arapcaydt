import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Fixed Platform Voice Configuration
const STANDARD_VOICE_CONFIG = {
  voiceId: 'eUUtjbi66JcWz3T4Gvvo',
  name: 'Eğitmen Sesi',
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',

  voiceSettings: {
    speed: 1.0,
    stability: 0.50,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true,
  },
};

// ElevenLabs Server-side API endpoints

// 1. Status check
app.get('/api/elevenlabs/status', (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 0 && apiKey !== 'MY_ELEVENLABS_API_KEY');

  res.json({
    configured: isConfigured,
    mode: isConfigured ? 'live' : 'unconfigured',
    voice: {
      voiceId: STANDARD_VOICE_CONFIG.voiceId,
      name: STANDARD_VOICE_CONFIG.name,
    },
    modelId: STANDARD_VOICE_CONFIG.modelId,
    outputFormat: STANDARD_VOICE_CONFIG.outputFormat,
    message: isConfigured
      ? 'ElevenLabs API sunucuda hazır. Standart seslendirici devrede.'
      : 'ELEVENLABS_API_KEY sunucu ortamında henüz tanımlanmamış. AI Studio Settings menüsünden ekleyebilirsiniz.',
  });
});

// 2. Voice list - standard voice
app.get('/api/elevenlabs/voices', (req, res) => {
  res.json({
    voices: [
      {
        voice_id: STANDARD_VOICE_CONFIG.voiceId,
        name: STANDARD_VOICE_CONFIG.name,
        category: 'platform_standard',
        language: 'Turkish & Arabic (Multilingual v2)',
        accent: 'Academic / Clear',
        gender: 'female',
        description: 'Platform standart seslendiricisi (Hız: 1.0, Kararlılık: 0.50, Netlik: 0.75).',
        recommended: true,
      },
    ],
  });
});

import { isGeminiConfigured } from './server/gemini/client';
import { analyzeQuestionImage } from './server/gemini/analyzeQuestionImage';
import { analyzeSolution } from './server/gemini/analyzeSolution';
import { buildAnimationPlan } from './server/gemini/buildAnimationPlan';
import { transcribeAudioWithGemini } from './server/gemini/transcribeAudio';
import { parseSolutionSemantics } from './src/services/analysis/solutionParser';
import { alignEventsWithNarration } from './src/services/analysis/timelineAligner';
import { getYdtStandardGeometry } from './src/services/ocr/ydtQuestionDetector';

function extractBase64AndMime(dataUrlOrBase64: string): { data: string; mimeType: string } {
  const match = dataUrlOrBase64.match(/^data:([^;]+);base64,(.*)$/s);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/png', data: dataUrlOrBase64 };
}

// ============================================================================
// GEMINI SERVER-SIDE ENDPOINTS (Academic YDT Visual and Pedagogical Analysis)
// ============================================================================

// Transcribe uploaded audio with word-level timestamps using Gemini
app.post('/api/gemini/transcribe-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType, solutionText, duration } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Ses verisi (base64) gereklidir.' });
    }

    const clean = extractBase64AndMime(audioBase64);
    const result = await transcribeAudioWithGemini(
      clean.data,
      clean.mimeType || mimeType || 'audio/mp3',
      solutionText || '',
      duration || 15
    );
    return res.json(result);
  } catch (err: any) {
    console.error('Gemini transcribe audio failed:', err);
    return res.status(500).json({ error: `Ses deşifre edilemedi: ${err.message || err}` });
  }
});

// 1. Gemini status check
app.get('/api/gemini/status', (req, res) => {
  const configured = isGeminiConfigured();
  res.json({
    configured,
    model: 'gemini-3.8-flash',
    message: configured
      ? 'Gemini 3.8 Flash hazır. Soru görseli ve pedagojik çözüm analizi etkin.'
      : 'GEMINI_API_KEY sunucu ortamında tanımlanmamış.',
  });
});

// 2. Analyze Question Image layout
app.post('/api/gemini/analyze-question', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'Geçerli bir soru görseli (base64 veya data URL) gereklidir.' });
    }

    if (!isGeminiConfigured()) {
      return res.status(400).json({ error: 'GEMINI_API_KEY sunucu ortamında tanımlanmamış.' });
    }

    const { data, mimeType } = extractBase64AndMime(imageUrl);
    const result = await analyzeQuestionImage(data, mimeType);
    return res.json(result);
  } catch (err: any) {
    console.error('Gemini analyze-question failed:', err);
    return res.status(500).json({ error: `Soru görseli incelenemedi: ${err.message || err}` });
  }
});

// 3. Analyze Solution pedagogical plan
app.post('/api/gemini/analyze-solution', async (req, res) => {
  try {
    const { solutionText, arabicQuestionSnippet, declaredCorrectAnswer } = req.body;
    if (!solutionText || typeof solutionText !== 'string' || solutionText.trim().length === 0) {
      return res.status(400).json({ error: 'Çözüm metni gereklidir.' });
    }

    if (!isGeminiConfigured()) {
      return res.status(400).json({ error: 'GEMINI_API_KEY sunucu ortamında tanımlanmamış.' });
    }

    const result = await analyzeSolution(solutionText, arabicQuestionSnippet, declaredCorrectAnswer);
    return res.json(result);
  } catch (err: any) {
    console.error('Gemini analyze-solution failed:', err);
    return res.status(500).json({ error: `Çözüm metni analiz edilemedi: ${err.message || err}` });
  }
});

// 4. Complete Automated Pipeline: Deterministic local parsing + timeline alignment (Zero Gemini dependency)
app.post('/api/gemini/auto-pipeline', async (req, res) => {
  try {
    const {
      solutionText,
      correctAnswer,
      audioNarration,
      narrationSource,
      existingRegions,
    } = req.body;

    if (!solutionText || typeof solutionText !== 'string') {
      return res.status(400).json({ error: 'Çözüm metni gereklidir.' });
    }

    const effectiveSource = narrationSource || audioNarration;
    const words = effectiveSource?.words || [];
    const duration = effectiveSource?.duration || 15;

    // Use regions passed from client or deterministic YDT geometry
    const regions = (existingRegions && Array.isArray(existingRegions) && existingRegions.length > 0)
      ? existingRegions
      : getYdtStandardGeometry();

    // Deterministic Turkish pedagogical solution parsing
    const parseResult = parseSolutionSemantics(solutionText, regions, []);

    // Timeline alignment with spoken word timestamps
    const actions = alignEventsWithNarration(parseResult.events, words, duration);

    const detectedOptions = regions
      .filter((r: any) => r.type === 'option')
      .map((r: any) => r.id.replace('option-', '').toUpperCase());

    return res.json({
      success: true,
      regions,
      actions,
      stats: {
        totalEventsPlanned: parseResult.events.length,
        actionsGenerated: actions.length,
        actionsSkipped: parseResult.events.length - actions.length,
        groundedOptions: detectedOptions,
        arabicMatchesCount: 0,
      },
      deducedCorrectAnswer: parseResult.deducedCorrectAnswer || correctAnswer,
      duration,
      normalizedWords: words,
    });
  } catch (err: any) {
    console.error('[Deterministic Auto-Pipeline Error]:', err);
    return res.status(500).json({
      error: 'Yerel video analizi tamamlanamadı.',
    });
  }
});

function extractWordsFromAlignment(
  characters: string[],
  startTimes: number[],
  endTimes: number[]
): Array<{ text: string; start: number; end: number }> {
  const words: Array<{ text: string; start: number; end: number }> = [];
  let currentWord = '';
  let wordStart = 0;
  let wordEnd = 0;
  let inWord = false;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const isWhitespace = /\s/.test(char);
    if (!isWhitespace) {
      if (!inWord) {
        inWord = true;
        wordStart = startTimes[i] ?? 0;
      }
      currentWord += char;
      wordEnd = endTimes[i] ?? wordStart + 0.1;
    } else {
      if (inWord) {
        words.push({
          text: currentWord,
          start: parseFloat(wordStart.toFixed(2)),
          end: parseFloat(wordEnd.toFixed(2)),
        });
        currentWord = '';
        inWord = false;
      }
    }
  }
  if (inWord && currentWord.length > 0) {
    words.push({
      text: currentWord,
      start: parseFloat(wordStart.toFixed(2)),
      end: parseFloat(wordEnd.toFixed(2)),
    });
  }
  return words;
}

// 3. Audio Narration Generation with word-level alignment support
// Uses standard voice with speech-with-timestamps endpoint
app.post('/api/elevenlabs/generate', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Seslendirme için geçerli bir çözüm metni gereklidir.' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 0 && apiKey !== 'MY_ELEVENLABS_API_KEY');

  if (!isConfigured) {
    return res.status(400).json({
      error: 'ELEVENLABS_API_KEY sunucuda tanımlanmamış. Seslendirme üretmek için lütfen AI Studio ayarlarından ELEVENLABS_API_KEY ortam değişkenini yapılandırınız.',
    });
  }

  const voiceId = STANDARD_VOICE_CONFIG.voiceId;
  const modelId = STANDARD_VOICE_CONFIG.modelId;
  const outputFormat = STANDARD_VOICE_CONFIG.outputFormat; // mp3_44100_128
  const voiceSettings = STANDARD_VOICE_CONFIG.voiceSettings;

  try {
    // Request speech-with-timestamps endpoint with output_format=mp3_44100_128
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${encodeURIComponent(outputFormat)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          speed: voiceSettings.speed,
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarity_boost,
          style: voiceSettings.style,
          use_speaker_boost: voiceSettings.use_speaker_boost,
        },
      }),
    });

    if (!response.ok) {
      let errorMessage = `ElevenLabs API Hatası (${response.status}): ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (typeof errorJson.detail === 'string') {
          errorMessage = `ElevenLabs: ${errorJson.detail}`;
        } else if (errorJson.detail?.message) {
          errorMessage = `ElevenLabs: ${errorJson.detail.message}`;
        } else if (errorJson.message) {
          errorMessage = `ElevenLabs: ${errorJson.message}`;
        } else if (errorJson.error) {
          errorMessage = `ElevenLabs: ${errorJson.error}`;
        }
      } catch {
        const raw = await response.text().catch(() => '');
        if (raw) errorMessage = `ElevenLabs: ${raw.slice(0, 250)}`;
      }
      console.error('ElevenLabs API generate failed:', response.status, errorMessage);
      return res.status(response.status).json({ error: errorMessage });
    }

    const result = await response.json();
    const duration = result.alignment?.character_end_times_seconds?.slice(-1)[0] || 10;
    let words: Array<{ text: string; start: number; end: number }> = [];

    if (result.alignment?.characters) {
      words = extractWordsFromAlignment(
        result.alignment.characters,
        result.alignment.character_start_times_seconds,
        result.alignment.character_end_times_seconds
      );
    }

    return res.json({
      audioBase64: result.audio_base64,
      mimeType: 'audio/mpeg',
      alignment: result.alignment || null,
      words,
      wordAlignments: words.map((w) => ({ word: w.text, start: w.start, end: w.end })),
      mode: 'live',
      durationSeconds: parseFloat(duration.toFixed(1)),
      voiceId,
      voiceName: STANDARD_VOICE_CONFIG.name,
      modelId,
      outputFormat,
    });
  } catch (err: any) {
    console.error('Network error contacting ElevenLabs API:', err);
    return res.status(502).json({
      error: `ElevenLabs API ile iletişim kurulamadı: ${err.message || 'Ağ bağlantı hatası'}`,
    });
  }
});

// Production / Dev Vite static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Teacher Studio Server running on port ${PORT}`);
  });
}

startServer();
