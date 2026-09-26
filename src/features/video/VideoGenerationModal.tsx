import React, { useState, useEffect, useRef } from 'react';
import { QuestionProject } from '../../types';
import { localVideoPipeline, LocalPipelineProgress, LocalPipelineResult } from '../../services/pipeline/localVideoPipeline';
import { 
  CheckCircle, 
  CircleNotch, 
  WarningCircle, 
  X 
} from '@phosphor-icons/react';

interface VideoGenerationModalProps {
  isOpen: boolean;
  project: QuestionProject;
  onClose: () => void;
  onSuccess: (result: LocalPipelineResult) => void;
}

type InternalStage = 
  | 'IMAGE_ANALYSIS'
  | 'SOLUTION_ANALYSIS'
  | 'TIMESTAMP_MATCHING'
  | 'ANIMATION_BUILD'
  | 'VIDEO_RENDER'
  | 'COMPLETED'
  | 'ERROR';

interface StageDefinition {
  id: InternalStage;
  activeText: string;
  completedText: string;
  pendingText: string;
}

const STAGES: StageDefinition[] = [
  {
    id: 'IMAGE_ANALYSIS',
    activeText: 'Soru görseli Tesseract OCR ile taranıyor...',
    completedText: 'Soru görseli ve şıklar analiz edildi',
    pendingText: 'Soru görseli analizi (Tesseract)',
  },
  {
    id: 'SOLUTION_ANALYSIS',
    activeText: 'Çözüm planı ve şık elemeleri çözümleniyor...',
    completedText: 'Çözüm planı ve elemeler hazırlandı',
    pendingText: 'Çözüm semantik analizi',
  },
  {
    id: 'TIMESTAMP_MATCHING',
    activeText: 'Seslendirme zamanlamaları eşleştiriliyor...',
    completedText: 'Seslendirme kelimeleri eşleştirildi',
    pendingText: 'Seslendirme eşleştirmesi',
  },
  {
    id: 'ANIMATION_BUILD',
    activeText: 'Animasyonlar (odak, X, tik) hazırlanıyor...',
    completedText: 'Animasyonlar hazırlandı',
    pendingText: 'Animasyon oluşturma',
  },
  {
    id: 'VIDEO_RENDER',
    activeText: 'Video sahnesi oluşturuluyor...',
    completedText: 'Video hazırlandı',
    pendingText: 'Video sahnesi',
  },
];

export const VideoGenerationModal: React.FC<VideoGenerationModalProps> = ({
  isOpen,
  project,
  onClose,
  onSuccess,
}) => {
  const [currentStage, setCurrentStage] = useState<InternalStage>('IMAGE_ANALYSIS');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (isOpen && !isRunningRef.current) {
      runPipeline();
    }
  }, [isOpen]);

  const runPipeline = async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setErrorMessage(null);
    setStatusDetail(null);
    setCurrentStage('IMAGE_ANALYSIS');

    try {
      const activeNarrationSource = project.narrationSource || (project.audioNarration ? {
        type: 'elevenlabs' as const,
        audioUrl: project.audioNarration.audioUrl,
        audioBase64: project.audioNarration.audioBase64,
        duration: project.audioNarration.duration,
        voiceId: project.audioNarration.voiceId,
        voiceName: project.audioNarration.voiceName,
        words: project.audioNarration.words,
        alignment: project.audioNarration.alignment,
        isApproved: true,
      } : {
        type: 'elevenlabs' as const,
        duration: 15,
        words: [],
        isApproved: true,
      });

      const result = await localVideoPipeline.executePipeline({
        imageUrl: project.imageUrl,
        solutionText: project.solutionText,
        correctAnswer: project.correctAnswer,
        narrationSource: activeNarrationSource,
        existingRegions: project.videoConfig?.regions?.length ? project.videoConfig.regions : undefined,
        suppressedRegionIds: project.videoConfig?.suppressedRegionIds,
        onProgress: (p: LocalPipelineProgress) => {
          setStatusDetail(p.message);
          if (p.stage === 'ocr' || p.stage === 'detect_layout') {
            setCurrentStage('IMAGE_ANALYSIS');
          } else if (p.stage === 'arabic_matching' || p.stage === 'semantic_parsing') {
            setCurrentStage('SOLUTION_ANALYSIS');
          } else if (p.stage === 'timeline_align') {
            setCurrentStage('TIMESTAMP_MATCHING');
          }
        },
      });

      // Stage: ANIMATION_BUILD
      setCurrentStage('ANIMATION_BUILD');
      await new Promise((r) => setTimeout(r, 400));

      // Stage: VIDEO_RENDER
      setCurrentStage('VIDEO_RENDER');
      await new Promise((r) => setTimeout(r, 400));

      // Stage: COMPLETED
      setCurrentStage('COMPLETED');
      await new Promise((r) => setTimeout(r, 300));

      isRunningRef.current = false;
      onSuccess(result);
    } catch (err: any) {
      isRunningRef.current = false;
      console.error('[Local Video Generation Error]:', err);
      setCurrentStage('ERROR');
      setStatusDetail(null);
      setErrorMessage(err?.message || 'Video analizi yerel olarak tamamlanamadı.');
    }
  };

  if (!isOpen) return null;

  const getStageStatus = (stageId: InternalStage): 'done' | 'active' | 'waiting' => {
    if (currentStage === 'COMPLETED') return 'done';
    if (currentStage === 'ERROR') {
      return 'waiting';
    }

    const order: InternalStage[] = [
      'IMAGE_ANALYSIS',
      'SOLUTION_ANALYSIS',
      'TIMESTAMP_MATCHING',
      'ANIMATION_BUILD',
      'VIDEO_RENDER',
    ];
    const currentIndex = order.indexOf(currentStage);
    const stageIndex = order.indexOf(stageId);

    if (stageIndex < currentIndex) return 'done';
    if (stageIndex === currentIndex) return 'active';
    return 'waiting';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#D5D4CC] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E4DC] bg-[#FAF9F5]">
          <h2 className="text-sm font-bold text-[#1C1917] tracking-tight">
            Videonuz hazırlanıyor
          </h2>
          {currentStage === 'ERROR' && (
            <button
              onClick={onClose}
              className="text-[#787670] hover:text-[#1C1917] p-1 rounded hover:bg-[#EFEFEA]"
              title="Kapat"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Progression checklist */}
          <div className="space-y-3">
            {STAGES.map((st) => {
              const status = getStageStatus(st.id);

              return (
                <div
                  key={st.id}
                  className={`flex items-center gap-3 text-xs transition-colors duration-200 ${
                    status === 'active'
                      ? 'text-[#1C1917] font-semibold'
                      : status === 'done'
                      ? 'text-[#15803D]'
                      : 'text-[#8C8A82]'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {status === 'done' && (
                      <CheckCircle size={18} weight="fill" className="text-[#15803D]" />
                    )}
                    {status === 'active' && (
                      <CircleNotch size={17} className="animate-spin text-[#8B1E2D]" />
                    )}
                    {status === 'waiting' && (
                      <span className="w-2.5 h-2.5 rounded-full border-2 border-[#D5D4CC]" />
                    )}
                  </div>

                  <span>
                    {status === 'done'
                      ? st.completedText
                      : status === 'active'
                      ? st.activeText
                      : st.pendingText}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Local pipeline status detail */}
          {statusDetail && currentStage !== 'ERROR' && currentStage !== 'COMPLETED' && (
            <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E4DC] text-[11px] text-[#55544F] flex items-center gap-2">
              <CircleNotch size={14} className="animate-spin shrink-0 text-[#8B1E2D]" />
              <span className="truncate">{statusDetail}</span>
            </div>
          )}

          {/* Error fallback state */}
          {currentStage === 'ERROR' && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs space-y-3">
              <div className="flex items-center gap-2 text-red-800 font-semibold">
                <WarningCircle size={18} weight="fill" className="shrink-0" />
                <span>{errorMessage || 'Video analizi şu anda tamamlanamadı.'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  isRunningRef.current = false;
                  runPipeline();
                }}
                className="w-full py-2 px-3 rounded-md bg-[#8B1E2D] hover:bg-[#721824] text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Tekrar Dene
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
