import { CloudProjectRepository } from './cloudProjectRepository';
import type { ProjectSummary, QuestionProject } from '../../types';

export interface IProjectRepository {
  /** Full projects (backup/export only; heavy). */
  getAll(): Promise<QuestionProject[]>;
  /** What lists show; open a project with getById. */
  getSummaries(): Promise<ProjectSummary[]>;
  getById(id: string): Promise<QuestionProject | null>;
  save(project: QuestionProject): Promise<QuestionProject>;
  /** Deletes for good, with its files (the recycle bin uses setDeleted first). */
  delete(id: string): Promise<boolean>;
  /** Moves a question to the recycle bin (a date) or back out of it (null). */
  setDeleted(id: string, deletedAt: string | null): Promise<boolean>;
  create(project: Omit<QuestionProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuestionProject>;
}

export const projectRepository: IProjectRepository = new CloudProjectRepository();
