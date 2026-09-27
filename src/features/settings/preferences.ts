import { QUESTION_CATEGORIES } from '../../config/categories';
import type { QuestionProject, VideoConfig } from '../../types';

/** A teacher's own defaults for new questions and videos (profiles.preferences). */
export interface UserPreferences {
  category?: string;
  examName?: string;
  examYear?: string;
  showCaptions?: boolean;
  captionY?: number;
  showOutro?: boolean;
}

const text = (value: unknown, max: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

/** Keeps only known, well-formed fields; anything else in the stored JSON is dropped. */
export function cleanPreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const prefs: UserPreferences = {};
  if (typeof r.category === 'string' && QUESTION_CATEGORIES.some(c => c.id === r.category)) prefs.category = r.category;
  const examName = text(r.examName, 120); if (examName) prefs.examName = examName;
  const examYear = text(r.examYear, 40); if (examYear) prefs.examYear = examYear;
  if (typeof r.showCaptions === 'boolean') prefs.showCaptions = r.showCaptions;
  if (typeof r.captionY === 'number' && Number.isFinite(r.captionY)) prefs.captionY = Math.min(.93, Math.max(.08, r.captionY));
  if (typeof r.showOutro === 'boolean') prefs.showOutro = r.showOutro;
  return prefs;
}

/** Project fields a new question starts with; explicit values from the caller still win. */
export function newProjectDefaults(prefs: UserPreferences = {}): Pick<Partial<QuestionProject>, 'category' | 'examName' | 'examYear'> & { video: Partial<VideoConfig> } {
  const video: Partial<VideoConfig> = {};
  if (prefs.showCaptions !== undefined) video.showCaptions = prefs.showCaptions;
  if (prefs.captionY !== undefined) video.captionY = prefs.captionY;
  if (prefs.showOutro !== undefined) video.showOutro = prefs.showOutro;
  return { category: prefs.category, examName: prefs.examName, examYear: prefs.examYear, video };
}
