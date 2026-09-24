import {useAuth} from '../features/auth/AuthContext';
import {AdminPage} from '../pages/AdminPage';
import React, { useState } from 'react';
import { AppSidebar, AppPage } from '../components/common/AppSidebar';
import { AppHeader } from '../components/common/AppHeader';
import { DashboardPage } from '../pages/DashboardPage';
import { QuestionsPage } from '../pages/QuestionsPage';
import { QuestionEditorPage } from '../pages/QuestionEditorPage';
import { SettingsPage } from '../pages/SettingsPage';
import { useProjects } from '../features/projects/ProjectContext';
import { NewProjectCategoryModal } from '../features/projects/NewProjectCategoryModal';

export const AppLayout: React.FC = () => {
  const {user}=useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>(user?.role==='admin'?'admin':'dashboard');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const { selectProject, createNewProject, currentProject, projects, error, loadProjects } = useProjects();

  const handleSelectProject = async (id: string) => {
    const selected=await selectProject(id);
    if(!selected)return;
    setCurrentPage('editor');
  };

  const handleNewQuestion = () => {
    setIsNewModalOpen(true);
  };

  const handleConfirmCreate = async (categoryId: string) => {
    await createNewProject({ category: categoryId });
    setCurrentPage('editor');
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
          onBack={() => setCurrentPage('questions')}
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
        onNavigate={setCurrentPage}
        onNewQuestion={handleNewQuestion}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AppHeader
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />

        <main className="flex-1 overflow-y-auto">
          {error&&<div role="alert" className="p-4 bg-red-50 text-red-800">{error} <button onClick={()=>void loadProjects()}>Yeniden dene</button></div>}
          {currentPage==='admin'&&user?.role==='admin'&&<AdminPage/>}
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigate={setCurrentPage}
              onSelectProject={handleSelectProject}
              onNewQuestion={handleNewQuestion}
            />
          )}

          {currentPage === 'questions' && (
            <QuestionsPage
              onNavigate={setCurrentPage}
              onSelectProject={handleSelectProject}
              onNewQuestion={handleNewQuestion}
            />
          )}

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
