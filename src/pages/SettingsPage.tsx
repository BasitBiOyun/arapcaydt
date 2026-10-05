import React, { useState, useEffect } from 'react';
import { 
  Gear, 
  Waveform, 
  ArrowCounterClockwise, 
  Sparkle, 
  ShieldCheck, 
  Info
} from '@phosphor-icons/react';
import { elevenlabsService } from '../services/elevenlabs/elevenlabsService';
import { ElevenLabsStatus } from '../types';
import { TeacherKeyCard } from '../features/settings/TeacherKeyCard';
import { DefaultsCard, ProfileCard, TextSizeCard } from '../features/settings/MySettingsCards';
import { StudioSettingsCard } from '../features/settings/StudioSettingsCard';
import { BackupCard } from '../features/settings/BackupCard';
import { PronunciationCard } from '../features/settings/PronunciationCard';
import { useAuth } from '../features/auth/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ElevenLabsStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    elevenlabsService.checkStatus().then(setStatus);
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const s = await elevenlabsService.checkStatus();
      setStatus(s);
      setTestResult(s.voiceReady ?? s.gemini?.configured ? 'Ses servisi hazır.' : 'Ses servisi şu anda kullanılamıyor.');
    } catch (e: any) {
      setTestResult('Bağlantı kontrolü sırasında hata: ' + e.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="studio-library !max-w-4xl space-y-6">
      <header className="library-heading !mb-2">
        <div>
          <h2>Ayarlar</h2>
          <p>Profiliniz, yeni soru varsayılanları, ses servisi, telaffuz sözlüğü ve yedekleme{user?.role === 'admin' ? '; en altta stüdyo ayarları' : ''}.</p>
        </div>
      </header>

      <ProfileCard />
      <TextSizeCard />
      <DefaultsCard />

      {/* Voice service card: Gemini voice, ElevenLabs only as the word-timing fallback */}
      <div className="p-5 rounded-xl bg-white border border-[#E5E4DC] space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#EFEFEA] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center">
              <Waveform size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1C1917]">Ses servisi</h3>
              <p className="text-xs text-[#787670]">Seslendirme ve kelime zamanları otomatik hazırlanır</p>
            </div>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-3 py-1.5 rounded border border-[#D5D4CC] bg-[#FAF9F5] hover:bg-[#F2F1EB] text-xs font-semibold text-[#33322E] transition-colors cursor-pointer"
          >
            {isTesting ? 'Kontrol Ediliyor...' : 'Durumu Yenile'}
          </button>
        </div>

        <div className="p-3.5 rounded bg-[#FAF9F5] border border-[#E5E4DC] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#666560]">Seslendirme:</span>
            <span className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${
              status?.gemini?.configured ? 'bg-[#EFF7F0] text-[#1E562A] border border-[#C5DAC8]' : 'bg-[#FAF5E6] text-[#78540E] border border-[#E5D7B0]'
            }`}>{status?.gemini?.configured ? 'Hazır' : 'Yapılandırılmamış'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#666560]">Kelime zamanları (yedek):</span>
            <span className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${
              status?.configured && status.valid !== false ? 'bg-[#EFF7F0] text-[#1E562A] border border-[#C5DAC8]' : 'bg-[#FAF5E6] text-[#78540E] border border-[#E5D7B0]'
            }`}>{status?.configured && status.valid !== false ? 'Hazır' : 'Kullanılamıyor'}</span>
          </div>
          <p className="text-[#55544F] leading-relaxed text-xs">
            Ses yalnızca Google Gemini ile üretilir. Kelime zamanları önce Gemini ile alınır, olmazsa yedek servis devreye girer. Günlük ücretsiz ses hakkı biterse kendi Google anahtarınızı ekleyebilirsiniz.
          </p>
        </div>

        <div className="p-3 rounded bg-[#F8EEEE] border border-[#DFC8CB] text-xs text-[#8B1E2D] flex items-start gap-2">
          <ShieldCheck size={18} weight="fill" className="shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Güvenlik</span>
            <p className="text-xs text-[#6E1623] leading-relaxed">
              Ses servislerinin anahtarları yalnızca sunucuda tutulur; tarayıcıda hiçbir zaman görünmez.
            </p>
          </div>
        </div>
      </div>

      <PronunciationCard />

      {/* Teacher's own Google AI Studio key (used before the shared capacity) */}
      <TeacherKeyCard />

      <BackupCard />

      {user?.role === 'admin' && <StudioSettingsCard />}
    </div>
  );
};
