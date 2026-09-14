import React, { useState, useEffect } from 'react';
import { 
  Gear, 
  Waveform, 
  Desktop, 
  DeviceMobile, 
  FloppyDisk, 
  ArrowCounterClockwise, 
  Sparkle, 
  ShieldCheck, 
  Info,
  DownloadSimple
} from '@phosphor-icons/react';
import { elevenlabsService } from '../services/elevenlabs/elevenlabsService';
import { ElevenLabsStatus } from '../types';
import { useProjects } from '../features/projects/ProjectContext';

export const SettingsPage: React.FC = () => {
  const { projects } = useProjects();
  const [status, setStatus] = useState<ElevenLabsStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [teacherBrand, setTeacherBrand] = useState('Arapça YDT Akademi');
  const [defaultAspect, setDefaultAspect] = useState<'16:9' | '9:16'>('16:9');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    elevenlabsService.checkStatus().then(setStatus);
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const s = await elevenlabsService.checkStatus();
      setStatus(s);
      setTestResult(s.message);
    } catch (e: any) {
      setTestResult('Bağlantı kontrolü sırasında hata: ' + e.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem(
      'arabic_ydt_teacher_preferences',
      JSON.stringify({ teacherBrand, defaultAspect })
    );
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleExportBackup = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      projectsCount: projects.length,
      projects,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arapca_ydt_soru_yedek_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-base font-bold text-[#1C1917] tracking-tight">
          Sistem Ayarları & Entegrasyon Yönetimi
        </h2>
        <p className="text-xs text-[#666560] mt-0.5">
          ElevenLabs sunucu API durumu, video varsayılanları ve proje veri tabanı yönetimi.
        </p>
      </div>

      {/* 1. ElevenLabs API Integration Card */}
      <div className="p-5 rounded bg-white border border-[#E5E4DC] space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#EFEFEA] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center">
              <Waveform size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1C1917]">
                ElevenLabs Sunucu Entegrasyonu
              </h3>
              <p className="text-[11px] text-[#787670]">
                Çevre Değişkeni: <code className="font-mono-code">ELEVENLABS_API_KEY</code>
              </p>
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
            <span className="text-[#666560]">Durum:</span>
            <span
              className={`font-mono-code font-bold px-2 py-0.5 rounded text-[11px] ${
                status?.configured
                  ? 'bg-[#EFF7F0] text-[#1E562A] border border-[#C5DAC8]'
                  : 'bg-[#FAF5E6] text-[#78540E] border border-[#E5D7B0]'
              }`}
            >
              {status?.configured ? 'CANLI API AKTİF' : 'DEMO / MOCK MODU AKTİF'}
            </span>
          </div>
          <p className="text-[#55544F] leading-relaxed text-[11px]">
            {status?.message || 'ElevenLabs ses motoru hazır durumda.'}
          </p>
        </div>

        <div className="p-3 rounded bg-[#F8EEEE] border border-[#DFC8CB] text-xs text-[#8B1E2D] flex items-start gap-2">
          <ShieldCheck size={18} weight="fill" className="shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Güvenlik İlkesi (Zero Client-Side Exposure)</span>
            <p className="text-[11px] text-[#6E1623] leading-relaxed">
              API anahtarları hiçbir zaman tarayıcı kodunda açığa çıkmaz. Tüm istekler arka uçta çalışan <code>server.ts</code> Express servisi üzerinden yönlendirilir.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Video Defaults Card */}
      <div className="p-5 rounded bg-white border border-[#E5E4DC] space-y-4 shadow-xs">
        <div className="border-b border-[#EFEFEA] pb-3">
          <h3 className="text-sm font-semibold text-[#1C1917]">
            Video Prodüksiyon Varsayılanları
          </h3>
          <p className="text-[11px] text-[#787670]">
            Yeni oluşturulan sorularda uygulanacak video ve kanal ayarları
          </p>
        </div>

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="font-medium text-[#33322E]">
              Kanal / Öğretmen Filigranı (Watermark):
            </label>
            <input
              type="text"
              value={teacherBrand}
              onChange={(e) => setTeacherBrand(e.target.value)}
              className="w-full px-3 py-1.5 rounded border border-[#D5D4CC] bg-[#FAF9F5] focus:bg-white text-xs outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-[#33322E]">
              Varsayılan En-Boy Oranı (Aspect Ratio):
            </label>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aspect"
                  checked={defaultAspect === '16:9'}
                  onChange={() => setDefaultAspect('16:9')}
                  className="accent-[#8B1E2D]"
                />
                <span className="flex items-center gap-1 text-xs">
                  <Desktop size={15} />
                  <span>16:9 Yatay (YouTube / Akıllı Tahta)</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aspect"
                  checked={defaultAspect === '9:16'}
                  onChange={() => setDefaultAspect('9:16')}
                  className="accent-[#8B1E2D]"
                />
                <span className="flex items-center gap-1 text-xs">
                  <DeviceMobile size={15} />
                  <span>9:16 Dikey (Shorts / Reels)</span>
                </span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSavePreferences}
              className="px-4 py-1.5 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FloppyDisk size={14} weight="bold" />
              <span>{savedSuccess ? 'Tercihler Kaydedildi!' : 'Tercihleri Kaydet'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Database & Backup */}
      <div className="p-5 rounded bg-white border border-[#E5E4DC] space-y-3 shadow-xs">
        <div className="border-b border-[#EFEFEA] pb-2">
          <h3 className="text-sm font-semibold text-[#1C1917]">
            Veri Depolama ve Yedekleme (Repository Altyapısı)
          </h3>
          <p className="text-[11px] text-[#787670]">
            Mevcut projeler tarayıcı yerel deposunda (LocalStorage) tutulmaktadır ve ileride veritabanı ile değiştirilebilir soyut katmana sahiptir.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-[#55544F]">
            Kayıtlı Soru Projesi Sayısı: <strong>{projects.length}</strong>
          </div>
          <button
            onClick={handleExportBackup}
            className="px-3 py-1.5 rounded border border-[#D5D4CC] bg-[#FAF9F5] hover:bg-[#F2F1EB] text-xs font-semibold text-[#33322E] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <DownloadSimple size={14} />
            <span>Tüm Projeleri JSON Olarak Yedekle</span>
          </button>
        </div>
      </div>
    </div>
  );
};
