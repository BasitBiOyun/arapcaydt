import { CloudProjectRepository } from './cloudProjectRepository';
import type { ProjectSummary, QuestionProject } from '../../types';

export interface IProjectRepository {
  /** Full projects (backup/export only; heavy). */
  getAll(): Promise<QuestionProject[]>;
  /** What lists show; open a project with getById. */
  getSummaries(): Promise<ProjectSummary[]>;
  getById(id: string): Promise<QuestionProject | null>;
  save(project: QuestionProject): Promise<QuestionProject>;
  delete(id: string): Promise<boolean>;
  create(project: Omit<QuestionProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuestionProject>;
}

export const projectRepository: IProjectRepository = new CloudProjectRepository();
