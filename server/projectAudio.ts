/**
 * Loads a project's narration audio for server-side alignment. The project
 * JSON is written by its owner, so the stored location is untrusted: only
 * files inside the owner's own storage folder are read (the service role
 * would otherwise bypass storage RLS), and a URL is fetched only when it is a
 * signed link to that same folder on our own Supabase project.
 */
export const MAX_PROJECT_AUDIO_BYTES = 25 * 1024 * 1024;

export class ProjectAudioError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function ownedAssetPath(ownerId: string, path: unknown): string | null {
  if (typeof path !== 'string' || !ownerId) return null;
  const parts = path.split('/');
  if (parts[0] !== ownerId || parts.length < 2 || parts.some(p => !p || p === '.' || p === '..' || p.includes('\\'))) return null;
  return path;
}

/** Path of a signed Supabase Storage link to project-assets, or null for any other URL. */
export function signedLinkPath(url: string, supabaseUrl = process.env.SUPABASE_URL || ''): string | null {
  try {
    const link = new URL(url);
    const base = new URL(supabaseUrl);
    if (link.protocol !== 'https:' || link.host !== base.host) return null;
    const prefix = '/storage/v1/object/sign/project-assets/';
    return link.pathname.startsWith(prefix) ? decodeURIComponent(link.pathname.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

export async function loadProjectAudio(db: any, ownerId: string, source: any): Promise<{ bytes: Buffer; mimeType: string }> {
  const stored = source?.audioUrl;
  const mimeType = typeof source?.mimeType === 'string' && /^audio\/[\w.+-]+$/.test(source.mimeType) ? source.mimeType : 'audio/wav';
  const path = ownedAssetPath(ownerId,
    stored && typeof stored === 'object' ? stored.assetPath
      : typeof stored === 'string' ? signedLinkPath(stored) : null);
  if (!path) throw new ProjectAudioError('Zamanlama için kaydedilmiş ses dosyası bulunamadı.', 400);

  const { data, error } = await db.storage.from('project-assets').download(path);
  if (error || !data) throw new ProjectAudioError('Kaydedilmiş ses dosyası okunamadı.', 502);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (!bytes.length) throw new ProjectAudioError('Ses dosyası boş.', 400);
  if (bytes.length > MAX_PROJECT_AUDIO_BYTES) throw new ProjectAudioError('Ses dosyası 25 MB sınırını aşıyor.', 413);
  return { bytes, mimeType };
}
