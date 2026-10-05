import type { QuestionProject } from '../../types';
import { createZip, readZip, zipSafeName, type ZipEntry } from '../../services/zip';

/**
 * Backups are one ZIP: `soru-yedegi.json` (every question, file links replaced by names inside the ZIP)
 * plus the question images and narrations themselves, so a backup still works after the links expire.
 */
export const BACKUP_MANIFEST = 'soru-yedegi.json';
const FORMAT = 'soru-studyosu-yedek';

interface ZipFileRef { zipFile: string }
type AudioKey = 'narrationSource' | 'audioNarration';
const AUDIO_KEYS: AudioKey[] = ['narrationSource', 'audioNarration'];

const extension = (type: string, fallback: string) =>
  ({ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' } as Record<string, string>)[type.split(';')[0]] || fallback;

/** Files are fetched (signed links, data or blob URLs); inline SVG samples stay inside the JSON. */
const needsFile = (url: unknown): url is string => typeof url === 'string' && !!url && !url.startsWith('data:image/svg+xml');

export interface BackupProgress { done: number; total: number }

/** Builds the backup ZIP of the given full projects. `fetchFile` reads a stored file (tests pass a stub). */
export async function buildBackup(
  projects: QuestionProject[],
  fetchFile: (url: string) => Promise<Blob> = async url => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Bir dosya indirilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    return response.blob();
  },
  onProgress?: (progress: BackupProgress) => void,
  now = new Date(),
): Promise<Blob> {
  const entries: ZipEntry[] = [];
  const saved: unknown[] = [];
  for (const [index, project] of projects.entries()) {
    const copy: any = structuredClone(project);
    delete copy.ownerId;
    delete copy.renderedVideoUrl;
    const folder = `dosyalar/${zipSafeName(project.id)}`;
    const byUrl = new Map<string, string>();
    const store = async (url: string, base: string, fallback: string): Promise<ZipFileRef> => {
      if (!byUrl.has(url)) {
        const blob = await fetchFile(url);
        const name = `${folder}/${base}.${extension(blob.type, fallback)}`;
        entries.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        byUrl.set(url, name);
      }
      return { zipFile: byUrl.get(url)! };
    };
    if (needsFile(copy.imageUrl)) copy.imageUrl = await store(copy.imageUrl, 'soru-gorseli', 'webp');
    for (const key of AUDIO_KEYS) {
      const audio = copy[key];
      if (!audio) continue;
      delete audio.audioBase64;
      delete audio.assetPath;
      if (needsFile(audio.audioUrl)) audio.audioUrl = await store(audio.audioUrl, key === 'narrationSource' ? 'seslendirme' : 'seslendirme-eski', 'mp3');
    }
    saved.push(copy);
    onProgress?.({ done: index + 1, total: projects.length });
  }
  const manifest = { format: FORMAT, version: 1, exportedAt: now.toISOString(), questionCount: saved.length, projects: saved };
  entries.unshift({ name: BACKUP_MANIFEST, data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
  return createZip(entries, now);
}

const MIME: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4' };

/**
 * The questions inside a backup ZIP, with their files as local links (`makeUrl`, blob URLs in the browser)
 * ready to be saved as new questions. Throws a Turkish message for a file that is not a studio backup.
 */
export async function readBackup(
  buffer: ArrayBuffer,
  makeUrl: (blob: Blob) => string = blob => URL.createObjectURL(blob),
): Promise<QuestionProject[]> {
  const entries = await readZip(buffer);
  const files = new Map(entries.map(e => [e.name, e.data]));
  const manifestBytes = files.get(BACKUP_MANIFEST);
  if (!manifestBytes) throw new Error('Bu ZIP bir Soru Stüdyosu yedeği değil (soru-yedegi.json bulunamadı).');
  let manifest: any;
  try { manifest = JSON.parse(new TextDecoder().decode(manifestBytes)); } catch { throw new Error('Yedek dosyası okunamadı.'); }
  if (manifest?.format !== FORMAT || !Array.isArray(manifest.projects)) throw new Error('Bu ZIP bir Soru Stüdyosu yedeği değil.');
  const link = (ref: unknown): string => {
    if (typeof ref === 'string') return ref;
    const name = (ref as ZipFileRef | null)?.zipFile;
    const data = name ? files.get(name) : undefined;
    if (!name || !data) throw new Error('Yedekte bir dosya eksik. ZIP dosyası bozulmuş olabilir.');
    return makeUrl(new Blob([data as Uint8Array<ArrayBuffer>], { type: MIME[name.split('.').pop() || ''] || 'application/octet-stream' }));
  };
  return manifest.projects.map((raw: any) => {
    const p = structuredClone(raw);
    if (typeof p?.id !== 'string' || !p.videoConfig) throw new Error('Yedekteki bir soru okunamadı.');
    p.imageUrl = p.imageUrl ? link(p.imageUrl) : '';
    for (const key of AUDIO_KEYS) if (p[key]?.audioUrl) p[key].audioUrl = link(p[key].audioUrl);
    delete p.deletedAt;
    delete p.ownerId;
    return p as QuestionProject;
  });
}

/** A backup's file name, e.g. `soru-yedegi-2026-09-29.zip`. */
export const backupFileName = (now = new Date(), label = '') =>
  `soru-yedegi${label ? `-${zipSafeName(label).replace(/ /g, '-')}` : ''}-${now.toISOString().slice(0, 10)}.zip`;
