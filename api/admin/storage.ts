import { logged } from '../../server/errorLog.js';
import { requireMember, serviceDatabase } from '../../server/auth.js';
import { encodeMp3, pcmFromWav } from '../../server/mp3.js';
import {
  convertibleAudio, orphans, referencedPaths, summarizeStorage, type ProjectAssetRow, type StoredObject,
} from '../../server/storage.js';

export const config = { maxDuration: 60 };

/** WAV narrations converted per request (download + encode + upload each). */
export const CONVERT_BATCH = 3;

const PROJECT_FIELDS = [
  'id', 'owner_id', 'image:data->imageUrl',
  'nsAudio:data->narrationSource->audioUrl', 'nsPath:data->narrationSource->assetPath',
  'anAudio:data->audioNarration->audioUrl', 'anPath:data->audioNarration->assetPath',
].join(',');

async function readObjects(db: any): Promise<StoredObject[] | null> {
  const all: StoredObject[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.rpc('project_asset_objects').range(from, from + 999);
    if (error) return null;
    all.push(...(data || []).map((o: any) => ({ ...o, bytes: Number(o.bytes) || 0 })));
    if ((data || []).length < 1000) break;
  }
  return all;
}

async function readProjects(db: any): Promise<ProjectAssetRow[]> {
  const all: ProjectAssetRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('projects').select(PROJECT_FIELDS).order('id').range(from, from + 999);
    if (error) throw error;
    all.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return all;
}

async function convert(db: any, item: { projectId: string; path: string }): Promise<string | null> {
  const bucket = db.storage.from('project-assets');
  const { data, error } = await bucket.download(item.path);
  if (error || !data) return 'WAV okunamadı';
  const pcm = pcmFromWav(Buffer.from(await data.arrayBuffer()));
  if (!pcm?.samples.length) return 'WAV biçimi desteklenmiyor';
  const mp3 = await encodeMp3(pcm);
  const mp3Path = item.path.replace(/\.wav$/i, '') + '.mp3';
  const { error: uploadError } = await bucket.upload(mp3Path, mp3, { contentType: 'audio/mpeg', upsert: true });
  if (uploadError) return `MP3 kaydedilemedi: ${uploadError.message}`;
  const { data: replaced, error: rpcError } = await db.rpc('replace_project_audio',
    { target_project: item.projectId, old_path: item.path, new_path: mp3Path, new_mime: 'audio/mpeg' });
  if (rpcError) return `Proje güncellenemedi: ${rpcError.message}`;
  // false: the project no longer points at this WAV (edited meanwhile); the MP3 is swept later.
  return replaced ? null : 'Proje bu arada değişmiş';
}

async function remove(db: any, names: string[]): Promise<number> {
  let removed = 0;
  for (let i = 0; i < names.length; i += 100) {
    const { data, error } = await db.storage.from('project-assets').remove(names.slice(i, i + 100));
    if (error) throw error;
    removed += (data || []).length;
  }
  return removed;
}

/**
 * Admin storage housekeeping: GET usage; POST {action:'convert'} turns up to
 * CONVERT_BATCH WAV narrations into MP3 (timings unchanged); POST
 * {action:'sweep', scope:'wav'|'all'} deletes files no project uses.
 */
async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const member = await requireMember(req, res);
  if (!member) return;
  if (member.profile?.role !== 'admin') return res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });

  try {
    const db = serviceDatabase();
    const [objects, rows] = await Promise.all([readObjects(db), readProjects(db)]);
    if (!objects) return res.status(200).json({ migrationPending: true });

    if (req.method === 'POST' && req.body?.action === 'convert') {
      const pending = convertibleAudio(rows, objects);
      const skip = new Set<string>(Array.isArray(req.body?.skip) ? req.body.skip.filter((s: unknown) => typeof s === 'string') : []);
      const open = pending.filter(p => !skip.has(p.path));
      const batch = open.slice(0, CONVERT_BATCH);
      const failures: Array<{ path: string; reason: string }> = [];
      let converted = 0;
      for (const item of batch) {
        const reason = await convert(db, item).catch((e: any) => e?.message || 'Bilinmeyen hata');
        if (reason) failures.push({ path: item.path, reason }); else converted++;
      }
      return res.status(200).json({ converted, failures, remaining: open.length - batch.length });
    }

    if (req.method === 'POST' && req.body?.action === 'sweep') {
      const unused = orphans(objects, referencedPaths(rows));
      const targets = req.body?.scope === 'all' ? unused : unused.filter(o => /\.wav$/i.test(o.name));
      const removed = await remove(db, targets.map(o => o.name));
      return res.status(200).json({ removed, bytes: targets.reduce((s, o) => s + o.bytes, 0) });
    }

    return res.status(200).json({ migrationPending: false, ...summarizeStorage(objects, rows) });
  } catch (error: any) {
    console.error('[Admin storage]', error?.message || error);
    return res.status(500).json({ error: 'Depolama bilgisi hazırlanamadı.' });
  }
}

export default logged('/api/admin/storage', handler);
