import React from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ProjectProvider } from './features/projects/ProjectContext';
import { LoginPage } from './features/auth/LoginPage';
import { LandingPage, type AuthMode } from './features/landing/LandingPage';
// The studio itself (editor, OCR, narration) loads only after sign-in, so the landing page opens fast.
const AppLayout = React.lazy(() => import('./layouts/AppLayout').then(m => ({ default: m.AppLayout })));
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { APP_NAME } from './config/brand';
import { takeOAuthError } from './services/supabase';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout, refresh, recovering } = useAuth();
  // A failed Google sign-in returns to the site; show its message on the sign-in form.
  const [oauthError] = React.useState(takeOAuthError);
  const [authView, setAuthView] = React.useState<AuthMode | null>(oauthError ? 'login' : null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-[#787670]">
          <span className="w-2 h-2 rounded-full bg-[#8B1E2D] animate-ping"></span>
          <span>{APP_NAME} yükleniyor…</span>
        </div>
      </div>
    );
  }

  if (recovering) return <LoginPage />;
  if (!isAuthenticated) {
    // Visitors see the landing page; the form (with any sign-in message) opens from its buttons.
    if (!authView) return <LandingPage onAuth={setAuthView} />;
    return <LoginPage key={authView || 'login'} initialMode={authView || 'login'} initialError={oauthError || ''} onBack={() => setAuthView(null)} />;
  }

  if (user?.status !== 'approved')
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FAF9F5]">
        <section className="bg-white rounded-xl border p-8 max-w-md space-y-4">
          <h1 className="text-xl font-semibold">
            {user?.status === 'blocked' ? 'Hesabınızın erişimi durduruldu' : 'Yönetici onayı bekleniyor'}
          </h1>
          <p>{user?.email}</p>
          <p>Hesabınız onaylandığında kendi soru ve video panelinize erişebilirsiniz.</p>
          <button onClick={() => void refresh()} className="border rounded p-2 mr-3">
            Durumu yenile
          </button>
          <button onClick={() => void logout()}>Çıkış yap</button>
        </section>
      </main>
    );
  return (
    <ProjectProvider key={user?.id}>
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center text-xs text-[#787670]">{APP_NAME} açılıyor…</div>
        }
      >
        <AppLayout />
      </React.Suspense>
    </ProjectProvider>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
