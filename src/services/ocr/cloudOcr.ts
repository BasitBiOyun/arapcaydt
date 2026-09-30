import { authHeaders } from '../supabase';
import { groupOcrWordsIntoLines } from './arabicMatcher';
import type { OCRLine, OCRProgress, OCRResult, OCRWord } from './ocrTypes';

/**
 * Google Cloud Vision reads the question picture on the server (/api/vision/ocr). It reads
 * printed Arabic much better than the in-browser reader; when it is not set up or fails, the
 * studio falls back to the in-browser reader.
 */

/** Longest side of the picture sent: enough for small print, well under the request limit. */
const SEND_LONG_SIDE = 2400;

interface VisionWord { text: string; confidence: number; x: number; y: number; width: number; height: number }
export interface VisionPage { width: number; height: number; words: VisionWord[]; lines: number[][]; text: string }

/** Not set up on this server: asked once per session, then the in-browser reader is used. */
let notConfigured = false;

/** The picture as a JPEG (white background, long side at most 2400 px). */
async function pictureForCloud(imageUrl: string): Promise<string | null> {
  const img = await new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
  if (!img?.naturalWidth || !img.naturalHeight) return null;
  const scale = Math.min(1, SEND_LONG_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', .92).split(',')[1] || null;
  } catch {
    return null; // A picture from another site without permission cannot be read back.
  }
}

/** Option letters ("A)", or "A" with its ")" read as a separate word), as the detector expects them. */
export function optionMarkersFrom(words: OCRWord[]): OCRWord[] {
  const markers: OCRWord[] = [];
  for (const word of words) {
    const text = word.text.trim();
    if (/^[([]?[A-E][)\].:]$/.test(text)) { markers.push(word); continue; }
    if (!/^[A-E]$/.test(text)) continue;
    const mid = word.y + word.height / 2;
    const mark = words.find(o => o !== word && /^[)\].:]$/.test(o.text.trim())
      && Math.abs(o.y + o.height / 2 - mid) < word.height * .6
      && o.x >= word.x + word.width * .5 && o.x - (word.x + word.width) < word.height * .8);
    if (mark) markers.push({ ...word, text: text + mark.text.trim(), width: mark.x + mark.width - word.x,
      pixelWidth: mark.pixelX + mark.pixelWidth - word.pixelX });
  }
  return markers;
}

/** What the studio's detectors read: words and lines in shares of the picture, like the in-browser reader gives. */
export function visionToOcr(page: VisionPage): OCRResult {
  const toWord = (w: VisionWord): OCRWord => ({
    text: w.text, confidence: w.confidence,
    x: w.x / page.width, y: w.y / page.height, width: w.width / page.width, height: w.height / page.height,
    pixelX: w.x, pixelY: w.y, pixelWidth: w.width, pixelHeight: w.height,
  });
  const all = page.words.map(toWord);
  const lines: OCRLine[] = page.lines.map(indices => indices.map(i => all[i])).filter(ws => ws.length).map(ws => {
    const x = Math.min(...ws.map(w => w.x)), y = Math.min(...ws.map(w => w.y));
    return {
      text: ws.map(w => w.text).join(' '), confidence: ws.reduce((n, w) => n + w.confidence, 0) / ws.length,
      x, y, width: Math.max(...ws.map(w => w.x + w.width)) - x, height: Math.max(...ws.map(w => w.y + w.height)) - y, words: ws,
    };
  }).sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const words = groupOcrWordsIntoLines(all).flat();
  return {
    text: page.text || lines.map(l => l.text).join('\n'),
    imageWidth: page.width, imageHeight: page.height,
    words, lines, optionMarkers: optionMarkersFrom(words),
  };
}

/** The picture read by Google Vision, or null (not set up, not reachable, nothing read): use the in-browser reader. */
export async function readWithVision(imageUrl: string, onProgress?: (progress: OCRProgress) => void): Promise<OCRResult | null> {
  if (notConfigured) return null;
  onProgress?.({ status: 'recognizing', progress: 30, message: 'Soru görseli Google Vision ile okunuyor...' });
  const image = await pictureForCloud(imageUrl);
  if (!image) return null;
  try {
    const res = await fetch('/api/vision/ocr', {
      method: 'POST',
      signal: AbortSignal.timeout(50_000),
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ image }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.code === 'VISION_NOT_CONFIGURED') notConfigured = true;
      else console.warn('Google Vision okuyamadı, tarayıcıdaki okuyucu kullanılıyor:', data?.code || res.status);
      return null;
    }
    if (!data?.words?.length || !data.width || !data.height) return null;
    onProgress?.({ status: 'completed', progress: 100, message: `${data.words.length} kelime Google Vision ile okundu.` });
    return visionToOcr(data as VisionPage);
  } catch {
    return null;
  }
}
