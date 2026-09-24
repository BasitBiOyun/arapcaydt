import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { QuestionProject, ProjectStatus } from '../../types';
import { projectRepository } from './projectRepository';
import {useAuth} from '../auth/AuthContext';
import {draftStore} from './draftStore';
import {createSaveQueue} from './saveQueue';
import { DEFAULT_CATEGORY_ID } from '../../config/categories';

interface ProjectContextType {
  error: string;
  saveStatus: 'saved' | 'pending' | 'saving' | 'error';
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

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {user}=useAuth();
  const owner=user?.id || '';
  const [error, setError] = useState('');
  const [saveStatus,setSaveStatus]=useState<'saved'|'pending'|'saving'|'error'>('saved');
  const confirmed=useRef(new Map<string,string>());
  const enqueue=useRef(createSaveQueue<QuestionProject>(p=>projectRepository.save(p)));
  const localWrites=useRef(Promise.resolve<unknown>(undefined));
  const [projects, setProjects] = useState<QuestionProject[]>([]);
  const [currentProject, setCurrentProject] = useState<QuestionProject | null>(null);
  const projectRef=useRef(currentProject);
  projectRef.current=currentProject;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const updateCurrentProject = useCallback((updates: Partial<QuestionProject>) => {
    const previous=projectRef.current;if(!previous)return;
    const next={...previous,...updates,updatedAt:new Date().toISOString()};
    projectRef.current=next;setCurrentProject(next);setSaveStatus('pending');
  }, []);

  const saveCurrentProject = useCallback(async (updates: Partial<QuestionProject> = {}): Promise<QuestionProject | null> => {
    const previous=projectRef.current;if(!previous)return null;
    const snapshot=Object.keys(updates).length?{...previous,...updates,updatedAt:new Date().toISOString()}:previous;
    projectRef.current=snapshot;setCurrentProject(snapshot);setSaveStatus('saving');
    try {
      const saved=await enqueue.current(snapshot);
      confirmed.current.set(saved.id,JSON.stringify(saved));
      if(projectRef.current===snapshot){projectRef.current=saved;setCurrentProject(saved);setSaveStatus('saved');setError('');}
      setProjects(prev=>prev.map(p=>p.id===saved.id?saved:p).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
      // Removal follows all pending local writes and only clears this revision.
      localWrites.current=localWrites.current.catch(()=>undefined).then(async()=>{
        const draft=await draftStore.get(owner,snapshot.id);
        if(draft && JSON.stringify(draft)===JSON.stringify(snapshot))await draftStore.remove(owner,snapshot.id);
      }).catch(()=>undefined);
      return saved;
    } catch(e) {
      setSaveStatus('error');setError(e instanceof Error?e.message:'Proje kaydedilemedi. Tekrar deneyin.');return null;
    }
  }, [owner]);

  const flush=useCallback(async()=>{const p=projectRef.current;return !p||confirmed.current.get(p.id)===JSON.stringify(p)||!!await saveCurrentProject();},[saveCurrentProject]);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      setError('');
      const data = await projectRepository.getAll();
      for(const p of data)confirmed.current.set(p.id,JSON.stringify(p));
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
    if(!await flush())return null;
    setIsLoading(true);
    try {
      await localWrites.current;
      const proj = await projectRepository.getById(id);
      if (proj) {
        confirmed.current.set(proj.id,JSON.stringify(proj));
        const draft=await draftStore.get(owner,proj.id).catch(()=>undefined);
        const restored=draft || proj;
        projectRef.current=restored;setCurrentProject(restored);
        setSaveStatus(restored===draft?'pending':'saved');setError('');
        if(restored===draft)setError('Kaydedilemeyen son değişiklikleriniz bu cihazdan geri yüklendi.');
      }
      return proj;
    } catch (e) {
      setError('Proje açılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [owner,flush]);

  const createNewProject = useCallback(async (custom?: Partial<QuestionProject>): Promise<QuestionProject> => {
    if(!await flush())throw new Error('Mevcut proje kaydedilemedi. Önce tekrar kaydedin.');
    const nextNum = projects.length > 0 ? Math.max(...projects.map((p) => p.questionNumber || 0)) + 1 : 1;
    const initial: Omit<QuestionProject, 'id' | 'createdAt' | 'updatedAt'> = {
      title: custom?.title || `Yeni Arapça YDT Soru Projesi #${nextNum}`,
      examYear: custom?.examYear || `${new Date().getFullYear()} YDT`,
      questionNumber: custom?.questionNumber || nextNum,
      category: custom?.category || DEFAULT_CATEGORY_ID,
      correctAnswer: custom?.correctAnswer || 'A',
      status: 'draft',
      audioApproved: custom?.audioApproved ?? false,
      videoReady: custom?.videoReady ?? false,
      imageUrl: custom?.imageUrl || '',
      imageFileName: custom?.imageFileName || '',
      arabicQuestionSnippet: custom?.arabicQuestionSnippet || '',
      solutionText: custom?.solutionText || '',
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
    confirmed.current.set(created.id,JSON.stringify(created));
    projectRef.current=created;setCurrentProject(created);setSaveStatus('saved');setError('');
    return created;
  }, [projects,flush]);

  useEffect(()=>{
    if(!currentProject || confirmed.current.get(currentProject.id)===JSON.stringify(currentProject))return;
    const snapshot=currentProject;
    setSaveStatus('pending');
    localWrites.current=localWrites.current.catch(()=>undefined).then(()=>draftStore.put(owner,snapshot)).catch(()=>{
      setError('Cihaz yedeği oluşturulamadı. Kaydedildi yazısını görmeden sayfayı kapatmayın.');
    });
    const timer=setTimeout(()=>{if(projectRef.current===snapshot)void saveCurrentProject();},1200);
    return ()=>clearTimeout(timer);
  },[currentProject,owner,saveCurrentProject]);

  useEffect(()=>{
    const reconnect=()=>{if(projectRef.current)void saveCurrentProject();};
    const warn=(event:BeforeUnloadEvent)=>{const p=projectRef.current;if(p && confirmed.current.get(p.id)!==JSON.stringify(p)){event.preventDefault();event.returnValue='';}};
    window.addEventListener('online',reconnect);window.addEventListener('beforeunload',warn);
    return ()=>{window.removeEventListener('online',reconnect);window.removeEventListener('beforeunload',warn);};
  },[saveCurrentProject]);

  const deleteProjectById = useCallback(async (id: string): Promise<boolean> => {
    if(!await flush())throw new Error('Bekleyen değişiklikler kaydedilemedi.');
    const ok = await projectRepository.delete(id);
    if (ok) {
      await localWrites.current;await draftStore.remove(owner,id).catch(()=>undefined);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (currentProject?.id === id) {
        projectRef.current=null;setCurrentProject(null);
      }
    }
    return ok;
  }, [currentProject,owner,flush]);

  return (
    <ProjectContext.Provider
      value={{
        error,
        saveStatus,
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
