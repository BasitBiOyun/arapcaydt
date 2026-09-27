import {useAuth} from '../features/auth/AuthContext';
import {AdminPage} from '../pages/AdminPage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppSidebar, AppPage } from '../components/common/AppSidebar';
import { AppHeader } from '../components/common/AppHeader';
import { AnnouncementBanner } from '../features/settings/AnnouncementBanner';
import { DashboardPage } from '../pages/DashboardPage';
import { QuestionsPage } from '../pages/QuestionsPage';
import { QuestionEditorPage } from '../pages/QuestionEditorPage';
import { SettingsPage } from '../pages/SettingsPage';
import { BatchPage } from '../pages/BatchPage';
import { useProjects } from '../features/projects/ProjectContext';
import { NewProjectCategoryModal } from '../features/projects/NewProjectCategoryModal';

/** A page that must not be left silently (MP4 export, batch run): returns true when leaving is fine. */
export type LeaveGuard = () => boolean;

export const AppLayout: React.FC = () => {
  const {user}=useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>(user?.role==='admin'?'admin':'dashboard');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const { selectProject, createNewProject, currentProject, projects, error, loadProjects, isLoading } = useProjects();
  const pageRef = useRef(currentPage);
  pageRef.current = currentPage;
  const leaveGuard = useRef<LeaveGuard | null>(null);
  const registerLeaveGuard = useCallback((guard: LeaveGuard | null) => { leaveGuard.current = guard; }, []);

  // Every page change goes through here, so the browser's Back button moves between
  // studio pages (instead of leaving the site) and a running job is never dropped silently.
  const navigate = useCallback((page: AppPage, fromHistory = false) => {
    if (page === pageRef.current) return;
    if (leaveGuard.current && !leaveGuard.current()) {
      if (fromHistory) window.history.pushState({ studioPage: pageRef.current }, '');
      return;
    }
    leaveGuard.current = null;
    setCurrentPage(page);
    if (!fromHistory) window.history.pushState({ studioPage: page }, '');
  }, []);
  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), studioPage: pageRef.current }, '');
    const onPop = (event: PopStateEvent) => {
      const page = event.state?.studioPage as AppPage | undefined;
      if (page) navigate(page === 'admin' && user?.role !== 'admin' ? 'dashboard' : page, true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [navigate, user?.role]);

  const handleSelectProject = async (id: string) => {
    if (leaveGuard.current && !leaveGuard.current()) return;
    const selected=await selectProject(id);
    if(!selected)return;
    navigate('editor');
  };

  const handleNewQuestion = () => {
    setIsNewModalOpen(true);
  };

  const handleConfirmCreate = async (categoryId: string) => {
    if (leaveGuard.current && !leaveGuard.current()) return;
    await createNewProject({ category: categoryId });
    navigate('editor');
  };

  // If on editor page and no current project is selected, pick the first one
  React.useEffect(() => {
    if (currentPage === 'editor' && !currentProject && projects.length > 0) {
      selectProject(projects[0].id);
    }
  }, [currentPage, currentProject, projects, selectProject]);

  if (currentPage === 'editor') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#FAF9F5]">
        <QuestionEditorPage key={currentProject?.id}
          onBack={() => navigate('questions')}
          onNewQuestion={handleNewQuestion}
          registerLeaveGuard={registerLeaveGuard}
          waitingForProject={isLoading || (!currentProject && projects.length > 0 && !error)}
          loadError={error}
        />
        <NewProjectCategoryModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onCreate={handleConfirmCreate}
        />
      </div>
    );
  }

  return (
    <div className="studio-shell flex h-screen w-screen overflow-hidden bg-[#FAF9F5]">
      {/* Left Sidebar */}
      <AppSidebar
        currentPage={currentPage}
        onNavigate={navigate}
        onNewQuestion={handleNewQuestion}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AppHeader
          currentPage={currentPage}
          onNavigate={navigate}
        />

        <AnnouncementBanner />
        <main className="flex-1 overflow-y-auto">
          {error&&<div role="alert" className="p-4 bg-red-50 text-red-800">{error} <button onClick={()=>void loadProjects()}>Yeniden dene</button></div>}
          {currentPage==='admin'&&user?.role==='admin'&&<AdminPage/>}
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigate={navigate}
              onSelectProject={handleSelectProject}
              onNewQuestion={handleNewQuestion}
            />
          )}

          {currentPage === 'questions' && (
            <QuestionsPage
              onNavigate={navigate}
              onSelectProject={handleSelectProject}
              onNewQuestion={handleNewQuestion}
            />
          )}

          {currentPage === 'batch' && <BatchPage onOpenProject={id => void handleSelectProject(id)} registerLeaveGuard={registerLeaveGuard} />}
          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>

      <NewProjectCategoryModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleConfirmCreate}
      />
    </div>
  );
};
