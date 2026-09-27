import React from 'react';
import type { QuestionProject } from '../../../types';
import { CheckCircle, CircleNotch, DownloadSimple, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { ReadinessCard } from '../ReadinessCard';
import type { ReadinessAction } from '../readiness';

export interface ExportStepProps {
  step: number;
  videoGenerated: boolean;
  currentProject: QuestionProject;
  handleReadinessAction: (action: ReadinessAction) => void;
  exportError: string | null;
  isExportingMp4: boolean;
  exportAbortRef: React.RefObject<AbortController | null>;
  handleDownloadMp4: () => void;
  exportPercent: number | null;
  setIsVideoModalOpen: (open: boolean) => void;
  handleAttemptCreateVideo: () => void;
  isAudioApproved: boolean;
  videoButtonWarning: string | null;
}

/** STEP 4: Video Oluştur */
export function ExportStep({ step, videoGenerated, currentProject, handleReadinessAction, exportError, isExportingMp4, exportAbortRef, handleDownloadMp4, exportPercent, setIsVideoModalOpen, handleAttemptCreateVideo, isAudioApproved, videoButtonWarning }: ExportStepProps) {
  return (
    <div hidden={step<3} className="space-y-3 pt-2 border-t border-[#E5E4DC]">
      <h2 className="text-xs font-bold text-[#1C1917] tracking-tight">
        {step===4?'Videonuzu indirin':'Animasyon önizlemesi'}
      </h2>

      {videoGenerated ? (
        /* Completed Video State: single clear download action + İşaretleri yeniden hazırla */
        <div className="p-4 rounded-xl border border-[#C5DAC8] bg-[#F4F9F5] space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#15803D]">
            <CheckCircle size={18} weight="fill" />
            <span>Animasyon önizlemesi hazır</span>
          </div>

          <div className="space-y-2">
            <ReadinessCard project={currentProject} onAction={handleReadinessAction} />
            {currentProject.videoConfig.warnings?.map(w => <p key={w} className="text-xs text-amber-800">{w}</p>)}
            {exportError && <p role="alert" className="text-xs text-red-700">{exportError}</p>}
            {isExportingMp4 && <button type="button" className="text-xs underline" onClick={() => exportAbortRef.current?.abort()}>Oluşturmayı iptal et</button>}
            <button
              type="button"
              onClick={handleDownloadMp4}
              hidden={step!==4}
              disabled={isExportingMp4}
              className="w-full py-3 px-4 rounded-lg bg-[#8B1E2D] hover:bg-[#721824] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              {isExportingMp4 ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  <span>MP4 Hazırlanıyor... {exportPercent ? `%${exportPercent}` : ''}</span>
                </>
              ) : (
                <>
                  <DownloadSimple size={17} weight="bold" />
                  <span>MP4 İndir (1080p)</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('İşaretler görsel ve sese göre baştan hazırlanır. Elle yaptığınız zamanlama düzeltmeleri kaybolur. Devam edilsin mi?')) setIsVideoModalOpen(true);
              }}
              className="text-xs font-semibold text-[#55544F] hover:text-[#1C1917] underline-offset-2 hover:underline transition-colors"
            >
              İşaretleri yeniden hazırla
            </button>
          </div>
        </div>
      ) : (
        /* Video creation button (Enabled ONLY when audio is approved) */
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAttemptCreateVideo}
            disabled={!isAudioApproved}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all ${
              isAudioApproved
                ? 'bg-[#8B1E2D] hover:bg-[#721824] text-white cursor-pointer'
                : 'bg-[#E5E4DC] text-[#787670] cursor-not-allowed opacity-75'
            }`}
          >
            <Sparkle size={18} weight="fill" />
            <span>İşaretleri otomatik hazırla</span>
          </button>

          {!isAudioApproved && (
            <p className="text-[11px] text-[#787670] text-center">
              Önce bir seslendirme oluşturun veya MP3 yükleyip onaylayın.
            </p>
          )}

          {videoButtonWarning && (
            <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5 animate-in fade-in">
              <WarningCircle size={15} weight="bold" className="shrink-0 text-amber-700" />
              <span>{videoButtonWarning}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
