import { Type } from '@google/genai';
import { generateContentWithRetry, PRIMARY_MODEL } from './client';

export interface LocatedBox {
  found: boolean;
  box?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  confidence?: number;
}

const locateSchema = {
  type: Type.OBJECT,
  properties: {
    found: {
      type: Type.BOOLEAN,
      description: "True ONLY if the exact Arabic text is clearly visible in the image",
    },
    box: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "Normalized bounding box [ymin, xmin, ymax, xmax] between 0 and 1000 if found",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence from 0.0 to 1.0",
    },
  },
  required: ['found'],
};

export async function locateTextInImage(
  base64Data: string,
  targetText: string,
  mimeType = 'image/png'
): Promise<LocatedBox> {
  if (!targetText || targetText.trim().length === 0) {
    return { found: false };
  }

  const prompt = `Locate the following specific Arabic text or phrase in this question image:
Target Text: "${targetText}"

RULES:
- If this exact word or phrase is clearly present on the image, set found=true and provide its tight bounding box [ymin, xmin, ymax, xmax] (0-1000).
- If it is not present or you are not confident, set found=false. DO NOT GUESS OR ESTIMATE.
- Quality rule: Skipping an ungrounded location is required; false locations are strictly forbidden.`;

  try {
    const response = await generateContentWithRetry({
      model: PRIMARY_MODEL,
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: locateSchema,
        temperature: 0.0,
      },
    });

    const resText = response.text;
    if (!resText) return { found: false };

    const parsed = JSON.parse(resText) as LocatedBox;
    if (parsed.found && Array.isArray(parsed.box) && parsed.box.length === 4) {
      const [ymin, xmin, ymax, xmax] = parsed.box.map((v) => Math.max(0, Math.min(1000, Math.round(v))));
      if (ymax > ymin && xmax > xmin) {
        return {
          found: true,
          box: [ymin, xmin, ymax, xmax],
          confidence: parsed.confidence || 0.9,
        };
      }
    }
    return { found: false };
  } catch (err) {
    console.warn(`Could not locate text "${targetText}" in image:`, err);
    return { found: false };
  }
}
