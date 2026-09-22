import voiceHandler from './api/elevenlabs/generate';
import voiceStatusHandler from './api/elevenlabs/status';
import voiceListHandler from './api/elevenlabs/voices';
import { requireMember } from './server/auth';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/api/elevenlabs/status', voiceStatusHandler);
app.get('/api/elevenlabs/voices', voiceListHandler);
app.post('/api/elevenlabs/generate', voiceHandler);
app.use('/api', async(req,res,next)=>{if(await requireMember(req,res))next();});

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
