import React, { useState } from 'react';
import { QuestionProject } from '../../types';
import { localVideoPipeline, LocalPipelineResult } from '../../services/pipeline/localVideoPipeline';
import { 
  Sparkle, 
  CheckCircle, 
  WarningCircle, 
  CircleNotch, 
  PlayCircle,
  VideoCamera,
  X,
  Crosshair,
  Check
} from '@phosphor-icons/react';

interface AutoVideoGeneratorModalProps {
  project: QuestionProject;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: LocalPipelineResult) => void;
}

type PipelineStep = 'idle' | 'analyzing_image' | 'analyzing_solution' | 'aligning_audio' | 'building_layers' | 'completed' | 'error';

export const AutoVideoGeneratorModal: React.FC<AutoVideoGeneratorModalProps> = ({
  project,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<PipelineStep>('idle');
  const [stepMessage, setStepMessage] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [generatedStats, setGeneratedStats] = useState<LocalPipelineResult['stats'] | null>(null);

  if (!isOpen) return null;

  const handleStartGeneration = async () => {
    setErrorDetails(null);
    setCurrentStep('analyzing_image');
    setStepMessage('Soru görseli inceleniyor ve A–E seçenek alanları tespit ediliyor (Tesseract OCR)...');

    try {
      const result = await localVideoPipeline.executePipeline({
        imageUrl: project.imageUrl,
        solutionText: project.solutionText,
        correctAnswer: project.correctAnswer,
        narrationSource: project.narrationSource || {
          type: 'uploaded',
          audioUrl: project.audioNarration?.audioUrl || '',
          duration: project.audioNarration?.duration || 15,
          words: project.audioNarration?.words,
        },
        existingRegions: project.videoConfig?.regions,
        suppressedRegionIds: project.videoConfig?.suppressedRegionIds,
        onProgress: (progress) => {
          setStepMessage(progress.message);
          if (progress.stage === 'ocr') setCurrentStep('analyzing_image');
          else if (progress.stage === 'detect_layout') setCurrentStep('analyzing_solution');
          else if (progress.stage === 'timeline_align') setCurrentStep('aligning_audio');
        },
      });

      setCurrentStep('completed');
      setGeneratedStats(result.stats);
      setStepMessage('Video animasyonları başarıyla oluşturuldu!');
      onSuccess(result);
    } catch (err: any) {
      console.error('Auto pipeline error:', err);
      setCurrentStep('error');
      setErrorDetails(err?.message || 'Video oluşturulurken bir hata meydana geldi.');
    }
  };

  const stepsList = [
    {
      key: 'analyzing_image',
      title: 'Soru Görseli Analizi',
      desc: 'Soru kökü, paragraf ve A–E şık sınırları tespit edilir.',
    },
    {
      key: 'analyzing_solution',
      title: 'Pedagojik Çözüm Planı',
      desc: 'Şık eleme (✕), doğru şık (✓) ve Arapça vurguları çıkarılır.',
    },
    {
      key: 'aligning_audio',
      title: 'Seslendirme Eşlemesi',
      desc: 'Seslendirmedeki kelime zamanlamaları ile bağlanır.',
    },
    {
      key: 'building_layers',
      title: 'Animasyon Katmanları',
      desc: 'Canvas motoruna aktarılır ve kalıcı işaretleme durumları hesaplanır.',
    },
  ];

  const getStepStatus = (stepKey: string) => {
    const order = ['analyzing_image', 'analyzing_solution', 'aligning_audio', 'building_layers', 'completed'];
    const curIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(stepKey);

    if (currentStep === 'completed') return 'done';
    if (currentStep === 'error') return stepIdx <= curIdx ? 'error' : 'waiting';
    if (stepIdx < curIdx) return 'done';
    if (stepIdx === curIdx) return 'active';
    return 'waiting';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-[#D5D4CC] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#FBFBFA] border-b border-[#E5E4DC]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#8B1E2D]/10 flex items-center justify-center text-[#8B1E2D]">
              <Sparkle size={20} weight="fill" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1C1917]">Otomatik Video & Animasyon Motoru</h3>
              <p className="text-[11px] text-[#787670]">Gemini Vision + Seslendirme Senkronizasyonu</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#787670] hover:text-[#1C1917] p-1 rounded hover:bg-[#EFEFEA] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {currentStep === 'idle' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded bg-[#F7F6F0] border border-[#E5E4DC] text-xs text-[#55544F] leading-relaxed space-y-2">
                <p className="font-semibold text-[#1C1917]">
                  Şıklar otomatik taranır. Eksik veya hatalı alanları önizlemedeki düzenleyicide düzeltebilirsiniz.
                </p>
                <p>
                  Sistem soru görselini inceleyecek, şıkları (A, B, C, D, E) ve çözüm açıklamanızdaki eleme/doğrulama mantığını tespit ederek seslendirmeyle senkronize edecektir.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-[#666560] uppercase tracking-wider">
                  Otomatik Süreç Adımları:
                </div>
                <div className="space-y-2 border border-[#E5E4DC] rounded p-3 bg-white">
                  {stepsList.map((st, idx) => (
                    <div key={st.key} className="flex items-start gap-2.5 text-xs">
                      <div className="w-5 h-5 rounded-full bg-[#FAF9F5] border border-[#D5D4CC] flex items-center justify-center text-[11px] font-bold text-[#787670] shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-[#1C1917]">{st.title}</div>
                        <div className="text-[11px] text-[#787670]">{st.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartGeneration}
                className="w-full py-3 px-4 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Sparkle size={18} weight="fill" />
                <span>Videoyu Otomatik Oluştur (Başlat)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active / Loading Steps */}
              <div className="space-y-2.5">
                {stepsList.map((st) => {
                  const status = getStepStatus(st.key);
                  return (
                    <div
                      key={st.key}
                      className={`flex items-center gap-3 p-2.5 rounded border transition-all ${
                        status === 'active'
                          ? 'bg-[#8B1E2D]/5 border-[#8B1E2D]/40 text-[#1C1917]'
                          : status === 'done'
                          ? 'bg-[#15803D]/5 border-[#15803D]/20 text-[#1C1917]'
                          : 'bg-[#FAF9F5] border-[#E5E4DC] text-[#787670] opacity-70'
                      }`}
                    >
                      <div className="shrink-0">
                        {status === 'active' && (
                          <CircleNotch size={18} className="animate-spin text-[#8B1E2D]" />
                        )}
                        {status === 'done' && (
                          <CheckCircle size={18} weight="fill" className="text-[#15803D]" />
                        )}
                        {status === 'waiting' && (
                          <div className="w-4 h-4 rounded-full border border-[#D5D4CC]" />
                        )}
                        {status === 'error' && (
                          <WarningCircle size={18} weight="fill" className="text-red-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="text-xs font-semibold">{st.title}</div>
                        <div className="text-[11px] text-[#787670]">{st.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status banner */}
              {currentStep !== 'completed' && currentStep !== 'error' && (
                <div className="p-3 rounded bg-[#FAF9F5] border border-[#E5E4DC] text-center text-xs font-medium text-[#55544F] animate-pulse">
                  {stepMessage}
                </div>
              )}

              {/* Completed Screen */}
              {currentStep === 'completed' && (
                <div className="p-4 rounded bg-[#EFF7F0] border border-[#C5DAC8] text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#15803D]/10 text-[#15803D] flex items-center justify-center mx-auto">
                    <CheckCircle size={24} weight="fill" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E562A]">Video Animasyonları Hazır!</h4>
                    <p className="text-[11px] text-[#2C6E3B] mt-1">
                      {generatedStats
                        ? `${generatedStats.actionsGenerated} animasyon eylemi (eleme ✕, doğru cevap ✓, vurgular) başarıyla zaman çizelgesine yerleştirildi.`
                        : 'Animasyonlar başarıyla oluşturuldu.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 px-4 rounded bg-[#1E562A] hover:bg-[#164420] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <PlayCircle size={17} weight="bold" />
                    <span>Videoyu Önizle & İndir →</span>
                  </button>
                </div>
              )}

              {/* Error Screen */}
              {currentStep === 'error' && (
                <div className="p-3.5 rounded bg-[#FFF2F2] border border-[#F5C2C2] text-xs space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-bold">
                    <WarningCircle size={18} weight="fill" />
                    <span>Oluşturma Hatası</span>
                  </div>
                  <p className="text-red-800 text-[11px]">{errorDetails}</p>
                  <button
                    type="button"
                    onClick={handleStartGeneration}
                    className="mt-2 py-1.5 px-3 rounded bg-red-700 text-white font-semibold text-xs cursor-pointer"
                  >
                    Tekrar Dene
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
