import React, { useState, useEffect } from 'react';
import { AppPage } from './AppSidebar';
import { 
  Waveform, 
  FloppyDisk, 
  Export, 
  Check, 
  Info, 
  Sparkle,
  WarningCircle 
} from '@phosphor-icons/react';
import { useAuth } from '../../features/auth/AuthContext';
import { useProjects } from '../../features/projects/ProjectContext';
import { elevenlabsService } from '../../services/elevenlabs/elevenlabsService';
import { ElevenLabsStatus } from '../../types';

interface AppHeaderProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentPage,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { currentProject, saveCurrentProject } = useProjects();
  const [elevenLabsStatus, setElevenLabsStatus] = useState<ElevenLabsStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    elevenlabsService.checkStatus().then(setElevenLabsStatus);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if(!await saveCurrentProject())return;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'admin':
        return {title:'Yönetim Paneli',subtitle:'Öğretmenler, projeler ve üretim takibi'};
      case 'dashboard':
        return {
          title: 'Öğretmen Kontrol Paneli',
          subtitle: 'Arapça YDT Soru Analiz & Video Üretim Merkezi',
        };
      case 'questions':
        return {
          title: 'Soru ve Proje Havuzu',
          subtitle: 'Kayıtlı ÖSYM YDT ve Özgün Arapça Soru Projeleri',
        };
      case 'editor':
        return {
          title: currentProject ? currentProject.title : 'Soru ve Video Editörü',
          subtitle: currentProject
            ? `${currentProject.examYear} • Soru ${currentProject.questionNumber} • Doğru Şık: [ ${currentProject.correctAnswer} ]`
            : 'Yeni proje oluşturun veya listeden bir soru seçin',
        };
      case 'settings':
        return {
          title: 'Sistem Ayarları & Entegrasyonlar',
          subtitle: 'ElevenLabs API, Ses Modelleri ve Video Çıktı Ayarları',
        };
      default:
        return { title: 'Arapça YDT Stüdyosu', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <>
      <header className="h-16 px-6 bg-[#FFFFFF] border-b border-[#E5E4DC] flex items-center justify-between shrink-0 select-none">
        {/* Title area */}
        <div className="flex flex-col justify-center max-w-xl">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-[#1C1917] tracking-tight truncate">
              {title}
            </h1>
            {currentPage === 'editor' && currentProject && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-code font-semibold bg-[#F4EBEB] text-[#8B1E2D] border border-[#DFC8CB]">
                {currentProject.category.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#787670] truncate leading-tight mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Right Action & Status Area */}
        <div className="flex items-center gap-3">
          {/* ElevenLabs Status Pill */}
          <button
            onClick={() => setShowStatusModal(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
              elevenLabsStatus?.configured
                ? 'bg-[#EFF7F0] border-[#C5DAC8] text-[#1E562A] hover:bg-[#E5F2E6]'
                : 'bg-[#FAF5E6] border-[#E5D7B0] text-[#78540E] hover:bg-[#F5EDD5]'
            }`}
            title="ElevenLabs Entegrasyon Durumu"
          >
            <Waveform size={14} weight="bold" className={elevenLabsStatus?.configured ? 'text-[#2E7D32]' : 'text-[#B48419]'} />
            <span className="font-mono-code text-[11px]">
              {elevenLabsStatus?.configured ? 'ElevenLabs: Bağlı' : 'ElevenLabs: Demo / Mock Modu'}
            </span>
            <Info size={12} className="opacity-70 ml-0.5" />
          </button>

          {/* Editor specific actions */}
          {currentPage === 'editor' && currentProject && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#E5E4DC]">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#DCDCD4] bg-[#F7F7F2] hover:bg-[#EFEFE8] text-[#22211E] text-xs font-semibold transition-colors cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <Check size={14} weight="bold" className="text-[#1E562A]" />
                    <span className="text-[#1E562A]">Kaydedildi</span>
                  </>
                ) : (
                  <>
                    <FloppyDisk size={14} weight="bold" />
                    <span>{isSaving ? 'Kaydediliyor...' : 'Kaydet'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ElevenLabs Status Information Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#D5D4CC] shadow-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center">
                  <Waveform size={20} weight="bold" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#1C1917]">
                    ElevenLabs Ses Sentezi Durumu
                  </h3>
                  <p className="text-xs text-[#787670]">
                    Sunucu Tarafı API Entegrasyon Yapısı
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded bg-[#FAF9F5] border border-[#E5E4DC] text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-[#E5E4DC]">
                <span className="text-[#666560]">Çalışma Modu:</span>
                <span className="font-mono-code font-bold text-[#1C1917]">
                  {elevenLabsStatus?.configured ? 'CANLI API (Live Server)' : 'YÜKSEK DOĞRULUKLU MOCK / DEMO MODU'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#E5E4DC]">
                <span className="text-[#666560]">Çevre Değişkeni:</span>
                <span className="font-mono-code text-[#44423D]">ELEVENLABS_API_KEY</span>
              </div>
              <p className="text-[#55544F] leading-relaxed pt-1">
                {elevenLabsStatus?.configured
                  ? 'Sunucuda güvenli şekilde yapılandırılmış ElevenLabs anahtarı bulundu. Arapça YDT seslendirmeleri gerçek zamanlı olarak ElevenLabs Multilingual v2 üzerinden kelime hizalama (word-level timestamps) ile üretilir.'
                  : 'Sistem şu anda aktif Demo/Mock modundadır. Öğretmenler API anahtarı girmeden de seslendirme üretebilir, çalabilir, dalga formunu inceleyebilir ve soru üzerindeki zaman çizelgesi hizalamasını eksiksiz test edebilir.'}
              </p>
            </div>

            <div className="text-[11px] text-[#6E6D68] bg-[#F4F3ED] p-2.5 rounded border border-[#E2E1D9] flex items-start gap-2">
              <Sparkle size={16} className="text-[#8B1E2D] shrink-0 mt-0.5" />
              <span>
                API anahtarı istemci tarayıcısında asla görünmez; yalnızca Node.js sunucu katmanında <code>/api/elevenlabs/generate</code> rotası üzerinden yönetilir.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-1.5 rounded bg-[#1C1917] hover:bg-[#33312E] text-white text-xs font-semibold cursor-pointer"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
