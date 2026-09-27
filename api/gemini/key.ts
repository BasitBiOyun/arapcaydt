import { requireMember, serviceDatabase } from '../../server/auth.js';
import {
  GEMINI_TTS_MODELS, encryptKey, isCapped, keyStorageReady,
  normalizeApiKey, readDailyState,
} from '../../server/quota.js';

export const config = { maxDuration: 30 };

/** Google AI Studio keys look like "AIza" + 35 URL-safe characters. */
export const isGoogleKeyShape = (key: string) => /^AIza[0-9A-Za-z_-]{35}$/.test(key);

/**
 * The signed-in teacher's own Google AI Studio key: GET status and today's
 * usage, POST {apiKey} to verify and save it, DELETE to remove it. The key is
 * encrypted on the server and never sent back to any browser; only its last
 * four characters are shown.
 */
export default async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = serviceDatabase();
  const ownerId = member.user.id;

  if (req.method === 'POST') {
    if (!keyStorageReady()) {
      return res.status(503).json({ error: 'Anahtar kaydı henüz açılmadı. Yöneticinin sunucu ayarını tamamlaması gerekiyor.', code: 'KEY_STORAGE_NOT_CONFIGURED' });
    }
    const apiKey = normalizeApiKey(typeof req.body?.apiKey === 'string' ? req.body.apiKey : '');
    if (!isGoogleKeyShape(apiKey)) {
      return res.status(400).json({ error: 'Bu bir Google AI Studio anahtarına benzemiyor. Anahtar "AIza" ile başlar ve 39 karakterdir.', code: 'INVALID_KEY_FORMAT' });
    }
    // Listing models is free and does not use any generation quota.
    let check: Response;
    try {
      check = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
        headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(15000),
      });
    } catch {
      return res.status(502).json({ error: 'Google’a ulaşılamadı; biraz sonra tekrar deneyin.', code: 'GOOGLE_UNREACHABLE' });
    }
    if (!check.ok) {
      return res.status(400).json({ error: 'Google bu anahtarı kabul etmedi. Anahtarı AI Studio’dan yeniden kopyalayın.', code: 'KEY_REJECTED' });
    }
    const { error } = await db.from('teacher_gemini_keys').upsert({
      owner_id: ownerId, ciphertext: encryptKey(apiKey), last4: apiKey.slice(-4), status: 'active', updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id' });
    if (error) {
      console.error('[Teacher key save]', error.message);
      return res.status(503).json({ error: 'Anahtar kaydedilemedi. Veritabanı güncellemesi bekleniyor olabilir.', code: 'KEY_SAVE_FAILED' });
    }
  }

  if (req.method === 'DELETE') {
    const { error } = await db.from('teacher_gemini_keys').delete().eq('owner_id', ownerId);
    if (error) return res.status(503).json({ error: 'Anahtar kaldırılamadı.', code: 'KEY_DELETE_FAILED' });
  }

  const [{ data: row }, today] = await Promise.all([
    db.from('teacher_gemini_keys').select('last4,status,updated_at').eq('owner_id', ownerId).maybeSingle()
      .then((r: any) => r, () => ({ data: null })),
    readDailyState(db, ownerId),
  ]);
  const capped = isCapped(member);
  return res.status(200).json({
    storageReady: keyStorageReady(),
    key: row ? { last4: row.last4, status: row.status, updatedAt: row.updated_at } : null,
    today: {
      tracking: today.tracking,
      tts: { used: today.own.ttsUsed, exhaustedModels: today.own.ttsExhausted.length, models: GEMINI_TTS_MODELS.length },
      transcribe: { used: today.own.transcribeUsed, exhausted: today.own.transcribeExhausted },
      shared: { used: today.shared.transcribeUsed, limit: capped ? today.limits.sharedTranscribe : null, exhausted: today.shared.transcribeExhausted },
      elevenlabs: { used: today.elevenlabsAlignUsed, limit: capped ? today.limits.elevenlabsAlign : null },
    },
  });
}
