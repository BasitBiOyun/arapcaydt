import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ProjectSummary, QuestionProject } from '../../types';
import { toSummary } from './projectSummary';
import { projectRepository } from './projectRepository';
import {useAuth} from '../auth/AuthContext';
import {draftStore} from './draftStore';
import {createSaveQueue} from './saveQueue';
import { DEFAULT_CATEGORY_ID } from '../../config/categories';
import { newProjectDefaults } from '../settings/preferences';
import { trashExpired } from './trash';

interface ProjectContextType {
  error: string;
  saveStatus: 'saved' | 'pending' | 'saving' | 'error';
  /** Light list entries; open one with selectProject for the full project. */
  projects: ProjectSummary[];
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
  /** Questions in the recycle bin (deleted for good after 30 days). */
  trash: ProjectSummary[];
  /** Moves questions to the recycle bin; returns how many moved. */
  moveToTrash: (ids: string[]) => Promise<number>;
  restoreFromTrash: (ids: string[]) => Promise<number>;
  /** Deletes questions for good, with their pictures and voices. */
  deleteForever: (ids: string[]) => Promise<number>;
  /** Puts questions into a collection ('' takes them out of any collection). */
  moveToCollection: (ids: string[], examName: string) => Promise<number>;
  /** Changes questions one by one (null leaves one as it is); returns the ids that were saved. */
  updateQuestions: (ids: string[], change: (project: QuestionProject) => Promise<QuestionProject | null>) => Promise<string[]>;
  /** Saves questions read from a backup as new questions of this account. */
  importProjects: (list: QuestionProject[], onProgress?: (done: number) => void) => Promise<number>;
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
  // Every question of the account, the recycle bin included; lists read `projects` and `trash`.
  const [allProjects, setProjects] = useState<ProjectSummary[]>([]);
  const projects = useMemo(() => allProjects.filter(p => !p.deletedAt), [allProjects]);
  const trash = useMemo(() => allProjects.filter(p => p.deletedAt).sort((a, b) => b.deletedAt!.localeCompare(a.deletedAt!)), [allProjects]);
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
      setProjects(prev=>prev.map(p=>p.id===saved.id?toSummary(saved):p).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
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
      // Summaries only: `confirmed` tracks full projects and is set when one is opened.
      const list = await projectRepository.getSummaries();
      // Questions whose 30 days in the recycle bin are over are deleted for good now.
      const expired = list.filter(p => trashExpired(p.deletedAt));
      const gone = new Set<string>();
      for (const p of expired) if (await projectRepository.delete(p.id).catch(() => false)) gone.add(p.id);
      setProjects(list.filter(p => !gone.has(p.id)));
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
    const defaults=newProjectDefaults(user?.preferences);
    const initial: Omit<QuestionProject, 'id' | 'createdAt' | 'updatedAt'> = {
      ...(defaults.examName?{examName:defaults.examName}:{}),
      title: custom?.title || `Yeni Soru Projesi #${nextNum}`,
      examYear: custom?.examYear || defaults.examYear || `${new Date().getFullYear()} YDT`,
      questionNumber: custom?.questionNumber || nextNum,
      category: custom?.category || defaults.category || DEFAULT_CATEGORY_ID,
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
        teacherTag: 'Soru Çözümü',
        annotations: [],
        ...defaults.video,
      },
      notes: '',
      ...custom,
    };

    const created = await projectRepository.create(initial);
    setProjects((prev) => [toSummary(created), ...prev]);
    confirmed.current.set(created.id,JSON.stringify(created));
    projectRef.current=created;setCurrentProject(created);setSaveStatus('saved');setError('');
    return created;
  }, [projects,flush,user?.preferences]);

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

  /** Runs one change per question, keeps going past a failure and returns the ids that worked. */
  const eachQuestion = useCallback(async (ids: string[], change: (id: string) => Promise<boolean>) => {
    if(!await flush())throw new Error('Bekleyen değişiklikler kaydedilemedi.');
    const done: string[] = [];
    for (const id of ids) if (await change(id).catch(() => false)) done.push(id);
    // An open question that changed here is loaded again when it is next opened.
    if (projectRef.current && done.includes(projectRef.current.id)) { projectRef.current = null; setCurrentProject(null); }
    return done;
  }, [flush]);

  const moveToTrash = useCallback(async (ids: string[]) => {
    const at = new Date().toISOString();
    const done = await eachQuestion(ids, id => projectRepository.setDeleted(id, at));
    setProjects(prev => prev.map(p => done.includes(p.id) ? { ...p, deletedAt: at } : p));
    return done.length;
  }, [eachQuestion]);

  const restoreFromTrash = useCallback(async (ids: string[]) => {
    const done = await eachQuestion(ids, id => projectRepository.setDeleted(id, null));
    setProjects(prev => prev.map(p => {
      if (!done.includes(p.id)) return p;
      const { deletedAt: _, ...rest } = p;
      return rest;
    }));
    return done.length;
  }, [eachQuestion]);

  const deleteForever = useCallback(async (ids: string[]) => {
    const done = await eachQuestion(ids, id => projectRepository.delete(id));
    await localWrites.current;
    for (const id of done) await draftStore.remove(owner, id).catch(() => undefined);
    setProjects(prev => prev.filter(p => !done.includes(p.id)));
    return done.length;
  }, [eachQuestion, owner]);

  const updateQuestions = useCallback((ids: string[], change: (project: QuestionProject) => Promise<QuestionProject | null>) =>
    eachQuestion(ids, async id => {
      const full = await projectRepository.getById(id);
      const changed = full && await change(full);
      if (!changed) return false;
      const next = await projectRepository.save(changed);
      confirmed.current.set(next.id, JSON.stringify(next));
      setProjects(prev => prev.map(p => p.id === next.id ? toSummary(next) : p));
      return true;
    }), [eachQuestion]);

  const moveToCollection = useCallback(async (ids: string[], examName: string) => {
    const name = examName.trim();
    return (await updateQuestions(ids, async full => ({ ...full, examName: name || undefined }))).length;
  }, [updateQuestions]);

  const importProjects = useCallback(async (list: QuestionProject[], onProgress?: (done: number) => void) => {
    if(!await flush())throw new Error('Bekleyen değişiklikler kaydedilemedi.');
    const taken = new Set(allProjects.map(p => p.id));
    const added: ProjectSummary[] = [];
    for (const project of list) {
      // A question that is still in the account is never overwritten: it comes back as a copy.
      const id = taken.has(project.id) ? crypto.randomUUID() : project.id;
      taken.add(id);
      const saved = await projectRepository.save({ ...project, id });
      added.push(toSummary(saved));
      onProgress?.(added.length);
    }
    setProjects(prev => [...added, ...prev].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    return added.length;
  }, [allProjects, flush]);

  return (
    <ProjectContext.Provider
      value={{
        error,
        saveStatus,
        projects,
        trash,
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
        moveToTrash,
        restoreFromTrash,
        deleteForever,
        moveToCollection,
        updateQuestions,
        importProjects,
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
