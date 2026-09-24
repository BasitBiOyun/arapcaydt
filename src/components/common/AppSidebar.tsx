import React from 'react';
import { 
  SquaresFour, 
  ListDashes, 
  PlusCircle, 
  Gear, 
  SignOut,
  BookOpenText,
  IdentificationBadge
} from '@phosphor-icons/react';
import { useAuth } from '../../features/auth/AuthContext';
import { useProjects } from '../../features/projects/ProjectContext';

export type AppPage = 'dashboard' | 'questions' | 'editor' | 'settings' | 'admin';

interface AppSidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onNewQuestion: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentPage,
  onNavigate,
  onNewQuestion,
}) => {
  const { user, logout } = useAuth();
  const { projects } = useProjects();

  const draftCount = projects.filter((p) => p.status === 'draft').length;
  const approvedCount = projects.filter((p) => p.status === 'audio_approved' || p.status === 'video_ready').length;

  return (
    <aside className="studio-sidebar w-64 h-screen flex flex-col bg-[#FAF9F5] border-r border-[#E5E4DC] select-none shrink-0">
      {/* Brand / Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-[#E5E4DC]">
        <div className="w-8 h-8 rounded bg-[#8B1E2D] flex items-center justify-center text-white font-bold text-base shadow-xs">
          ض
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm tracking-tight text-[#1C1917] leading-tight">
            Arapça YDT Stüdyosu
          </span>
          <span className="text-[11px] text-[#787670] font-mono-code leading-tight">
            Öğretmen Soru-Video Paneli
          </span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="p-4 pb-2">
        <button
          onClick={onNewQuestion}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white text-xs font-semibold tracking-wide transition-colors shadow-xs cursor-pointer"
        >
          <PlusCircle size={17} weight="bold" />
          <span>Yeni Soru Projesi</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Ana menü" className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {user?.role==='admin'&&<button onClick={()=>onNavigate('admin')} className={`w-full text-left px-3 py-2 rounded text-sm ${currentPage==='admin'?'bg-[#EFECE6] text-[#8B1E2D] font-semibold':''}`}>Yönetim Paneli</button>}
        <button
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
            currentPage === 'dashboard'
              ? 'bg-[#EFECE6] text-[#8B1E2D] font-semibold'
              : 'text-[#44423D] hover:bg-[#F2EFE9] hover:text-[#1C1917]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <SquaresFour size={18} weight={currentPage === 'dashboard' ? 'fill' : 'regular'} />
            <span>Kontrol Paneli</span>
          </div>
          <span className="text-[11px] text-[#787670] font-mono-code">{projects.length}</span>
        </button>

        <button
          onClick={() => onNavigate('questions')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
            currentPage === 'questions'
              ? 'bg-[#EFECE6] text-[#8B1E2D] font-semibold'
              : 'text-[#44423D] hover:bg-[#F2EFE9] hover:text-[#1C1917]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ListDashes size={18} weight={currentPage === 'questions' ? 'bold' : 'regular'} />
            <span>Soru Havuzu</span>
          </div>
          {approvedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono-code bg-[#EFF7F0] text-[#1E562A] border border-[#C5DAC8]">
              {approvedCount} hazır
            </span>
          )}
        </button>

        <button
          onClick={() => onNavigate('editor')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
            currentPage === 'editor'
              ? 'bg-[#EFECE6] text-[#8B1E2D] font-semibold'
              : 'text-[#44423D] hover:bg-[#F2EFE9] hover:text-[#1C1917]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <BookOpenText size={18} weight={currentPage === 'editor' ? 'fill' : 'regular'} />
            <span>Soru & Video Editörü</span>
          </div>
          {draftCount > 0 && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono-code bg-[#F2F2EC] text-[#605F5A]">
              {draftCount} taslak
            </span>
          )}
        </button>

        <div className="pt-4 pb-1 px-3">
          <div className="text-[10px] uppercase font-semibold text-[#8C8A82] tracking-wider">
            Sistem
          </div>
        </div>

        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
            currentPage === 'settings'
              ? 'bg-[#EFECE6] text-[#8B1E2D] font-semibold'
              : 'text-[#44423D] hover:bg-[#F2EFE9] hover:text-[#1C1917]'
          }`}
        >
          <Gear size={18} weight={currentPage === 'settings' ? 'fill' : 'regular'} />
          <span>Ayarlar & Entegrasyon</span>
        </button>
        <button className="mobile-signout" onClick={logout}><SignOut size={18}/>Çıkış</button>
      </nav>

      {/* Academic Teacher Profile Info Footer */}
      <div className="p-3 border-t border-[#E5E4DC] bg-[#FAF9F5]">
        <div className="p-2 rounded border border-[#E5E4DC] bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded bg-[#F2ECEC] border border-[#DFC8CB] flex items-center justify-center text-[#8B1E2D] text-xs font-bold shrink-0">
              <IdentificationBadge size={16} />
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-[#1C1917] truncate leading-tight">
                {user?.name || 'Öğretmen'}
              </div>
              <div className="text-[10px] text-[#787670] truncate leading-tight">
                {user?.title || 'YDT Eğitmeni'}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Oturumu Kapat"
            className="p-1.5 text-[#787670] hover:text-[#8B1E2D] hover:bg-[#F7EEEE] rounded transition-colors cursor-pointer"
          >
            <SignOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
