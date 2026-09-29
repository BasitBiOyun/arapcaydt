import type { AppPage } from '../components/common/AppSidebar';

/** Readable addresses for the studio's pages, so a reload or a bookmark returns to the same place. */
const PATHS: Record<Exclude<AppPage, 'editor'>, string> = {
  dashboard: '', questions: 'sorular', batch: 'toplu', settings: 'ayarlar', admin: 'yonetim',
};

/** The address of a page; the editor's address names its question. */
export function pageHash(page: AppPage, projectId?: string | null): string {
  if (page === 'editor') return projectId ? `#/soru/${encodeURIComponent(projectId)}` : '#/soru';
  return `#/${PATHS[page]}`;
}

/** The page (and question) an address points to; unknown addresses open the dashboard. */
export function parseHash(hash: string): { page: AppPage; projectId?: string } {
  const path = hash.replace(/^#\/?/, '').split(/[?&]/)[0];
  const [first, second] = path.split('/');
  if (first === 'soru') return { page: 'editor', ...(second ? { projectId: decodeURIComponent(second) } : {}) };
  const page = (Object.keys(PATHS) as Array<keyof typeof PATHS>).find(key => PATHS[key] === first);
  return { page: page ?? 'dashboard' };
}
