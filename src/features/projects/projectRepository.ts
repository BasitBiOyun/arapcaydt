import { QuestionProject } from '../../types';
import { INITIAL_PROJECTS } from './sampleData';

const STORAGE_KEY = 'arabic_ydt_teacher_projects_v2';
const LEGACY_STORAGE_KEY = 'arabic_ydt_teacher_projects_v1';

function sanitizeImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('Telif%20Haklar%C4%B1%20Sakl%C4%B1d%C4%B1r') || url.includes('Telif Hakları Saklıdır') || url.includes('Soru İnceleme Kütüphanesi')) {
    try {
      const decoded = decodeURIComponent(url.replace(/^data:image\/svg\+xml;utf8,/, ''));
      const cleaned = decoded.replace(/<text[^>]*>[^<]*?(?:Telif Hakları Saklıdır|Soru İnceleme Kütüphanesi)[^<]*?<\/text>/gi, '');
      return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
    } catch {
      return url;
    }
  }
  return url;
}

export interface IProjectRepository {
  getAll(): Promise<QuestionProject[]>;
  getById(id: string): Promise<QuestionProject | null>;
  save(project: QuestionProject): Promise<QuestionProject>;
  delete(id: string): Promise<boolean>;
  create(project: Omit<QuestionProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuestionProject>;
}

export class LocalStorageProjectRepository implements IProjectRepository {
  private getStorageData(): QuestionProject[] {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Check if legacy key exists to migrate smoothly
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          raw = legacyRaw;
        } else {
          // Seed initial clean data
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
          return INITIAL_PROJECTS;
        }
      }

      const projects: QuestionProject[] = JSON.parse(raw);
      let hasChanges = false;

      // Ensure no project contains the unwanted copyright text
      const sanitized = projects.map((p) => {
        if (p.imageUrl) {
          const cleanUrl = sanitizeImageUrl(p.imageUrl);
          if (cleanUrl !== p.imageUrl) {
            hasChanges = true;
            return { ...p, imageUrl: cleanUrl };
          }
        }
        return p;
      });

      if (hasChanges || !localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      }

      return sanitized;
    } catch (e) {
      console.error('Error reading projects from storage:', e);
      return INITIAL_PROJECTS;
    }
  }

  private setStorageData(projects: QuestionProject[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Error writing projects to storage:', e);
    }
  }

  public async getAll(): Promise<QuestionProject[]> {
    const list = this.getStorageData();
    // sort by updatedAt descending
    return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async getById(id: string): Promise<QuestionProject | null> {
    const list = this.getStorageData();
    return list.find((p) => p.id === id) || null;
  }

  public async save(project: QuestionProject): Promise<QuestionProject> {
    const list = this.getStorageData();
    const updated = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    const index = list.findIndex((p) => p.id === project.id);

    if (index >= 0) {
      list[index] = updated;
    } else {
      list.unshift(updated);
    }

    this.setStorageData(list);
    return updated;
  }

  public async create(data: Omit<QuestionProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuestionProject> {
    const list = this.getStorageData();
    const newProject: QuestionProject = {
      ...data,
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    list.unshift(newProject);
    this.setStorageData(list);
    return newProject;
  }

  public async delete(id: string): Promise<boolean> {
    const list = this.getStorageData();
    const filtered = list.filter((p) => p.id !== id);
    if (filtered.length !== list.length) {
      this.setStorageData(filtered);
      return true;
    }
    return false;
  }
}

export const projectRepository = new LocalStorageProjectRepository();
