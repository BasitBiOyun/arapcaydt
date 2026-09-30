import { elevenLabsAlignAllowed, isCapped, readDailyState, usageDetail } from '../../server/quota.js';
import { recordUsage } from '../../server/usage.js';
import { ProjectAudioError, loadProjectAudio } from '../../server/projectAudio.js';
import { requireMember, serviceDatabase } from '../../server/auth.js';
import { logged } from '../../server/errorLog.js';

export const config = { maxDuration: 120 };

function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
  return key;
}

async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = normalizeApiKey(process.env.ELEVENLABS_API_KEY);
  if (!apiKey || apiKey === 'MY_ELEVENLABS_API_KEY') {
    return res.status(503).json({ error: 'ElevenLabs Forced Alignment yapılandırılmamış.', code: 'MISSING_ELEVENLABS_API_KEY' });
  }

  const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
  if (!projectId) return res.status(400).json({ error: 'Proje kimliği gerekli.' });

  const db = serviceDatabase();
  const { data: row, error: projectError } = await db
    .from('projects')
    .select('owner_id,data')
    .eq('id', projectId)
    .eq('owner_id', member.user.id)
    .maybeSingle();

  if (projectError || !row) return res.status(404).json({ error: 'Proje bulunamadı.' });

  const source = row.data?.narrationSource;
  const text = typeof row.data?.solutionText === 'string' ? row.data.solutionText.trim() : '';
  // Generated voices and the teacher's own recordings, once stored with the project.
  if (!source || !['gemini', 'uploaded'].includes(source.type)) {
    return res.status(400).json({ error: 'Bu proje için kayıtlı bir ses bulunamadı.' });
  }
  if (!text) return res.status(400).json({ error: 'Forced Alignment için çözüm metni bulunamadı.' });

  // Per-teacher daily cap on the shared ElevenLabs credits; the caller falls back to local Whisper.
  const today = await readDailyState(db, member.user.id);
  if (!elevenLabsAlignAllowed(today, isCapped(member))) {
    return res.status(429).json({ error: `Bugünkü ElevenLabs hizalama hakkınız doldu (günlük ${today.limits.elevenlabsAlign}).`, code: 'DAILY_LIMIT' });
  }

  // Every Forced Alignment request is counted, including failures (admin usage view).
  let alignmentRequested = false;
  const countAlignment = (state: 'succeeded' | 'failed', status: number | string, reason = '') => recordUsage(member.user.id, projectId,
    [{ kind: 'elevenlabs_align', state, detail: usageDetail('forced-alignment', status, false, '', reason), characters: text.length }]);
  try {
    let bytes: Buffer, mimeType: string;
    try {
      ({ bytes, mimeType } = await loadProjectAudio(db, member.user.id, source));
    } catch (error: any) {
      if (error instanceof ProjectAudioError) return res.status(error.status).json({ error: error.message });
      throw error;
    }

    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mimeType }), mimeType.includes('wav') ? 'narration.wav' : 'narration.mp3');
    form.append('text', text);

    alignmentRequested = true;
    const upstream = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
      method: 'POST',
      signal: AbortSignal.timeout(100000),
      headers: { 'xi-api-key': apiKey },
      body: form,
    });

    const raw = await upstream.text();
    alignmentRequested = false;
    let detail = '';
    if (!upstream.ok) {
      try {
        const parsed = JSON.parse(raw);
        detail = String(parsed?.detail?.message || parsed?.detail?.status || parsed?.message || '');
      } catch {
        detail = raw.slice(0, 240);
      }
    }
    await countAlignment(upstream.ok ? 'succeeded' : 'failed', upstream.status, detail);
    if (!upstream.ok) {
      console.warn('[ElevenLabs Forced Alignment]', upstream.status, detail);
      return res.status(upstream.status).json({
        error: detail || `ElevenLabs Forced Alignment hata döndürdü (HTTP ${upstream.status}).`,
        code: 'ELEVENLABS_ALIGNMENT_ERROR',
        upstreamStatus: upstream.status,
      });
    }

    const result: any = JSON.parse(raw);
    const words = (Array.isArray(result?.words) ? result.words : [])
      .filter((word: any) =>
        typeof word?.text === 'string' &&
        word.text.trim() &&
        Number.isFinite(word.start) &&
        Number.isFinite(word.end)
      )
      .map((word: any) => ({
        text: word.text.trim(),
        start: Number(word.start.toFixed(3)),
        end: Number(Math.max(word.start, word.end).toFixed(3)),
        ...(Number.isFinite(word.loss) ? { loss: Number(word.loss.toFixed(3)) } : {}),
      }));

    if (!words.length) {
      return res.status(502).json({ error: 'ElevenLabs Forced Alignment kelime zaman damgası döndürmedi.', code: 'EMPTY_ALIGNMENT' });
    }

    return res.status(200).json({
      words,
      timingSource: 'forced-alignment',
      loss: Number.isFinite(result?.loss) ? Number(result.loss.toFixed(4)) : null,
    });
  } catch (error: any) {
    if (alignmentRequested) await countAlignment('failed', 'network', error?.message);
    console.error('[ElevenLabs Forced Alignment project]', error?.message || error);
    return res.status(502).json({ error: error?.message || 'ElevenLabs Forced Alignment servisine ulaşılamadı.' });
  }
}

export default logged('/api/elevenlabs/align-project', handler);
