import React from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ProjectProvider } from './features/projects/ProjectContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppLayout } from './layouts/AppLayout';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-mono-code text-[#787670]">
          <span className="w-2 h-2 rounded-full bg-[#8B1E2D] animate-ping"></span>
          <span>Arapça YDT Stüdyosu Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <ProjectProvider>
      <AppLayout />
    </ProjectProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
