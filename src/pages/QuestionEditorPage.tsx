import { steps, resumeStep, checkNarration } from '../features/question-editor/workflow';
import { VoiceSample } from '../features/question-editor/VoiceSample';
import { type ReadinessAction } from '../features/question-editor/readiness';
import { applyPipelineResult, narrationFromTts, timeGeneratedNarration, withWordTimings } from '../features/question-editor/projectUpdates';
import { database } from '../services/supabase';
import React, { useState, useEffect, useRef } from 'react';
import { QuestionProject, VideoConfig } from '../types';
import { useProjects } from '../features/projects/ProjectContext';
import { VideoGenerationModal } from '../features/video/VideoGenerationModal';
import { LocalPipelineResult } from '../services/pipeline/localVideoPipeline';
import { localWhisperService } from '../services/whisper/localWhisperService';
import { localOcrService } from '../services/ocr/localOcrService';
import { prepareUploadedNarration, transcriptText } from '../services/narration/uploadedNarration';
import { readDataUrl, readAudioDuration, readCompressedImage, saveFile } from '../services/narration/browserMedia';
import { narrationService } from '../services/narration/narrationService';
import { splitNarration } from '../services/narration/narrationParts';
import { STANDARD_VOICE_CONFIG } from '../config/voice';
import { QUESTION_CATEGORIES } from '../config/categories';
import { exportProjectVideo, videoFileName } from '../features/video/exportProjectVideo';
import { ExportStep } from '../features/question-editor/steps/ExportStep';
import { AudioStep } from '../features/question-editor/steps/AudioStep';
import { NarrationCheck } from '../features/question-editor/steps/NarrationCheck';
import { SolutionStep } from '../features/question-editor/steps/SolutionStep';
import { EditorStage } from '../features/question-editor/steps/EditorStage';
import { SimpleTimingList } from '../features/question-editor/SimpleTimingList';
import { ImageStep } from '../features/question-editor/steps/ImageStep';
import { ArrowLeft, Check, Plus } from '@phosphor-icons/react';
import type { LeaveGuard } from '../layouts/AppLayout';
import { APP_NAME } from '../config/brand';
import { ReportProblem } from '../features/feedback/ReportProblem';
import { setReportContext } from '../features/feedback/feedback';
import { toast } from 'sonner';
import { useConfirm } from '../components/common/ConfirmDialog';
import { useAuth } from '../features/auth/AuthContext';
import { CollectionInput } from '../features/projects/CollectionInput';

function hasAnimationPlan(project: QuestionProject | null | undefined) {
  return Boolean(
    project &&
    project.videoReady !== false &&
    (project.videoReady || (project.videoConfig.timelineActions && project.videoConfig.timelineActions.length > 0)),
  );
}

interface QuestionEditorPageProps {
  onBack: () => void;
  /** Opens the new-question dialog (shown when no question is open). */
  onNewQuestion?: () => void;
  /** Lets the layout ask before leaving while audio or an MP4 is being prepared. */
  registerLeaveGuard?: (guard: LeaveGuard | null) => void;
  /** A question is being opened (first load or automatic selection). */
  waitingForProject?: boolean;
  loadError?: string;
}

export const QuestionEditorPage: React.FC<QuestionEditorPageProps> = ({
  onBack,
  onNewQuestion,
  registerLeaveGuard,
  waitingForProject,
  loadError,
}) => {
  const { currentProject, updateCurrentProject, saveCurrentProject, saveStatus, error: saveError } = useProjects();
  const { user } = useAuth();
  const confirm = useConfirm();

  const [step, setStep] = useState(() => (currentProject ? resumeStep(currentProject) : 0));
  const [editRegions, setEditRegions] = useState(false);
  const [regionHistory, setRegionHistory] = useState<VideoConfig[]>([]);
  const [sampleBusy, setSampleBusy] = useState(false);

  // Audio generation state
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isTranscribingMp3, setIsTranscribingMp3] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ progress: number; message: string } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioInfo, setAudioInfo] = useState<string | null>(null);

  // Audio preview playback in Step 3
  const [audioPlayTime, setAudioPlayTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const stageAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadMp3InputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);

  // Video generation & status
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoGenerated, setVideoGenerated] = useState(() => hasAnimationPlan(currentProject));
  const [videoButtonWarning, setVideoButtonWarning] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'video' | 'image'>(() => (hasAnimationPlan(currentProject) ? 'video' : 'image'));

  // Video preview player state (HTML5 Canvas + Audio Sync)
  const [currentPreviewTime, setCurrentPreviewTime] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // MP4 export
  const [isExportingMp4, setIsExportingMp4] = useState(false);
  const [exportPercent, setExportPercent] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  // Determine if video already exists for this project
  useEffect(() => {
    const ready = hasAnimationPlan(currentProject);
    setVideoGenerated(ready);
    setPreviewMode(ready ? 'video' : 'image');
  }, [currentProject?.id]);

  // OCR models download while the teacher writes the solution, not when they press "İşaretleri hazırla".
  const needsOcrSoon = Boolean(currentProject?.imageUrl) && !hasAnimationPlan(currentProject);
  useEffect(() => {
    if (!needsOcrSoon) return;
    const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number);
    const handle = idle ? idle(() => localOcrService.warmUp(), { timeout: 4000 }) : window.setTimeout(() => localOcrService.warmUp(), 1500);
    return () => {
      if (idle) (window as any).cancelIdleCallback?.(handle);
      else window.clearTimeout(handle);
    };
  }, [needsOcrSoon]);

  // Audio playback updates
  const activeAudioUrl = currentProject?.narrationSource?.audioUrl || currentProject?.audioNarration?.audioUrl || '';
  const activeAudioDuration = currentProject?.narrationSource?.duration || currentProject?.audioNarration?.duration || 0;

  useEffect(() => {
    const audio = stageAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setAudioPlayTime(audio.currentTime);
    const handleEnded = () => {
      setIsAudioPlaying(false);
      setAudioPlayTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [activeAudioUrl]);

  // Leaving while audio or an MP4 is being prepared would silently drop that work.
  const working = isExportingMp4 ? 'export' : isGeneratingAudio || sampleBusy || isTranscribingMp3 ? 'audio' : null;
  useEffect(() => {
    if (!registerLeaveGuard) return;
    registerLeaveGuard(
      working
        ? () => {
            toast.warning(working === 'export' ? 'MP4 hazırlanıyor.' : 'Ses hazırlanıyor.', {
              description: working === 'export'
                ? 'İndirme bitene kadar bekleyin ya da İndir adımında “İptal” ile durdurun.'
                : 'Bitince bu sayfadan çıkabilirsiniz.',
            });
            return false;
          }
        : null,
    );
    return () => registerLeaveGuard(null);
  }, [working, registerLeaveGuard]);

  // A problem report says which question and step the teacher was on.
  useEffect(() => {
    setReportContext({ page: 'Soru editörü', projectId: currentProject?.id, projectTitle: currentProject?.title, step: steps[step] });
  }, [currentProject?.id, currentProject?.title, step]);

  if (!currentProject) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FAF9F5] p-6">
        <section className="bg-white border border-[#E5E4DC] rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-xs">
          <h1 className="text-base font-bold text-[#1C1917]">
            {waitingForProject ? 'Soru açılıyor…' : loadError ? 'Soru açılamadı' : 'Açık bir soru yok'}
          </h1>
          <p className="text-xs text-[#666560]">
            {waitingForProject
              ? 'Birkaç saniye sürebilir.'
              : loadError
                ? loadError
                : 'Sorularım listesinden bir soru seçin ya da yeni bir soru oluşturun.'}
          </p>
          {!waitingForProject && (
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={onBack} className="studio-secondary flex items-center gap-1.5">
                <ArrowLeft size={16} /> Sorularıma dön
              </button>
              {onNewQuestion && (
                <button type="button" onClick={onNewQuestion} className="studio-primary flex items-center gap-1.5">
                  <Plus size={16} /> Yeni soru
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Handle Save
  const handleSave = async () => {
    const saved = await saveCurrentProject();
    if (!saved) {
      setAudioError('Kayıt tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.');
      return;
    }
  };

  const finishRegionEditing = async () => {
    const saved = await saveCurrentProject();
    if (!saved) {
      setAudioError('Düzenlemeler kaydedilemedi. Önizlemeye dönmeden önce tekrar deneyin.');
      return;
    }
    setEditRegions(false);
    setPreviewMode('video');
  };

  // A new or removed image invalidates every box and mark drawn on the old one.
  const setImage = (imageUrl: string, imageFileName: string) => {
    updateCurrentProject({
      imageUrl,
      imageFileName,
      videoConfig: { ...currentProject.videoConfig, regions: [], suppressedRegionIds: [], timelineActions: [] },
      videoReady: false,
    });
    setVideoGenerated(false);
    setPreviewMode('image');
  };
  /** Work that a new or removed image throws away, said plainly; empty when there is none. */
  const imageLosses = () => {
    const config = currentProject.videoConfig;
    const parts = [
      (config.regions?.length || 0) > 0 && 'görsel üzerindeki kutular',
      (config.timelineActions?.length || 0) > 0 && 'videodaki işaretler',
    ].filter(Boolean);
    return parts.join(' ve ');
  };
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Bu dosya bir görsel değil.', { description: 'PNG, JPG ya da WEBP biçiminde bir soru görseli seçin.' });
      return;
    }
    const losses = currentProject.imageUrl ? imageLosses() : '';
    if (losses && !await confirm({ title: 'Görsel değiştirilsin mi?', message: `Yeni görselle birlikte ${losses} ${losses.endsWith('işaretler') ? 'de' : 'da'} silinir. Bu işlem geri alınamaz.`, confirmLabel: 'Görseli değiştir', danger: true })) return;
    try {
      setImage(await readCompressedImage(file), file.name);
    } catch {
      toast.error('Görsel açılamadı.', { description: 'Dosya bozuk olabilir. Başka bir görsel deneyin ya da ekran görüntüsü alıp onu yükleyin.' });
    }
  };
  const handleDeleteImage = async () => {
    const losses = imageLosses();
    if (!await confirm({ title: 'Görsel silinsin mi?', message: losses ? `Görselle birlikte ${losses} ${losses.endsWith('işaretler') ? 'de' : 'da'} silinir. Bu işlem geri alınamaz.` : 'Soru görseli kaldırılır.', confirmLabel: 'Görseli sil', danger: true })) return;
    setImage('', '');
  };

  // Generate audio with Gemini free-tier TTS first; ElevenLabs remains the automatic fallback.
  const handleGenerateAudio = async () => {
    if (!currentProject.solutionText || currentProject.solutionText.trim().length === 0) {
      setAudioError('Lütfen önce çözüm metnini yazın.');
      return;
    }
    // A new narration replaces the one there is and uses one of the day's voice requests (one per part).
    const voiceParts = splitNarration(currentProject.solutionText).length;
    if (activeAudioUrl && !await confirm({
      title: 'Yeniden seslendirilsin mi?',
      message: `Şu anki ses silinir ve yerine yenisi üretilir. Bugünkü ses haklarınızdan ${voiceParts > 1 ? `${voiceParts} tanesi (uzun metin ${voiceParts} bölümde okunur)` : 'biri'} kullanılır.${currentProject.audioApproved ? ' Onayladığınız sesin yerine geçer.' : ''}`,
      confirmLabel: 'Yeniden seslendir',
    })) return;

    setAudioError(null);
    setAudioInfo(null);
    setIsGeneratingAudio(true);

    try {
      if (!(await saveCurrentProject())) throw new Error('Önce proje kaydedilmelidir.');
      const result = await narrationService.generateNarration({
        projectId: currentProject.id,
        text: currentProject.solutionText,
        voiceId: STANDARD_VOICE_CONFIG.voiceId,
        modelId: STANDARD_VOICE_CONFIG.modelId,
        outputFormat: STANDARD_VOICE_CONFIG.outputFormat,
      }, (done, total) => setAudioInfo(done < total
        ? `Uzun çözüm ${total} bölümde seslendiriliyor: ${done + 1}. bölüm hazırlanıyor…`
        : 'Bölümler tek ses dosyasında birleştiriliyor…'));

      const { narrationSource: newNarrationSource, audioNarration: compatNarration } = narrationFromTts(result);

      const persisted = await saveCurrentProject({
        narrationSource: { ...newNarrationSource, spokenText: currentProject.solutionText },
        audioNarration: compatNarration,
        status: 'audio_generated',
        audioApproved: false,
        videoReady: false,
      });
      if (!persisted) {
        setAudioError('Ses üretildi ama kaydedilemedi. Ses dosyasını indirip Kaydet düğmesini tekrar deneyin.');
      } else if (result.provider === 'gemini') {
        const timing = await timeGeneratedNarration(
          persisted,
          project => narrationService.alignGeneratedNarration(project.id),
          project => localWhisperService.transcribeNarrationAudio(project),
        );
        if (!timing) {
          setAudioError('Ses oluşturuldu ancak kelime zamanları alınamadı. Animasyon yaklaşık zamanlamayla hazırlanır; işaretleri kontrol edin.');
        } else if (timing.words.length) {
          await saveCurrentProject(withWordTimings(persisted, timing.words, timing.timingSource));
        }
      }
      setVideoGenerated(false);
    } catch (err: any) {
      console.error('Audio generation error:', err);
      setAudioError(err instanceof Error ? err.message : 'Seslendirme oluşturulamadı.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Uploaded MP3: align the written solution to the audio; Whisper stays as fallback.
  const handleUploadMp3File = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.mp3') && !file.type.includes('audio')) {
      setAudioError('Lütfen geçerli bir .mp3 dosyası seçin.');
      return;
    }
    setAudioError(null);
    setAudioInfo(null);
    setIsTranscribingMp3(true);
    setTranscribeProgress({ progress: 10, message: 'Ses dosyası taranıyor...' });
    try {
      let saved: QuestionProject | null = null;
      const result = await prepareUploadedNarration(file, {
        readDataUrl,
        readDuration: readAudioDuration,
        // The MP3 is stored with the project first; the server reads it from storage
        // (no upload size limit) and tries Gemini Transcribe, then ElevenLabs alignment.
        align: async untimed => {
          saved = await saveCurrentProject({ narrationSource: untimed.source, audioNarration: untimed.compat, audioApproved: false, videoReady: false });
          if (!saved) throw new Error('Ses dosyası kaydedilemedi.');
          return narrationService.alignGeneratedNarration(saved.id);
        },
        transcribe: async upload =>
          localWhisperService.transcribeAudioLocally(await upload.arrayBuffer(), p =>
            setTranscribeProgress({ progress: p.progress, message: p.message }),
          ),
        onProgress: (progress, message) => setTranscribeProgress({ progress, message }),
      });
      const stored = saved as QuestionProject | null;
      // Recorded before any text was written: the solution text comes from the recording itself.
      const heard = currentProject.solutionText.trim() ? '' : transcriptText(result.source.words || []);
      updateCurrentProject({
        ...(stored
          ? withWordTimings(stored, result.source.words || [], result.source.timingSource || 'none')
          : { narrationSource: result.source, audioNarration: result.compat }),
        ...(heard ? { solutionText: heard } : {}),
        audioApproved: false,
        videoReady: false,
      });
      if (result.notice) setAudioError(result.notice);
      else if (heard) setAudioInfo('Çözüm metni sesinizden çıkarıldı. Doğru cevabı ve metni 2. adımda kontrol edebilirsiniz.');
      else if (!currentProject.solutionText.trim()) setAudioError('Sesinizden metin çıkarılamadı. İşaretler için 2. adımda çözüm metnini yazın.');
      setVideoGenerated(false);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Ses dosyası okunamadı.');
    } finally {
      setIsTranscribingMp3(false);
      setTranscribeProgress(null);
    }
  };

  // Delete audio
  const handleDeleteAudio = async () => {
    if (!await confirm({ title: 'Ses silinsin mi?', message: 'Bu sorunun sesi kaldırılır. Yeniden seslendirmek ses hakkı kullanır.', confirmLabel: 'Sesi sil', danger: true })) return;
    if (isAudioPlaying && stageAudioRef.current) {
      stageAudioRef.current.pause();
      setIsAudioPlaying(false);
    }
    updateCurrentProject({
      narrationSource: undefined,
      audioNarration: undefined,
      audioApproved: false,
      videoReady: false,
    });
    setVideoGenerated(false);
  };

  // Download real MP3 file
  const handleDownloadNarrationMp3 = () => {
    if (!activeAudioUrl) return;
    const source = currentProject.narrationSource;
    const extension = source?.mimeType?.includes('wav') ? 'wav' : 'mp3';
    const fallbackName = source?.type === 'uploaded' ? 'yuklenen_ses.mp3' : `${currentProject.title || 'soru'}_seslendirme.${extension}`;
    saveFile(activeAudioUrl, source?.fileName || fallbackName);
  };

  const handleApproveVoice = () => {
    const legacy = currentProject.audioNarration;
    // Projects from before narrationSource existed carry only the legacy copy.
    const source =
      currentProject.narrationSource ||
      (legacy && {
        type: legacy.modelId?.startsWith('gemini-') ? ('gemini' as const) : ('elevenlabs' as const),
        audioUrl: legacy.audioUrl,
        audioBase64: legacy.audioBase64,
        duration: legacy.duration,
        voiceId: legacy.voiceId,
        voiceName: legacy.voiceName,
        words: legacy.words,
        alignment: legacy.alignment,
      });
    if (!source) return;
    updateCurrentProject({
      audioApproved: true,
      narrationSource: { ...source, isApproved: true },
      audioNarration: legacy && { ...legacy, isApproved: true },
    });
  };

  const toggleStageAudio = () => {
    const audio = stageAudioRef.current;
    if (!audio) return;

    if (isAudioPlaying) {
      audio.pause();
      setIsAudioPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsAudioPlaying(true);
    }
  };

  // On Video Generation Pipeline Success
  const handleVideoPipelineSuccess = (result: LocalPipelineResult) => {
    updateCurrentProject(applyPipelineResult(currentProject, result));
    setVideoGenerated(true);
    setPreviewMode('video');
    setCurrentPreviewTime(0);
    setIsVideoModalOpen(false);
    setStep(3);
    setEditRegions(false);
  };

  // Handle direct MP4 Export & Download using local browser engine (1080p @ 30fps)
  const handleDownloadMp4 = async () => {
    if (isExportingMp4) return;
    setIsExportingMp4(true);
    setExportError(null);
    setIsPlayingPreview(false);
    exportAbortRef.current = new AbortController();
    setExportPercent(5);

    try {
      const videoBlob = await exportProjectVideo(currentProject, setExportPercent, exportAbortRef.current.signal);

      saveFile(videoBlob, videoFileName(currentProject));
      const { error: activityError } = await database().rpc('record_video_export', { project_id: currentProject.id });
      if (activityError) setExportError('Video indirildi; üretim kaydı kaydedilemedi.');
    } catch (err) {
      console.error('Local MP4 Export error:', err);
      setExportError(err instanceof Error ? err.message : 'Video oluşturulamadı.');
    } finally {
      setIsExportingMp4(false);
      setExportPercent(null);
    }
  };

  const hasImage = Boolean(currentProject.imageUrl);
  const hasSolution = Boolean(currentProject.solutionText && currentProject.solutionText.trim().length > 0);
  const hasAudio = Boolean(activeAudioUrl);
  const isAudioApproved = Boolean(
    currentProject.audioApproved || currentProject.narrationSource?.isApproved || currentProject.audioNarration?.isApproved,
  );
  const isUploadedAudio = currentProject.narrationSource?.type === 'uploaded';

  const handleAttemptCreateVideo = () => {
    if (!isAudioApproved) {
      setVideoButtonWarning('Video oluşturmak için önce bir seslendirme seçmelisiniz.');
      setTimeout(() => setVideoButtonWarning(null), 3500);
      return;
    }
    setIsVideoModalOpen(true);
  };

  const handleReadinessAction = (action: ReadinessAction) => {
    if (action === 'regenerate') {
      setIsVideoModalOpen(true);
      return;
    }
    if (action === 'text') {
      go(1);
      return;
    }
    setStep(3);
    setIsPlayingPreview(false);
    setEditRegions(action === 'regions');
    if (action === 'timing') setPreviewMode('video');
  };

  const check = checkNarration(currentProject.solutionText, currentProject.correctAnswer);
  const enabled = [true, hasImage, hasImage, isAudioApproved, videoGenerated && isAudioApproved];
  const busy = isGeneratingAudio || sampleBusy || isTranscribingMp3 || isExportingMp4;
  const go = (next: number) => {
    if (!busy && enabled[next]) {
      setStep(next);
      setIsPlayingPreview(false);
      if (stageAudioRef.current) stageAudioRef.current.pause();
      setIsAudioPlaying(false);
    }
  };
  return (
    <div className="studio-editor flex flex-col h-screen w-screen overflow-hidden bg-[#FAF9F5]">
      <header className="h-14 bg-white border-b border-[#E5E4DC] px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            title={busy ? 'İşlem sürerken çıkmadan önce size sorulur' : undefined}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#55544F] hover:text-[#1C1917] px-2.5 py-1.5 rounded hover:bg-[#F0EFEA] transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Sorularım</span>
          </button>

          <div className="h-4 w-px bg-[#E5E4DC]" />

          <span className="editor-brand">{APP_NAME}</span>
        </div>

        <h1 className="text-sm font-bold text-[#1C1917] tracking-tight hidden md:block">{currentProject.title || APP_NAME}</h1>

        <div className="flex items-center gap-2">
        <ReportProblem variant="compact" sender={user?.name} />
        <button
          type="button"
          onClick={handleSave}
          aria-label="Projeyi kaydet"
          className="px-4 py-1.5 rounded text-xs font-semibold bg-[#FAF9F5] border border-[#D5D4CC] text-[#1C1917] hover:bg-[#F0EFEA] transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          {saveStatus === 'saved' ? (
            <>
              <Check size={14} className="text-[#15803D]" />
              <span role="status" className="text-[#15803D]">
                Kaydedildi
              </span>
            </>
          ) : (
            <span>
              {{ saved: 'Kaydedildi', pending: 'Değişiklikler bekliyor', saving: 'Kaydediliyor…', error: 'Kaydı tekrar dene' }[saveStatus]}
            </span>
          )}
        </button>
        </div>
      </header>

      <nav className="workflow-nav" aria-label="Video hazırlama adımları">
        {steps.map((label, i) => (
          <button key={label} disabled={!enabled[i] || busy} aria-current={step === i ? 'step' : undefined} onClick={() => go(i)}>
            <span className="step-number">{i + 1}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {saveError && (
        <div role="alert" className="save-alert">
          {saveError} <button onClick={() => void handleSave()}>Tekrar kaydet</button>
        </div>
      )}
      <div className="editor-columns flex-1 flex min-h-0 overflow-hidden">
        <section className="editor-stage flex-[68] h-full bg-[#F7F6F0] border-r border-[#E5E4DC] p-6 pt-16 flex flex-col items-center overflow-y-auto relative">
          <EditorStage
            videoGenerated={videoGenerated}
            hasImage={hasImage}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            step={step}
            editRegions={editRegions}
            currentProject={currentProject}
            updateCurrentProject={updateCurrentProject}
            currentPreviewTime={currentPreviewTime}
            setCurrentPreviewTime={setCurrentPreviewTime}
            isPlayingPreview={isPlayingPreview}
            setIsPlayingPreview={setIsPlayingPreview}
            activeAudioDuration={activeAudioDuration}
            activeAudioUrl={activeAudioUrl}
            setIsVideoModalOpen={setIsVideoModalOpen}
            saveStatus={saveStatus}
            finishRegionEditing={finishRegionEditing}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            regionHistory={regionHistory}
            setRegionHistory={setRegionHistory}
          />
        </section>

        <aside className="editor-panel flex-[32] h-full bg-white overflow-y-auto p-6 flex flex-col space-y-6">
          <details hidden={step > 1} className="border rounded-lg p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Proje bilgileri</summary>
            <div className="space-y-3 pt-3">
              <label className="block">
                Proje adı
                <input
                  value={currentProject.title}
                  onChange={e => updateCurrentProject({ title: e.target.value })}
                  className="block w-full border rounded p-2"
                />
              </label>
              <label className="block">
                Kategori
                <select
                  className="block w-full border rounded p-2"
                  value={currentProject.category}
                  onChange={e => updateCurrentProject({ category: e.target.value })}
                >
                  {QUESTION_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Sınav / yıl
                <input
                  value={currentProject.examYear}
                  onChange={e => updateCurrentProject({ examYear: e.target.value })}
                  className="block w-full border rounded p-2"
                />
              </label>
              <label className="block">
                Koleksiyon / deneme adı
                <CollectionInput
                  placeholder="Örnek: Eylül Denemesi 1"
                  value={currentProject.examName || ''}
                  onChange={examName => updateCurrentProject({ examName })}
                  className="block w-full border rounded p-2"
                />
              </label>
            </div>
          </details>
          <ImageStep
            step={step}
            hasImage={hasImage}
            currentProject={currentProject}
            replaceImageInputRef={replaceImageInputRef}
            handleImageFile={handleImageFile}
            handleDeleteImage={handleDeleteImage}
          />
          <SolutionStep
            step={step}
            currentProject={currentProject}
            updateCurrentProject={updateCurrentProject}
            setVideoGenerated={setVideoGenerated}
            isGeneratingAudio={isGeneratingAudio}
            sampleBusy={sampleBusy}
          />
          <NarrationCheck step={step} check={check} currentProject={currentProject} />
          {step === 2 && (
            <VoiceSample text={currentProject.solutionText} disabled={isGeneratingAudio || isTranscribingMp3} onBusy={setSampleBusy} />
          )}
          <AudioStep
            step={step}
            hasAudio={hasAudio}
            hasSolution={hasSolution}
            isUploadedAudio={isUploadedAudio}
            isAudioApproved={isAudioApproved}
            currentProject={currentProject}
            isAudioPlaying={isAudioPlaying}
            toggleStageAudio={toggleStageAudio}
            audioPlayTime={audioPlayTime}
            setAudioPlayTime={setAudioPlayTime}
            activeAudioDuration={activeAudioDuration}
            activeAudioUrl={activeAudioUrl}
            stageAudioRef={stageAudioRef}
            uploadMp3InputRef={uploadMp3InputRef}
            handleDownloadNarrationMp3={handleDownloadNarrationMp3}
            handleUploadMp3File={handleUploadMp3File}
            handleDeleteAudio={handleDeleteAudio}
            handleGenerateAudio={handleGenerateAudio}
            handleApproveVoice={handleApproveVoice}
            isGeneratingAudio={isGeneratingAudio}
            sampleBusy={sampleBusy}
            isTranscribingMp3={isTranscribingMp3}
            transcribeProgress={transcribeProgress}
            audioError={audioError}
            audioInfo={audioInfo}
          />
          {step === 3 && (
            <section className="space-y-3">
              <h2>İşaretleri kontrol edin</h2>
              <p>
                {editRegions
                  ? 'Soldaki görselde kutuları düzenleyin; bitince önizlemeye dönün.'
                  : videoGenerated
                    ? 'İşaretler sesinize göre yerleştirildi. Önizlemeyi izleyin; kayan bir işaret varsa listeyi açıp düzeltin, yoksa indirmeye geçin.'
                    : 'Önce aşağıdaki düğmeyle sesinize uygun işaretleri hazırlayın.'}
              </p>
              {videoGenerated && !editRegions && (
                <SimpleTimingList
                  actions={currentProject.videoConfig.timelineActions || []}
                  regions={currentProject.videoConfig.regions || []}
                  duration={activeAudioDuration || 15}
                  currentTime={currentPreviewTime}
                  onUpdateActions={actions =>
                    updateCurrentProject({ videoConfig: { ...currentProject.videoConfig, timelineActions: actions } })
                  }
                  onSeek={setCurrentPreviewTime}
                  setPlaying={playing => {
                    if (playing) setPreviewMode('video');
                    setIsPlayingPreview(playing);
                  }}
                />
              )}
              {hasImage &&
                (editRegions ? (
                  <button className="studio-primary w-full" onClick={() => void finishRegionEditing()}>
                    Kaydet ve önizlemeye dön
                  </button>
                ) : (
                  <button className="studio-secondary w-full" onClick={() => setEditRegions(true)}>
                    Görseldeki kutuları düzenle
                  </button>
                ))}
            </section>
          )}
          <ExportStep
            step={step}
            videoGenerated={videoGenerated}
            currentProject={currentProject}
            handleReadinessAction={handleReadinessAction}
            exportError={exportError}
            isExportingMp4={isExportingMp4}
            exportAbortRef={exportAbortRef}
            handleDownloadMp4={handleDownloadMp4}
            exportPercent={exportPercent}
            setIsVideoModalOpen={setIsVideoModalOpen}
            handleAttemptCreateVideo={handleAttemptCreateVideo}
            isAudioApproved={isAudioApproved}
            videoButtonWarning={videoButtonWarning}
          />
          <footer className="workflow-footer">
            <p>
              {
                [
                  'Görseli yükleyin; özgün tasarımı videoda korunur.',
                  'Arapça ifadeleri harekeli yazın.',
                  'Sesi dinleyip “Bu Sesi Kullan” ile devam edin.',
                  'Kutuları ve zamanlamayı son kez kontrol edin.',
                  'MP4 bu tarayıcıda hazırlanır. İndirme bitene kadar sekmeyi açık tutun.',
                ][step]
              }
            </p>
            <div className="flex gap-2">
              {step > 0 && (
                <button className="studio-secondary" disabled={busy} onClick={() => go(step - 1)}>
                  Geri
                </button>
              )}
              {step < 4 && (
                <button className="studio-primary" disabled={busy || !enabled[step + 1]} onClick={() => go(step + 1)}>
                  {['Metne geç', 'Sese geç', 'İşaretlere geç', 'İndirmeye geç'][step]}
                </button>
              )}
            </div>
          </footer>
        </aside>
      </div>

      <VideoGenerationModal
        isOpen={isVideoModalOpen}
        project={currentProject}
        onClose={() => setIsVideoModalOpen(false)}
        onSuccess={handleVideoPipelineSuccess}
      />
    </div>
  );
};
