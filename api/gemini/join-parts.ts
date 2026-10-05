import { requireMember, serviceDatabase } from '../../server/auth.js';
import { joinNarrationAudio } from '../../server/mp3.js';
import { MAX_PROJECT_AUDIO_BYTES, ownedAssetPath } from '../../server/projectAudio.js';
import { saveGeneratedAudio } from './generate.js';
import { logged } from '../../server/errorLog.js';
import { readAsset, removeAssets } from '../../server/assets.js';

export const config = { maxDuration: 60 };
const MAX_PARTS = 8;

/**
 * Joins the voiced parts of a long solution (each made by /api/gemini/generate) into the one
 * narration the project uses. Only the teacher's own part files of this project are read;
 * the part files are removed once the whole narration is stored.
 */
async function handler(req: any, res: any) {
  const member = await requireMember(req, res);
  if (!member) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const parts: unknown[] = Array.isArray(req.body?.parts) ? req.body.parts : [];
  const folder = `${member.user.id}/${projectId}/`;
  const paths = parts.map(p => ownedAssetPath(member.user.id, p));
  if (!projectId || !text || parts.length < 2 || parts.length > MAX_PARTS || paths.some(p => !p || !p.startsWith(`${folder}gemini-`))) {
    return res.status(400).json({ error: 'Ses parçaları geçersiz.', code: 'INVALID_PARTS' });
  }
  const db = serviceDatabase();
  const { data: project, error: projectError } = await db.from('projects').select('id').eq('id', projectId).eq('owner_id', member.user.id).maybeSingle();
  if (projectError || !project) return res.status(403).json({ error: 'Proje erişimi doğrulanamadı.', code: 'PROJECT_ACCESS_DENIED' });

  const buffers: Buffer[] = [];
  for (const path of paths as string[]) {
    const part = await readAsset(db, path);
    if (!part) return res.status(502).json({ error: 'Ses parçalarından biri okunamadı. Seslendirmeyi yeniden deneyin.', code: 'PART_MISSING' });
    buffers.push(part.bytes);
  }
  if (buffers.reduce((n, b) => n + b.length, 0) > MAX_PROJECT_AUDIO_BYTES) return res.status(413).json({ error: 'Birleşen ses 25 MB sınırını aşıyor.', code: 'TOO_LARGE' });
  try {
    const audio = await joinNarrationAudio(buffers);
    const stored = await saveGeneratedAudio(member.user.id, projectId, text, audio.bytes, audio.extension, audio.mimeType);
    await removeAssets(db, (paths as string[]).filter(p => p !== stored.path));
    return res.status(200).json({ audioUrl: stored.signedUrl, assetPath: stored.path, mimeType: audio.mimeType });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || 'Ses parçaları birleştirilemedi.', code: 'JOIN_FAILED' });
  }
}

export default logged('/api/gemini/join-parts', handler);
