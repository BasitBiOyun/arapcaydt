import { timingSafeEqual } from 'node:crypto';
import { serviceDatabase } from '../../server/auth.js';
import { logged } from '../../server/errorLog.js';

/**
 * Read-only report for the morning check (a scheduled Claude session): the last hours' problem
 * reports, browser errors, server errors and failed service requests. It is opened with the
 * MONITOR_TOKEN secret, never with a teacher's session, and returns no keys or audio.
 *   GET /api/admin/monitor?hours=24         the report
 *   GET /api/admin/monitor?feedback=<id>    one report's teşhis record
 *   GET /api/admin/monitor?project=<id>     one question (text, answer, marks, a 10-minute picture link; no audio)
 *   GET /api/admin/monitor?project=<id>&picture=1   that question's picture itself
 *   GET /api/admin/monitor?list=1           question ids with a picture (for measuring the reader)
 */
export function tokenMatches(header: unknown, token: string | undefined): boolean {
  if (!token || token.length < 24 || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7)), wanted = Buffer.from(token);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

const FAILED_SERVICES = ['gemini_tts', 'gemini_transcribe', 'elevenlabs_align', 'voice', 'client_error'];

async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.MONITOR_TOKEN) return res.status(404).json({ error: 'Not found' });
  if (!tokenMatches(req.headers.authorization, process.env.MONITOR_TOKEN)) return res.status(401).json({ error: 'Unauthorized' });
  res.setHeader('Cache-Control', 'no-store');
  const db = serviceDatabase();
  const id = (v: unknown) => typeof v === 'string' && /^[\w-]{1,80}$/.test(v) ? v : null;

  if (req.query?.feedback) {
    const { data, error } = await db.from('feedback').select('id,diagnostics').eq('id', id(req.query.feedback)).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return data ? res.status(200).json(data.diagnostics ?? null) : res.status(404).json({ error: 'Not found' });
  }
  if (req.query?.list) {
    const { data, error } = await db.from('projects').select('id,updated_at,category:data->>category,vision:data->videoConfig->visionReading->>key')
      .not('data->imageUrl', 'is', null).order('updated_at', { ascending: false }).limit(1000);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data || []).map((p: any) => ({ id: p.id, updated_at: p.updated_at, category: p.category, vision: !!p.vision })));
  }
  if (req.query?.project) {
    const { data, error } = await db.from('projects').select('id,owner_id,updated_at,image:data->imageUrl,title:data->>title,category:data->>category,solutionText:data->>solutionText,'
      + 'correctAnswer:data->>correctAnswer,narrationType:data->narrationSource->>type,words:data->narrationSource->words,'
      + 'duration:data->narrationSource->duration,videoConfig:data->videoConfig').eq('id', id(req.query.project)).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Not found' });
    // The question picture as a link that works for ten minutes (for checking how it is read).
    const path = typeof (data as any).image === 'object' ? (data as any).image?.assetPath : null;
    if (req.query?.picture && path) {
      // The picture itself (for a checker that cannot reach the storage host).
      const file = await db.storage.from('project-assets').download(path);
      if (file.error || !file.data) return res.status(404).json({ error: 'Not found' });
      res.setHeader('Content-Type', file.data.type || 'application/octet-stream');
      return res.status(200).send(Buffer.from(await file.data.arrayBuffer()));
    }
    const signed = path ? await db.storage.from('project-assets').createSignedUrl(path, 600) : null;
    return res.status(200).json({ ...(data as object), image: signed?.data?.signedUrl ?? (typeof (data as any).image === 'string' && /^https:/.test((data as any).image) ? (data as any).image : null) });
  }

  const hours = Math.min(168, Math.max(1, Number(req.query?.hours) || 24));
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  const [feedback, activity, server, profiles] = await Promise.all([
    db.from('feedback').select('id,owner_id,message,context,status,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(200),
    db.from('activity').select('owner_id,project_id,kind,state,detail,created_at').in('kind', FAILED_SERVICES).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(500),
    db.from('server_errors').select('owner_id,route,status,message,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(200),
    db.from('profiles').select('id,name'),
  ]);
  const names = Object.fromEntries((profiles.data || []).map((p: any) => [p.id, p.name || 'Öğretmen']));
  const failures = (activity.data || []).filter((a: any) => a.kind === 'client_error' || a.state === 'failed');
  return res.status(200).json({
    since, hours, names,
    feedback: feedback.error ? { unavailable: feedback.error.message } : feedback.data,
    browserErrors: failures.filter((a: any) => a.kind === 'client_error'),
    requestFailures: failures.filter((a: any) => a.kind !== 'client_error'),
    serverErrors: server.error ? { unavailable: server.error.message } : server.data,
  });
}

export default logged('/api/admin/monitor', handler);
