import React from 'react';
import type { QuestionProject } from '../../../types';
import { Check, Pause, Play, DownloadSimple, ArrowsClockwise, Trash, CircleNotch, Microphone, UploadSimple } from '@phosphor-icons/react';

export interface AudioStepProps {
  step: number;
  hasAudio: boolean;
  hasSolution: boolean;
  isUploadedAudio: boolean;
  isAudioApproved: boolean;
  currentProject: QuestionProject;
  isAudioPlaying: boolean;
  toggleStageAudio: () => void;
  formatTime: (secs: number) => string;
  audioPlayTime: number;
  setAudioPlayTime: (time: number) => void;
  activeAudioDuration: number;
  activeAudioUrl: string;
  stageAudioRef: React.RefObject<HTMLAudioElement | null>;
  uploadMp3InputRef: React.RefObject<HTMLInputElement | null>;
  handleDownloadNarrationMp3: () => void;
  handleUploadMp3File: (file: File) => void;
  handleDeleteAudio: () => void;
  handleGenerateAudio: () => void;
  handleApproveVoice: () => void;
  isGeneratingAudio: boolean;
  sampleBusy: boolean;
  isTranscribingMp3: boolean;
  transcribeProgress: { progress: number; message: string } | null;
  audioError: string | null;
}

/** STEP 3: Seslendirme */
export function AudioStep({ step, hasAudio, hasSolution, isUploadedAudio, isAudioApproved, currentProject, isAudioPlaying, toggleStageAudio, formatTime, audioPlayTime, setAudioPlayTime, activeAudioDuration, activeAudioUrl, stageAudioRef, uploadMp3InputRef, handleDownloadNarrationMp3, handleUploadMp3File, handleDeleteAudio, handleGenerateAudio, handleApproveVoice, isGeneratingAudio, sampleBusy, isTranscribingMp3, transcribeProgress, audioError }: AudioStepProps) {
  return (
    <div hidden={step!==2} className="space-y-3">
      <h2 className="text-xs font-bold text-[#1C1917] tracking-tight">
        Seslendirmeyi dinleyin
      </h2>

      {hasAudio ? (
        <div className="p-3.5 rounded-lg border border-[#E5E4DC] bg-[#FAF9F5] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-[#1C1917] truncate">
                {isUploadedAudio
                  ? `Yüklenen Ses: ${currentProject.narrationSource?.fileName || 'seslendirme.mp3'}`
                  : 'Eğitmen Sesi'}
              </span>
            </div>

            {isAudioApproved ? (
              <span className="text-[11px] font-semibold text-[#15803D] flex items-center gap-1 shrink-0 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                <Check size={12} weight="bold" /> Onaylandı
              </span>
            ) : (
              <span className="text-[11px] font-medium text-[#B45309] bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                Onay Bekliyor
              </span>
            )}
          </div>

          {/* Minimalist Audio player bar */}
          <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-[#E5E4DC]">
            <button
              type="button"
              onClick={toggleStageAudio}
              className="w-7 h-7 rounded-full bg-[#8B1E2D] text-white flex items-center justify-center shrink-0 hover:bg-[#721824] transition-colors cursor-pointer"
            >
              {isAudioPlaying ? (
                <Pause size={13} weight="fill" />
              ) : (
                <Play size={13} weight="fill" className="ml-0.5" />
              )}
            </button>

            <div className="text-[11px] font-mono-code text-[#55544F] shrink-0">
              {formatTime(audioPlayTime)}
            </div>

            <input
              type="range"
              min={0}
              max={activeAudioDuration || 1}
              step={0.1}
              value={audioPlayTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setAudioPlayTime(val);
                if (stageAudioRef.current) {
                  stageAudioRef.current.currentTime = val;
                }
              }}
              className="flex-1 h-1.5 bg-[#E5E4DC] rounded-lg appearance-none cursor-pointer accent-[#8B1E2D]"
            />

            <div className="text-[11px] font-mono-code text-[#787670] shrink-0">
              {formatTime(activeAudioDuration)}
            </div>

            <audio
              ref={stageAudioRef}
              src={activeAudioUrl}
              preload="auto"
            />
          </div>

          {/* Actions: MP3 İndir, Yeniden Oluştur / Değiştir / Sil, Bu Sesi Kullan */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadNarrationMp3}
              title="Oluşturulan veya yüklenen MP3 dosyasını indirin"
              className="py-1.5 px-2.5 rounded text-[11px] font-semibold border border-[#D5D4CC] bg-white hover:bg-[#F0EFEA] text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <DownloadSimple size={13} weight="bold" />
              <span>MP3 İndir</span>
            </button>

            {isUploadedAudio ? (
              <>
                <label className="py-1.5 px-2.5 rounded text-[11px] font-semibold border border-[#D5D4CC] bg-white hover:bg-[#F0EFEA] text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer flex items-center gap-1 shrink-0">
                  <ArrowsClockwise size={13} />
                  <span>MP3 Değiştir</span>
                  <input
                    type="file"
                    accept=".mp3,audio/mpeg,audio/mp3"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadMp3File(e.target.files[0]);
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDeleteAudio}
                  className="py-1.5 px-2 rounded text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Trash size={13} />
                  <span>Sil</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio || sampleBusy}
                className="py-1.5 px-2.5 rounded text-[11px] font-semibold border border-[#D5D4CC] bg-white hover:bg-[#F0EFEA] text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                {isGeneratingAudio ? (
                  <CircleNotch size={13} className="animate-spin" />
                ) : (
                  <ArrowsClockwise size={13} />
                )}
                <span>Yeniden Oluştur</span>
              </button>
            )}

            {!isAudioApproved && (
              <button
                type="button"
                onClick={handleApproveVoice}
                className="ml-auto py-1.5 px-3 rounded text-[11px] font-bold bg-[#15803D] hover:bg-[#116630] text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <Check size={13} weight="bold" />
                <span>Bu Sesi Kullan</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Two clean choices: Seslendirme Oluştur or MP3 Yükle */
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleGenerateAudio}
              disabled={isGeneratingAudio || sampleBusy || !hasSolution || currentProject.solutionText.trim().length>5000}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                hasSolution
                  ? 'bg-[#8B1E2D] hover:bg-[#721824] text-white'
                  : 'bg-[#E5E4DC] text-[#8C8A82] cursor-not-allowed'
              }`}
            >
              {isGeneratingAudio ? (
                <>
                  <CircleNotch size={14} className="animate-spin" />
                  <span>Seslendiriliyor...</span>
                </>
              ) : (
                <>
                  <Microphone size={15} weight="bold" />
                  <span>Seslendirme Oluştur</span>
                </>
              )}
            </button>

            <label
              className="py-2.5 px-3 rounded-lg text-xs font-bold border border-[#D5D4CC] bg-white hover:bg-[#F0EFEA] text-[#1C1917] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs text-center"
            >
              <UploadSimple size={15} weight="bold" />
              <span>MP3 Yükle</span>
              <input
                ref={uploadMp3InputRef}
                type="file"
                accept=".mp3,audio/mpeg,audio/mp3"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleUploadMp3File(e.target.files[0]);
                }}
              />
            </label>
          </div>
          {!hasSolution && (
            <p className="text-[11px] text-[#787670]">
              Seslendirme oluşturmak için önce çözüm metnini yazın.
            </p>
          )}
        </div>
      )}

      {/* Whisper Local Transcription Progress */}
      {isTranscribingMp3 && (
        <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E4DC] text-xs space-y-2">
          <div className="flex items-center gap-2 text-[#1C1917] font-semibold">
            <CircleNotch size={15} className="animate-spin text-[#8B1E2D] shrink-0" />
            <span className="truncate">{transcribeProgress?.message || 'Whisper ile ses çözümleniyor...'}</span>
          </div>
          <div className="w-full bg-[#E5E4DC] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#8B1E2D] h-full transition-all duration-150"
              style={{ width: `${transcribeProgress?.progress || 15}%` }}
            />
          </div>
        </div>
      )}

      {audioError && (
        <p className="text-[11px] text-red-600 font-medium">
          {audioError}
        </p>
      )}
    </div>
  );
}
