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

/** The picture's fingerprint (SHA-256 of its bytes), or null when it cannot be read. */
export async function imageKey(imageUrl: string): Promise<string | null> {
  try {
    const bytes = await (await fetch(imageUrl)).arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** Only what the studio reads from a Vision answer (kept with the question). */
const pageOf = (data: VisionPage): VisionPage =>
  ({ width: data.width, height: data.height, text: data.text || '', lines: data.lines || [], words: data.words });

/** Not set up on this server: asked once per session, then the in-browser reader is used. */
let notConfigured = false;
let skipReason = 'VISION_NOT_CONFIGURED';

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

const ISSUES: Record<string, string> = {
  VISION_NOT_CONFIGURED: 'Google Vision anahtarı sunucuda tanımlı değil (Vercel’de GOOGLE_VISION_API_KEY ekleyip yeniden yükleyin)',
  VISION_KEY_INVALID: 'Google Vision anahtarı geçersiz ya da projede Cloud Vision API veya faturalandırma açık değil',
  VISION_QUOTA: 'Google Vision kotası doldu',
  VISION_TIMEOUT: 'Google Vision zamanında yanıt vermedi',
  VISION_MONTH_FULL: 'bu ayın Google Vision hakkı doldu; ay başında yeniden açılır',
  VISION_DAY_FULL: 'bugünkü Google Vision hakkınız (30 okuma) doldu; yarın yenilenir',
  VISION_COUNTER_MISSING: 'Google Vision sayacı kurulmamış (Supabase’de 20261005_vision_quota.sql çalıştırılmalı)',
};

/**
 * The picture read by Google Vision, or why not (the in-browser reader is used then). A reading
 * kept with the question is used again while the picture is the same: no new reading is spent,
 * even when today's readings are used up. A missing key is asked once per session.
 */
export async function readWithVision(imageUrl: string, onProgress?: (progress: OCRProgress) => void,
  saved?: OCRResult['visionReading']): Promise<{ result: OCRResult } | { issue: string }> {
  const key = await imageKey(imageUrl);
  if (saved?.page?.words?.length && key && saved.key === key) {
    onProgress?.({ status: 'completed', progress: 100, message: 'Görselin daha önceki Google Vision okuması kullanıldı.' });
    return { result: { ...visionToOcr(saved.page), engine: 'vision', visionReading: saved } };
  }
  if (notConfigured) return { issue: ISSUES[skipReason] };
  onProgress?.({ status: 'recognizing', progress: 30, message: 'Soru görseli Google Vision ile okunuyor...' });
  const image = await pictureForCloud(imageUrl);
  if (!image) return { issue: 'Görsel Google Vision’a gönderilemedi (tarayıcı görseli okuyamadı)' };
  try {
    const res = await fetch('/api/vision/ocr', {
      method: 'POST',
      signal: AbortSignal.timeout(50_000),
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ image }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // Not set up, or this month's readings used up: not asked again in this session.
      if (data?.code === 'VISION_NOT_CONFIGURED' || data?.code === 'VISION_MONTH_FULL' || data?.code === 'VISION_DAY_FULL') { notConfigured = true; skipReason = data.code; }
      const issue = ISSUES[data?.code] || data?.error || `Google Vision isteği başarısız (${res.status})`;
      console.warn('Google Vision okuyamadı, tarayıcıdaki okuyucu kullanılıyor:', data?.code || res.status, data?.detail || '');
      return { issue: data?.detail ? `${issue}: ${String(data.detail).slice(0, 140)}` : issue };
    }
    if (!data?.words?.length || !data.width || !data.height) return { issue: 'Google Vision görselde yazı bulamadı' };
    onProgress?.({ status: 'completed', progress: 100, message: `${data.words.length} kelime Google Vision ile okundu.` });
    const page = pageOf(data as VisionPage);
    return { result: { ...visionToOcr(page), engine: 'vision', ...(key ? { visionReading: { key, page } } : {}) } };
  } catch {
    return { issue: ISSUES.VISION_TIMEOUT };
  }
}
