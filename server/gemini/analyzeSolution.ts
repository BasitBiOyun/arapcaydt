import { Type } from '@google/genai';
import { generateContentWithRetry, PRIMARY_MODEL } from './client';

export type SemanticActionType =
  | 'focus'
  | 'underline'
  | 'highlight'
  | 'reject'
  | 'correct'
  | 'dimOthers'
  | 'zoom'
  | 'clearTemporaryFocus';

export interface SemanticVideoEvent {
  spokenAnchor: string;
  action: SemanticActionType;
  target: {
    type: 'option' | 'text' | 'region';
    option?: 'A' | 'B' | 'C' | 'D' | 'E';
    text?: string;
    regionType?: string;
  };
}

export interface SolutionAnalysisResult {
  correctOption?: 'A' | 'B' | 'C' | 'D' | 'E';
  events: SemanticVideoEvent[];
}

const solutionAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    correctOption: {
      type: Type.STRING,
      enum: ['A', 'B', 'C', 'D', 'E'],
      description: "The deduced correct answer option letter",
    },
    events: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          spokenAnchor: {
            type: Type.STRING,
            description: "The verbatim Turkish/Arabic phrase or keyword from the solution text where this visual action should happen (e.g. 'A seçeneği', 'uygun değildir', 'Doğru cevabımız C', 'الباحثين')",
          },
          action: {
            type: Type.STRING,
            enum: [
              'focus',
              'underline',
              'highlight',
              'reject',
              'correct',
              'dimOthers',
              'zoom',
              'clearTemporaryFocus',
            ],
          },
          target: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ['option', 'text', 'region'],
              },
              option: {
                type: Type.STRING,
                enum: ['A', 'B', 'C', 'D', 'E'],
              },
              text: {
                type: Type.STRING,
                description: "If type is text: the referenced Arabic word or phrase",
              },
              regionType: {
                type: Type.STRING,
                description: "If target is a region like 'sentence', 'blank', 'instruction'",
              },
            },
            required: ['type'],
          },
        },
        required: ['spokenAnchor', 'action', 'target'],
      },
      description: "Ordered sequence of semantic video actions synchronized with spoken cues in narration",
    },
  },
  required: ['events'],
};

export async function analyzeSolution(
  solutionText: string,
  arabicQuestionSnippet?: string,
  declaredCorrectAnswer?: string
): Promise<SolutionAnalysisResult> {
  const prompt = `You are an expert video director and pedagogical animator for Turkish ÖSYM YDT Arabic exam question video solutions.

TASK:
Analyze the teacher's explanation text below and produce an ordered sequence of restrained, academic video direction events.

TEACHER'S SOLUTION TEXT:
"""${solutionText}"""

${arabicQuestionSnippet ? `ARABIC QUESTION SNIPPET / ROOT:\n"""${arabicQuestionSnippet}"""\n` : ''}
${declaredCorrectAnswer ? `DECLARED CORRECT OPTION: ${declaredCorrectAnswer}\n` : ''}

RULES FOR DIRECTION:
1. When the teacher begins discussing an option (e.g. "A seçeneğine bakalım", "A şıkkı"):
   -> Action: "focus", Target: { type: "option", option: "A" }, spokenAnchor: "A seçeneği" (or relevant phrase).
2. When the teacher explains why an option is incorrect or eliminates it (e.g. "uygun değildir", "yanlıştır", "bu seçeneği eliyoruz", "çelişmektedir"):
   -> Action: "reject", Target: { type: "option", option: "A" }, spokenAnchor: "uygun değildir" (exact phrase in text).
3. When the teacher identifies or confirms the correct answer (e.g. "Doğru cevabımız C seçeneğidir", "C şıkkı doğru", "cümleyi doğru tamamlar"):
   -> Action: "correct", Target: { type: "option", option: "C" }, spokenAnchor: "Doğru cevabımız C".
4. When the teacher points to a specific Arabic grammatical clue or word in the question sentence (e.g. "Buradaki الباحثين kelimesi çoğul olduğu için", "موصول sılasına dikkat"):
   -> Action: "underline", Target: { type: "text", text: "الباحثين" }, spokenAnchor: exact phrase containing the mention.
5. All 'spokenAnchor' values MUST exist verbatim or near-verbatim in the solution text so they can be matched with speech timestamps.
6. Order the events in the exact chronological order that the teacher speaks them in the text.`;

  try {
    const response = await generateContentWithRetry({
      model: PRIMARY_MODEL,
      contents: [
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: solutionAnalysisSchema,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text) as SolutionAnalysisResult;
      if (parsed.events && parsed.events.length > 0) {
        return {
          correctOption: parsed.correctOption,
          events: parsed.events,
        };
      }
    }
  } catch (err) {
    console.warn(
      '[Gemini analyzeSolution] High demand or model unavailability encountered. Using resilient semantic rule-based parser fallback:',
      err
    );
  }

  // Graceful semantic rule-based fallback for Turkish solution text
  return fallbackRuleBasedAnalyzeSolution(solutionText, arabicQuestionSnippet, declaredCorrectAnswer);
}

/**
 * Robust rule-based semantic parser for Turkish YDT Arabic question solutions.
 * Activates seamlessly if Gemini is experiencing high demand (503) or network spikes.
 */
export function fallbackRuleBasedAnalyzeSolution(
  solutionText: string,
  arabicQuestionSnippet?: string,
  declaredCorrectAnswer?: string
): SolutionAnalysisResult {
  const events: SemanticVideoEvent[] = [];

  // 1. Detect correct option
  let correctOption: 'A' | 'B' | 'C' | 'D' | 'E' | undefined = undefined;
  if (declaredCorrectAnswer && ['A', 'B', 'C', 'D', 'E'].includes(declaredCorrectAnswer.toUpperCase())) {
    correctOption = declaredCorrectAnswer.toUpperCase() as any;
  } else {
    const match = solutionText.match(/(?:doğru\s+(?:cevap|seçenek|şık)(?:ımız|tır|dır)?[:\s]+|cevap\s+)([A-E])/i);
    if (match) {
      correctOption = match[1].toUpperCase() as any;
    } else {
      const match2 = solutionText.match(/([A-E])\s*(?:seçeneği|şıkkı)\s*(?:doğru|uygun|tamamlar)/i);
      if (match2) {
        correctOption = match2[1].toUpperCase() as any;
      }
    }
  }

  // 2. Scan sentences for option mentions and pedagogical actions
  const sentences = solutionText.split(/(?<=[.!?;\n])\s+/);
  const optionsMentioned = new Set<string>();

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // Detect option letters in this sentence: A, B, C, D, E
    const optMatch = trimmed.match(/\b([A-E])\s*(?:seçeneğ|şıkk|bendi|\))/i);
    if (optMatch) {
      const opt = optMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
      optionsMentioned.add(opt);

      // Verbatim anchor for this option introduction
      const anchorOpt = trimmed.slice(0, Math.min(trimmed.length, 30));
      events.push({
        spokenAnchor: anchorOpt,
        action: 'focus',
        target: { type: 'option', option: opt },
      });

      // Is this option rejected?
      const isRejection = /(?:yanlış|elenir|uygun değil|uymaz|çeliş|olamaz|farklı|uymamakta|hatalı|anlamsız)/i.test(trimmed);
      if (isRejection && opt !== correctOption) {
        events.push({
          spokenAnchor: anchorOpt,
          action: 'reject',
          target: { type: 'option', option: opt },
        });
      }

      // Is this option correct?
      const isCorrect = /(?:doğru|tamamlar|cevabımız|uygundur|sağlar)/i.test(trimmed);
      if (isCorrect || opt === correctOption) {
        if (opt === correctOption || !correctOption) {
          correctOption = opt;
          events.push({
            spokenAnchor: anchorOpt,
            action: 'correct',
            target: { type: 'option', option: opt },
          });
        }
      }
    }
  }

  // 3. If correct option wasn't confirmed in events, add it
  if (correctOption) {
    const hasCorrectEvent = events.some((e) => e.action === 'correct' && e.target.option === correctOption);
    if (!hasCorrectEvent) {
      // Find where correct answer is mentioned or use end of text
      const anchor = solutionText.slice(Math.max(0, solutionText.length - 40));
      events.push({
        spokenAnchor: anchor,
        action: 'correct',
        target: { type: 'option', option: correctOption },
      });
    }
  }

  // 4. Ensure remaining standard options get appropriate actions if mentioned
  const standardOpts: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];
  standardOpts.forEach((opt) => {
    if (opt !== correctOption && !events.some((e) => e.target.option === opt)) {
      // If teacher didn't explicitly dissect this option in detail, add a lightweight focus & reject
      events.push({
        spokenAnchor: `${opt} seçeneği`,
        action: 'reject',
        target: { type: 'option', option: opt },
      });
    }
  });

  return {
    correctOption: correctOption || 'C',
    events,
  };
}
