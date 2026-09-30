import { SPOKEN_LIMIT } from './SolutionStep';
import React, { useEffect, useMemo, useState } from 'react';
import type { QuestionProject } from '../../../types';
import { narrationDrift } from '../../../services/analysis/timelineAligner';
import { capacityLine, geminiKeyService, quotaResetClock, type TeacherKeyStatus } from '../../../services/narration/geminiKeyService';
import { VOICE_QUOTA_MESSAGE, VOICE_RETRY_MESSAGE } from '../../../services/narration/narrationService';
import { RevoicePanel } from '../RevoicePanel';
import type { TextRange } from '../../../services/narration/revoice';
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
  /** A plain note after an upload (e.g. the solution text was taken from the recording). */
  audioInfo?: string | null;
  /** Re-voice only a stretch of the solution (a sentence, a few, or a part). */
  handleRevoice?: (range: TextRange) => void;
  canUndoRevoice?: boolean;
  handleUndoRevoice?: () => void;
}

/** STEP 3: Seslendirme */
const formatTime = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

export function AudioStep({ step, hasAudio, hasSolution, isUploadedAudio, isAudioApproved, currentProject, isAudioPlaying, toggleStageAudio, audioPlayTime, setAudioPlayTime, activeAudioDuration, activeAudioUrl, stageAudioRef, uploadMp3InputRef, handleDownloadNarrationMp3, handleUploadMp3File, handleDeleteAudio, handleGenerateAudio, handleApproveVoice, isGeneratingAudio, sampleBusy, isTranscribingMp3, transcribeProgress, audioError, audioInfo, handleRevoice, canUndoRevoice, handleUndoRevoice }: AudioStepProps) {
  // Which Google key the next narration uses; refreshed after each generation.
  const [keyStatus, setKeyStatus] = useState<TeacherKeyStatus | null>(null);
  useEffect(() => {
    if (isGeneratingAudio) return;
    let alive = true;
    geminiKeyService.status().then(s => { if (alive) setKeyStatus(s); }, () => undefined);
    return () => { alive = false; };
  }, [isGeneratingAudio]);
  const capacity = capacityLine(keyStatus);
  // A generated voice can leave the script (older models add or skip words). The word
  // transcript taken for timing shows where; forced alignment and Whisper cannot tell.
  const source = currentProject.narrationSource;
  const drift = useMemo(() => source?.type === 'gemini' && source.timingSource === 'gemini-transcribe'
    ? narrationDrift(currentProject.solutionText, source.words || [], activeAudioDuration || undefined) : null, [source, currentProject.solutionText, activeAudioDuration]);
  const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return (
    <div hidden={step!==2} className="space-y-3">
      <h2 className="text-sm font-bold text-[#1C1917] tracking-tight">
        Seslendirmeyi dinleyin
      </h2>

      {hasAudio ? (
        <div className="p-3.5 rounded-lg border border-[#E5E4DC] bg-[#FAF9F5] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-[#1C1917] truncate">
                {isUploadedAudio
                  ? `Yüklenen Ses: ${currentProject.narrationSource?.fileName || 'seslendirme.mp3'}`
                  : 'Eğitmen Sesi'}
              </span>
            </div>

            {isAudioApproved ? (
              <span className="text-sm font-semibold text-[#15803D] flex items-center gap-1 shrink-0 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                <Check size={12} weight="bold" /> Onaylandı
              </span>
            ) : (
              <span className="text-sm font-medium text-[#B45309] bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                Onay Bekliyor
              </span>
            )}
          </div>
          {drift && (drift.added.length > 0 || drift.skipped.length > 0) && (
            <div role="alert" className="p-2.5 rounded border border-[#E5D7B0] bg-[#FAF5E6] text-sm text-[#5C420B] space-y-1">
              <p className="font-semibold">Ses metinden sapmış olabilir; ilgili yerleri dinleyin:</p>
              {drift.added.slice(0, 3).map(d => <p key={`a${d.start}`}>{clock(d.start)} · metinde olmayan: “{d.text.length > 80 ? d.text.slice(0, 80) + '…' : d.text}”</p>)}
              {drift.skipped.slice(0, 3).map(d => <p key={`s${d.start}`}>{clock(d.start)} · okunmamış: “{d.text.length > 80 ? d.text.slice(0, 80) + '…' : d.text}”</p>)}
              <p>Hatalıysa aşağıdaki “Sesi düzelt” bölümünden yalnız o yeri yeniden seslendirin. Arapça kelimeler bazen farklı yazıya dökülür; sesi dinleyip karar verin.</p>
            </div>
          )}

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

            <div className="text-sm font-mono-code text-[#55544F] shrink-0">
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

            <div className="text-sm font-mono-code text-[#787670] shrink-0">
              {formatTime(activeAudioDuration)}
            </div>

            <audio
              ref={stageAudioRef}
              src={activeAudioUrl}
              preload="auto"
            />
          </div>

          {/* Actions: MP3 İndir, Yeniden seslendir / Değiştir / Sil, Bu Sesi Kullan */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadNarrationMp3}
              title="Oluşturulan veya yüklenen MP3 dosyasını indirin"
              className="py-1.5 px-2.5 rounded text-sm font-semibold border border-[#D5D4CC] bg-white hover:bg-[#F0EFEA] text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <DownloadSimple size={13} weight="bold" />
              <span>Ses Dosyasını İndir</span>
            </button>

            {isUploadedAudio ? (
              <>
                <label className="py-1.5 px-2.5 rounded text-sm font-semibold border border-[#D5D4CC] bg-white hover:bg-[#F0EFEA] text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer flex items-center gap-1 shrink-0">
                  <ArrowsClockwise size={13} />
                  <span>MP3 Değiştir</span>
                  <input
                    type="file"
                    accept=".mp3,audio/mpeg,audio/mp3"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadMp3File(e.target.files[0]);
                      e.target.value = ''; // the same file can be picked again
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDeleteAudio}
                  className="py-1.5 px-2 rounded text-sm font-semibold text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
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
                className="py-1.5 px-2.5 rounded text-sm font-semibold border border-[#D5D4CC] bg-white hover:bg-[#F0EFEA] text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                {isGeneratingAudio ? (
                  <CircleNotch size={13} className="animate-spin" />
                ) : (
                  <ArrowsClockwise size={13} />
                )}
                <span>Yeniden seslendir</span>
              </button>
            )}

            {!isAudioApproved && (
              <button
                type="button"
                onClick={handleApproveVoice}
                className="ml-auto py-1.5 px-3 rounded text-sm font-bold bg-[#15803D] hover:bg-[#116630] text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <Check size={13} weight="bold" />
                <span>Bu Sesi Kullan</span>
              </button>
            )}
          </div>
          {handleRevoice && !isUploadedAudio && (source?.words?.length ?? 0) > 0 && (
            <RevoicePanel
              solutionText={currentProject.solutionText}
              words={source?.words || []}
              duration={activeAudioDuration}
              skipped={drift?.skipped ?? []}
              audio={stageAudioRef}
              busy={isGeneratingAudio || sampleBusy}
              onRevoice={handleRevoice}
              canUndo={!!canUndoRevoice}
              onUndo={() => handleUndoRevoice?.()}
            />
          )}
        </div>
      ) : (
        /* Two clean choices: Seslendirme Oluştur or MP3 Yükle */
        <div className="space-y-2.5">
          {currentProject.solutionText.trim().length > SPOKEN_LIMIT && (
            <p role="alert" className="text-sm text-[#B91C1C] bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
              Çözüm metni {currentProject.solutionText.trim().length.toLocaleString('tr')} karakter; seslendirme en fazla {SPOKEN_LIMIT.toLocaleString('tr')} karakter okuyabilir. 2. adımda metni kısaltın ya da MP3 yükleyin.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleGenerateAudio}
              disabled={isGeneratingAudio || sampleBusy || !hasSolution || currentProject.solutionText.trim().length > SPOKEN_LIMIT}
              className={`py-2.5 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
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
              className="py-2.5 px-3 rounded-lg text-sm font-bold border border-[#D5D4CC] bg-white hover:bg-[#F0EFEA] text-[#1C1917] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs text-center"
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
                      e.target.value = ''; // the same file can be picked again
                }}
              />
            </label>
          </div>
          {!hasSolution && (
            <p className="text-sm text-[#787670]">
              Seslendirme oluşturmak için önce çözüm metnini yazın. Hazır sesiniz varsa MP3 Yükle’ye basın; çözüm metni ve işaretler sesinizden çıkarılır.
            </p>
          )}
          {hasSolution && capacity && (
            <p className="text-sm text-[#787670]">{capacity}</p>
          )}
        </div>
      )}

      {/* Whisper Local Transcription Progress */}
      {isTranscribingMp3 && (
        <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E4DC] text-sm space-y-2">
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

      {audioInfo && !audioError && (
        <p className="text-sm text-[#1E562A] font-medium">{audioInfo}</p>
      )}
      {hasAudio && capacity && !audioError && (
        <p className="text-sm text-[#787670]">{capacity}</p>
      )}
      {audioError && (audioError === VOICE_QUOTA_MESSAGE || /hakkı doldu|hakkınız doldu|kotaları doldu/i.test(audioError) ? (
        // Out of today's allowance: say it plainly, so nobody keeps trying until morning.
        <div role="alert" className="p-3.5 rounded-lg border border-[#F1D7AF] bg-[#FFF7E8] text-[#6F5316] space-y-1.5">
          <p className="text-base font-bold">Bugünkü ücretsiz ses hakkı bitti</p>
          <p className="text-sm leading-relaxed">
            Haklar her gün saat {quotaResetClock()}’da yenilenir. O saate kadar yeniden denemeyin; denemeler sonuç vermez.
          </p>
          {!keyStatus?.key ? (
            <p className="text-sm leading-relaxed">
              Bugün devam etmek için kendi ücretsiz Google anahtarınızı ekleyin:{' '}
              <a href="#/yardim/google-anahtari" className="font-semibold text-[#8B1E2D] underline">resimli anlatım</a>.
            </p>
          ) : (
            <p className="text-sm leading-relaxed">Kendi anahtarınızın ve ortak kapasitenin bugünkü hakları kullanıldı.</p>
          )}
        </div>
      ) : (
        <div role="alert" className="p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-800 space-y-1.5">
          <p className="text-sm font-semibold">{audioError}</p>
          {audioError === VOICE_RETRY_MESSAGE || /zamanında yanıt vermedi|seslendirilemedi/i.test(audioError) ? (
            <p className="text-sm leading-relaxed">
              Üst üste olmuyorsa tekrar tekrar denemeyin (her deneme bir hak harcar); sol menüdeki “Sorun bildir” ile bize haber verin.
            </p>
          ) : null}
          {hasAudio && !isUploadedAudio && (
            <p className="text-sm leading-relaxed">Sesin yalnız bir iki cümlesi hatalıysa bütün sesi yeniden üretmeyin: “Sesi düzelt” ile sadece o yeri düzeltin.</p>
          )}
        </div>
      ))}
    </div>
  );
}
