import { requireMember, serviceDatabase } from '../../server/auth.js';
import { logged } from '../../server/errorLog.js';

/**
 * Reads a question picture with Google Cloud Vision (document text detection), which reads
 * printed Arabic far better than the in-browser reader. The key stays on the server
 * (GOOGLE_VISION_API_KEY); the picture comes from the signed-in teacher's browser.
 */
export const config = { maxDuration: 60 };

/** A picture larger than this (base64) is refused; the studio sends at most 2400 px JPEG. */
const MAX_IMAGE_CHARS = 6_000_000;
const TIMEOUT_MS = 40_000;
/**
 * Readings allowed per calendar month (Google's first 1000 are free). At the limit the studio
 * reads with the in-browser reader; the count is kept in Supabase (reserve_vision).
 */
/** Readings a teacher may use per day (Türkiye day); admins have no daily limit. */
export const dailyLimit = () => {
  const value = Number(process.env.VISION_DAILY_PER_TEACHER);
  return Number.isInteger(value) && value >= 0 ? value : 30;
};
export const monthlyLimit = () => {
  const value = Number(process.env.VISION_MONTHLY_LIMIT);
  return Number.isInteger(value) && value >= 0 ? value : 950;
};

export interface VisionWord { text: string; confidence: number; x: number; y: number; width: number; height: number }
export interface VisionPage { width: number; height: number; words: VisionWord[]; lines: number[][]; text: string }

const BREAKS_LINE = new Set(['LINE_BREAK', 'EOL_SURE_SPACE', 'HYPHEN']);

/** Words (with pixel boxes) and printed lines from a Vision `fullTextAnnotation`. */
export function visionPage(annotation: any): VisionPage | null {
  const page = annotation?.pages?.[0];
  if (!page?.width || !page?.height) return null;
  const words: VisionWord[] = [];
  const lines: number[][] = [];
  let line: number[] = [];
  for (const block of page.blocks || []) for (const paragraph of block.paragraphs || []) {
    for (const word of paragraph.words || []) {
      const symbols = word.symbols || [];
      const text = symbols.map((s: any) => s.text || '').join('');
      const points = (word.boundingBox?.vertices || []).map((v: any) => ({ x: v.x || 0, y: v.y || 0 }));
      if (!text.trim() || !points.length) continue;
      const left = Math.min(...points.map((p: any) => p.x)), right = Math.max(...points.map((p: any) => p.x));
      const top = Math.min(...points.map((p: any) => p.y)), bottom = Math.max(...points.map((p: any) => p.y));
      line.push(words.length);
      words.push({ text, confidence: Math.round((word.confidence ?? .9) * 100), x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) });
      const lastBreak = symbols[symbols.length - 1]?.property?.detectedBreak?.type;
      if (BREAKS_LINE.has(lastBreak)) { lines.push(line); line = []; }
    }
    if (line.length) { lines.push(line); line = []; }
  }
  return { width: page.width, height: page.height, words, lines, text: annotation.text || '' };
}

/** A failure Google clears by itself in a moment: busy (429/503) or a per-image "resource exhausted". */
export function passingFailure(status: number, data: any): boolean {
  const error = data?.responses?.[0]?.error;
  if (status === 429 || status === 503) return true;
  return !!error && (error.code === 8 || error.code === 14 || /exhausted|unavailable/i.test(String(error.message || '')));
}

async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!key) return res.status(503).json({ error: 'Google Vision ayarlı değil.', code: 'VISION_NOT_CONFIGURED' });
  const image = typeof req.body?.image === 'string' ? req.body.image.replace(/^data:image\/\w+;base64,/, '') : '';
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=\s]+$/.test(image.slice(0, 200)))
    return res.status(400).json({ error: 'Görsel okunamadı.', code: 'INVALID_IMAGE' });

  // Count first: never more readings in a month than the limit, even with many teachers at once.
  try {
    const db = serviceDatabase();
    const daily = member.profile?.role === 'admin' ? null : dailyLimit();
    let { data: used, error } = await db.rpc('reserve_vision', { p_owner: member.user.id, p_limit: monthlyLimit(), p_daily: daily });
    // Before 20261006_vision_daily_client_errors.sql: the monthly limit only.
    if (error) ({ data: used, error } = await db.rpc('reserve_vision', { p_owner: member.user.id, p_limit: monthlyLimit() }));
    if (error) return res.status(503).json({ error: 'Google Vision sayacı kurulmamış.', code: 'VISION_COUNTER_MISSING' });
    if (used === -1) return res.status(429).json({ error: 'Bu ayın Google Vision hakkı doldu.', code: 'VISION_MONTH_FULL', limit: monthlyLimit() });
    if (used === -2) return res.status(429).json({ error: 'Bugünkü Google Vision hakkınız doldu.', code: 'VISION_DAY_FULL', limit: daily });
  } catch {
    return res.status(503).json({ error: 'Google Vision sayacına ulaşılamadı.', code: 'VISION_COUNTER_MISSING' });
  }

  // Google sometimes answers an image with a passing "Resource has been exhausted" (inside a 200
  // answer, so its console shows no error): asked again after a short wait it reads the image.
  let response!: Response;
  let data: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, attempt * 1500));
    try {
      response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{
          image: { content: image },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['ar', 'tr', 'en'] },
        }] }),
      });
    } catch {
      return res.status(504).json({ error: 'Google Vision zamanında yanıt vermedi.', code: 'VISION_TIMEOUT' });
    }
    data = await response.json().catch(() => null);
    if (!passingFailure(response.status, data)) break;
  }
  if (!response.ok || data?.responses?.[0]?.error) {
    const status = response.status, message = String(data?.error?.message || data?.responses?.[0]?.error?.message || '');
    const code = status === 429 || /quota|rate/i.test(message) ? 'VISION_QUOTA'
      : status === 400 && /API key/i.test(message) || status === 403 ? 'VISION_KEY_INVALID' : 'VISION_FAILED';
    // The key is never echoed back; Google's message does not contain it.
    return res.status(502).json({ error: 'Google Vision görseli okuyamadı.', code, detail: message.slice(0, 200) });
  }
  const page = visionPage(data?.responses?.[0]?.fullTextAnnotation);
  if (!page || !page.words.length) return res.status(200).json({ width: 0, height: 0, words: [], lines: [], text: '' });
  return res.status(200).json(page);
}

export default logged('/api/vision/ocr', handler);
