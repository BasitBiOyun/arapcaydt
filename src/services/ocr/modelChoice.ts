/**
 * Two Arabic models read every picture: our own (trained on teachers' Soru çöz pictures) and the
 * stock one, which still reads ÖSYM-style print better. Measured on 355 hand-checked lines
 * (2026-10-03): keeping the stock reading only when it is more confident over enough Arabic words
 * kept Soru çöz at 131/177 exact lines and lifted ÖSYM style from 131 to 144/178. Few-word pictures
 * give unreliable confidences, so they stay with our model.
 */
export const OWN_ARABIC = 'ara';
export const STOCK_ARABIC = 'araeski';
const MIN_ARABIC_WORDS = 20;

export interface ArabicConfidence { words: number; mean: number }

/** Letter-weighted mean confidence of the Arabic words in a Tesseract result (blocks output). */
export function arabicConfidence(data: any): ArabicConfidence {
  let words = 0, letters = 0, sum = 0;
  for (const block of data?.blocks || []) for (const paragraph of block?.paragraphs || [])
    for (const line of paragraph?.lines || []) for (const word of line?.words || []) {
      const text = String(word?.text || '').trim();
      if (!/[ء-ي]/.test(text)) continue;
      words += 1; letters += text.length; sum += Number(word.confidence || 0) * text.length;
    }
  return { words, mean: letters ? sum / letters : 0 };
}

export function preferStockArabic(own: ArabicConfidence, stock: ArabicConfidence): boolean {
  return stock.words >= MIN_ARABIC_WORDS && stock.mean > own.mean;
}
