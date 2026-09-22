import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { QuestionProject, ProjectStatus } from '../../types';
import { projectRepository } from './projectRepository';
import { SAMPLE_QUESTION_IMAGE_1 } from './sampleData';
import { DEFAULT_CATEGORY_ID } from '../../config/categories';

interface ProjectContextType {
  error: string;
  projects: QuestionProject[];
  currentProject: QuestionProject | null;
  isLoading: boolean;
  activeFilter: string;
  searchQuery: string;
  setActiveFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  loadProjects: () => Promise<void>;
  selectProject: (id: string) => Promise<QuestionProject | null>;
  createNewProject: (custom?: Partial<QuestionProject>) => Promise<QuestionProject>;
  saveCurrentProject: (updates?: Partial<QuestionProject>) => Promise<QuestionProject | null>;
  updateCurrentProject: (updates: Partial<QuestionProject>) => void;
  deleteProjectById: (id: string) => Promise<boolean>;
  setCurrentProject: React.Dispatch<React.SetStateAction<QuestionProject | null>>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<QuestionProject[]>([]);
  const [currentProject, setCurrentProject] = useState<QuestionProject | null>(null);
  const projectRef=useRef(currentProject);
  projectRef.current=currentProject;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      setError('');
      const data = await projectRepository.getAll();
      setProjects(data);
    } catch (e) {
      setError('Projeler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const selectProject = useCallback(async (id: string): Promise<QuestionProject | null> => {
    setIsLoading(true);
    try {
      const proj = await projectRepository.getById(id);
      if (proj) {
        setCurrentProject(proj);
      }
      return proj;
    } catch (e) {
      console.error('Failed to get project', e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNewProject = useCallback(async (custom?: Partial<QuestionProject>): Promise<QuestionProject> => {
    const nextNum = projects.length > 0 ? Math.max(...projects.map((p) => p.questionNumber || 0)) + 1 : 1;
    const initial: Omit<QuestionProject, 'id' | 'createdAt' | 'updatedAt'> = {
      title: custom?.title || `Yeni Arapça YDT Soru Projesi #${nextNum}`,
      examYear: custom?.examYear || '2024 YDT',
      questionNumber: custom?.questionNumber || nextNum,
      category: custom?.category || DEFAULT_CATEGORY_ID,
      correctAnswer: custom?.correctAnswer || 'A',
      status: 'draft',
      audioApproved: custom?.audioApproved ?? false,
      videoReady: custom?.videoReady ?? false,
      imageUrl: custom?.imageUrl || SAMPLE_QUESTION_IMAGE_1,
      imageFileName: custom?.imageFileName || 'ornek_ydt_sorusu.png',
      arabicQuestionSnippet: custom?.arabicQuestionSnippet || '',
      solutionText:
        custom?.solutionText ||
        `Değerli öğrenciler, bu sorumuzda Arapça dil bilgisindeki temel kuralları ele alıyoruz.

Cümledeki boşluğun önü ve arkası incelendiğinde...

Seçenekler değerlendirildiğinde:
A) 
B) 
C) 
D) 
E) 

Bu sebeple doğru cevabımız ... seçeneğidir.`,
      videoConfig: {
        aspectRatio: '16:9',
        fps: 30,
        backgroundColor: '#FFFFFF',
        showWatermark: true,
        teacherTag: 'Arapça YDT Soru Çözümü',
        annotations: [],
      },
      notes: '',
      ...custom,
    };

    const created = await projectRepository.create(initial);
    setProjects((prev) => [created, ...prev]);
    setCurrentProject(created);
    return created;
  }, [projects]);

  const updateCurrentProject = useCallback((updates: Partial<QuestionProject>) => {
    setCurrentProject((prev) => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  }, []);

  const saveCurrentProject = useCallback(async (updates: Partial<QuestionProject> = {}): Promise<QuestionProject | null> => {
    if (!currentProject) return null;
    try {
      setError('');
      const snapshot = {...(projectRef.current?.id===currentProject.id?projectRef.current:currentProject),...updates};
      if(projectRef.current?.id===snapshot.id)setCurrentProject(snapshot);
      const saved = await projectRepository.save(snapshot);
      setCurrentProject(prev=>prev===snapshot ? saved : prev);
      setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proje kaydedilemedi.');
      return null;
    }
  }, [currentProject]);

  const deleteProjectById = useCallback(async (id: string): Promise<boolean> => {
    const ok = await projectRepository.delete(id);
    if (ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (currentProject?.id === id) {
        setCurrentProject(null);
      }
    }
    return ok;
  }, [currentProject]);

  return (
    <ProjectContext.Provider
      value={{
        error,
        projects,
        currentProject,
        isLoading,
        activeFilter,
        searchQuery,
        setActiveFilter,
        setSearchQuery,
        loadProjects,
        selectProject,
        createNewProject,
        saveCurrentProject,
        updateCurrentProject,
        deleteProjectById,
        setCurrentProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};
