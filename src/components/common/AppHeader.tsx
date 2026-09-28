import React, { useState, useEffect } from 'react';
import type { AppPage } from './AppSidebar';
import { Waveform } from '@phosphor-icons/react';
import { APP_NAME } from '../../config/brand';
import { PAGE_LABELS } from '../../config/pages';
import { elevenlabsService } from '../../services/elevenlabs/elevenlabsService';
import { ElevenLabsStatus } from '../../types';

interface AppHeaderProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ currentPage }) => {
  const [voiceStatus, setVoiceStatus] = useState<ElevenLabsStatus | null>(null);
  const voiceReady = Boolean(voiceStatus?.voiceReady ?? voiceStatus?.gemini?.configured);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    elevenlabsService.checkStatus().then(setVoiceStatus);
  }, []);

  return (
    <>
      <header className="h-14 px-6 bg-white/80 backdrop-blur border-b flex items-center justify-between shrink-0 select-none">
        <nav aria-label="Konum" className="text-sm text-[#787670] truncate">
          <span className="hidden sm:inline">{APP_NAME}</span>
          <span className="hidden sm:inline mx-2 text-[#C9C7BE]">/</span>
          <span className="font-semibold text-[#1C1917]">{PAGE_LABELS[currentPage]}</span>
        </nav>

        <button
          onClick={() => setShowStatusModal(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
            voiceReady
              ? 'bg-[#EFF7F0] border-[#C5DAC8] text-[#1E562A] hover:bg-[#E5F2E6]'
              : 'bg-[#FAF5E6] border-[#E5D7B0] text-[#78540E] hover:bg-[#F5EDD5]'
          }`}
          title="Ses servisi durumu"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${voiceReady ? 'bg-[#2E7D32]' : 'bg-[#B48419]'}`} />
          {voiceStatus === null ? 'Ses servisi…' : voiceReady ? 'Ses servisi hazır' : 'Ses servisi kullanılamıyor'}
        </button>
      </header>

      {/* Voice service information */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center">
                  <Waveform size={20} weight="bold" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#1C1917]">Ses servisi</h3>
                  <p className="text-xs text-[#787670]">Seslendirme ve kelime zamanları otomatik hazırlanır</p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded bg-[#FAF9F5] border border-[#E5E4DC] text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-[#E5E4DC]">
                <span className="text-[#666560]">Seslendirme:</span>
                <span className="font-semibold text-[#1C1917]">{voiceStatus?.gemini?.configured ? 'Hazır (Achernar sesi)' : 'Yapılandırılmamış'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#E5E4DC]">
                <span className="text-[#666560]">Kelime zamanları (yedek):</span>
                <span className="font-semibold text-[#1C1917]">{voiceStatus?.configured && voiceStatus.valid !== false ? 'Hazır' : 'Kullanılamıyor'}</span>
              </div>
              <p className="text-[#55544F] leading-relaxed pt-1">
                Çözüm metninizi yazıp Seslendirme Oluştur'a basmanız yeterli; ses Google Gemini ile üretilir ve animasyon için kelime zamanları otomatik alınır. Günlük ücretsiz ses hakkı biterse Ayarlar'dan kendi Google anahtarınızı ekleyebilirsiniz.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowStatusModal(false)}
                className="studio-primary"
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
