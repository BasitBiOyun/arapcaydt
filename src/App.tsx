import React from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ProjectProvider } from './features/projects/ProjectContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppLayout } from './layouts/AppLayout';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout, refresh, recovering } = useAuth();

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

  if (!isAuthenticated || recovering) {
    return <LoginPage />;
  }

  if(user?.status !== 'approved') return <main className="min-h-screen flex items-center justify-center bg-[#FAF9F5]"><section className="bg-white rounded-xl border p-8 max-w-md space-y-4"><h1 className="text-xl font-semibold">{user?.status==='blocked'?'Hesabınızın erişimi durduruldu':'Yönetici onayı bekleniyor'}</h1><p>{user?.email}</p><p>Hesabınız onaylandığında kendi soru ve video panelinize erişebilirsiniz.</p><button onClick={()=>void refresh()} className="border rounded p-2 mr-3">Durumu yenile</button><button onClick={()=>void logout()}>Çıkış yap</button></section></main>;
  return (
    <ProjectProvider key={user?.id}>
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
