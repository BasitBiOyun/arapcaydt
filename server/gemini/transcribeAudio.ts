import { getGeminiClient, isGeminiConfigured, PRIMARY_MODEL } from './client';
import { Type } from '@google/genai';

export interface NarrationWord {
  text: string;
  start: number;
  end: number;
}

export interface AudioTranscriptionResult {
  transcript: string;
  duration: number;
  words: NarrationWord[];
  source: 'gemini' | 'fallback';
}

/** Helper: Clean punctuation and whitespace */
function cleanWord(str: string): string {
  return str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, '').trim();
}

/** Fallback alignment using solution text and audio duration */
export function buildFallbackWordTimings(
  solutionText: string,
  audioDuration = 15
): NarrationWord[] {
  const rawWords = solutionText
    .split(/\s+/)
    .map((w) => cleanWord(w))
    .filter((w) => w.length > 0);

  if (rawWords.length === 0) {
    return [
      { text: 'Soru', start: 0.2, end: 1.0 },
      { text: 'Çözümü', start: 1.1, end: 2.0 },
    ];
  }

  const durationPerWord = Math.max(0.25, (audioDuration * 0.92) / rawWords.length);
  const startOffset = 0.3;

  return rawWords.map((word, idx) => {
    const start = parseFloat((startOffset + idx * durationPerWord).toFixed(2));
    const end = parseFloat((start + durationPerWord * 0.85).toFixed(2));
    return {
      text: word,
      start,
      end: Math.min(end, audioDuration),
    };
  });
}

/**
 * Transcribes audio with word-level timestamps using Gemini.
 * Uses the teacher's solution text as semantic context.
 */
export async function transcribeAudioWithGemini(
  audioBase64: string,
  mimeType = 'audio/mp3',
  solutionText = '',
  audioDuration = 15
): Promise<AudioTranscriptionResult> {
  if (!isGeminiConfigured()) {
    console.warn('[Gemini Transcribe] GEMINI_API_KEY missing, using fallback word timing');
    const words = buildFallbackWordTimings(solutionText, audioDuration);
    return {
      transcript: solutionText,
      duration: audioDuration,
      words,
      source: 'fallback',
    };
  }

  try {
    const ai = getGeminiClient();

    const prompt = `You are an expert audio transcription system specialized in academic and exam question explanations.
Transcribe the provided teacher audio narration with precise word-level start and end timestamps in seconds.

The teacher's written solution text is provided below for semantic context:
"""
${solutionText || 'Genel soru çözümü'}
"""

Extract:
1. "transcript": The complete transcribed text.
2. "duration": Approximate total audio duration in seconds.
3. "words": Array of every spoken word with start and end times in seconds (e.g. start: 0.45, end: 0.88).
Timestamps MUST be strictly monotonically increasing numbers in seconds.`;

    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: [
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType || 'audio/mp3',
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            duration: { type: Type.NUMBER },
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                },
                required: ['text', 'start', 'end'],
              },
            },
          },
          required: ['words'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const words: NarrationWord[] = (parsed.words || []).map((w: any) => ({
      text: String(w.text || '').trim(),
      start: typeof w.start === 'number' ? parseFloat(w.start.toFixed(2)) : 0,
      end: typeof w.end === 'number' ? parseFloat(w.end.toFixed(2)) : 0.5,
    })).filter((w: NarrationWord) => w.text.length > 0);

    if (words.length === 0) {
      throw new Error('Gemini returned empty word timestamps');
    }

    const maxEnd = Math.max(...words.map((w) => w.end), audioDuration || 15);

    return {
      transcript: parsed.transcript || solutionText,
      duration: parsed.duration || maxEnd,
      words,
      source: 'gemini',
    };
  } catch (err) {
    console.warn('[Gemini Transcribe Warning] Error in transcription, falling back:', err);
    const words = buildFallbackWordTimings(solutionText, audioDuration);
    return {
      transcript: solutionText,
      duration: audioDuration,
      words,
      source: 'fallback',
    };
  }
}
