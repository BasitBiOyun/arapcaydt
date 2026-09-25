import {steps,resumeStep,checkNarration} from '../features/question-editor/workflow';
import {VoiceSample} from '../features/question-editor/VoiceSample';
import { database } from '../services/supabase';
import { applyRegionEdits } from '../services/analysis/regionEdits';
import React, { useState, useEffect, useRef } from 'react';
import { 
  QuestionProject, VideoConfig,
  AudioNarration, 
  NarrationSource 
} from '../types';
import { useProjects } from '../features/projects/ProjectContext';
import { VideoGenerationModal } from '../features/video/VideoGenerationModal';
import { LocalPipelineResult } from '../services/pipeline/localVideoPipeline';
import { localWhisperService } from '../services/whisper/localWhisperService';
import { elevenlabsService } from '../services/elevenlabs/elevenlabsService';
import { STANDARD_VOICE_CONFIG } from '../config/voice';
import { QUESTION_CATEGORIES } from '../config/categories';
import { VideoPreviewCanvas } from '../features/video/VideoPreviewCanvas';
import { videoExporter } from '../features/video/engine/exporter';
import { renderQuestionVideoFrame } from '../features/video/engine/renderer';
import { RegionEditorCanvas } from '../features/question-editor/RegionEditorCanvas';
import { EditableTimelineUI } from '../features/video/EditableTimelineUI';
import { 
  ArrowLeft, 
  Check, 
  UploadSimple, 
  Image as ImageIcon, 
  Play, 
  Pause, 
  ArrowsClockwise, 
  CheckCircle, 
  CircleNotch, 
  Sparkle, 
  DownloadSimple, 
  Trash,
  WarningCircle,
  FilmStrip,
  Microphone
} from '@phosphor-icons/react';

interface QuestionEditorPageProps {
  onBack: () => void;
}

export const QuestionEditorPage: React.FC<QuestionEditorPageProps> = ({ onBack }) => {
  const { currentProject, updateCurrentProject, saveCurrentProject, saveStatus, error:saveError } = useProjects();

  const [step,setStep]=useState(()=>currentProject?resumeStep(currentProject):0);
  const [editRegions,setEditRegions]=useState(false);
  const [regionHistory,setRegionHistory]=useState<VideoConfig[]>([]);
  const [sampleBusy,setSampleBusy]=useState(false);
  // Navigation & Save state

  // Audio generation state
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isTranscribingMp3, setIsTranscribingMp3] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ progress: number; message: string } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Audio preview playback in Step 3
  const [audioPlayTime, setAudioPlayTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const stageAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadMp3InputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);

  // Video generation & status
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoGenerated, setVideoGenerated] = useState(false);
  const [videoButtonWarning, setVideoButtonWarning] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'video' | 'image'>('image');

  // Video preview player state (HTML5 Canvas + Audio Sync)
  const [currentPreviewTime, setCurrentPreviewTime] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // MP4 Export state (MediaRecorder 1080p 30fps)
  const [isExportingMp4, setIsExportingMp4] = useState(false);
  const [exportPercent, setExportPercent] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  // Determine if video already exists for this project
  useEffect(() => {
    if (
      currentProject && currentProject.videoReady !== false &&
      (currentProject.videoReady ||
        (currentProject.videoConfig.timelineActions &&
          currentProject.videoConfig.timelineActions.length > 0))
    ) {
      setVideoGenerated(true);
      setPreviewMode('video');
    } else {
      setVideoGenerated(false);
      setPreviewMode('image');
    }
  }, [currentProject?.id]);

  // Audio playback updates
  const activeAudioUrl =
    currentProject?.narrationSource?.audioUrl ||
    currentProject?.audioNarration?.audioUrl ||
    '';
  const activeAudioDuration =
    currentProject?.narrationSource?.duration ||
    currentProject?.audioNarration?.duration ||
    0;

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

  if (!currentProject) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FAF9F5] text-xs text-[#787670]">
        Lütfen önce kontrol panelinden bir soru seçin.
      </div>
    );
  }

  // Handle Save
  const handleSave = async () => {
    const saved=await saveCurrentProject();
    if(!saved) {setAudioError('Kayıt tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.');return;}
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

  // Image File handlers
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      updateCurrentProject({
        imageUrl: dataUrl,
        imageFileName: file.name,
        videoConfig: {
          ...currentProject.videoConfig,
          regions: [],
          suppressedRegionIds: [],
          timelineActions: [],
        },
        videoReady: false,
      });
      setVideoGenerated(false);
      setPreviewMode('image');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = () => {
    updateCurrentProject({
      imageUrl: '',
      imageFileName: '',
      videoConfig: {
        ...currentProject.videoConfig,
        regions: [],
        suppressedRegionIds: [],
        timelineActions: [],
      },
      videoReady: false,
    });
    setVideoGenerated(false);
  };

  // Generate Audio via ElevenLabs standard voice configuration
  const handleGenerateAudio = async () => {
    if (!currentProject.solutionText || currentProject.solutionText.trim().length === 0) {
      setAudioError('Lütfen önce çözüm metnini yazın.');
      return;
    }

    setAudioError(null);
    setIsGeneratingAudio(true);

    try {
      if(!await saveCurrentProject())throw new Error('Önce proje kaydedilmelidir.');
      const result = await elevenlabsService.generateNarration({
        projectId: currentProject.id,
        text: currentProject.solutionText,
        voiceId: STANDARD_VOICE_CONFIG.voiceId,
        modelId: STANDARD_VOICE_CONFIG.modelId,
        outputFormat: STANDARD_VOICE_CONFIG.outputFormat,
        voiceSettings: STANDARD_VOICE_CONFIG.voiceSettings,
      });

      const audioUrl = `data:${result.mimeType};base64,${result.audioBase64}`;

      const newNarrationSource: NarrationSource = {
        type: 'elevenlabs',
        audioUrl,
        audioBase64: result.audioBase64,
        duration: result.durationSeconds,
        voiceId: STANDARD_VOICE_CONFIG.voiceId,
        voiceName: STANDARD_VOICE_CONFIG.name,
        words: result.words,
        alignment: result.alignment,
        isApproved: false,
        generatedAt: new Date().toISOString(),
      };

      const compatNarration: AudioNarration = {
        audioUrl,
        audioBase64: result.audioBase64,
        duration: result.durationSeconds,
        voiceId: STANDARD_VOICE_CONFIG.voiceId,
        voiceName: STANDARD_VOICE_CONFIG.name,
        modelId: STANDARD_VOICE_CONFIG.modelId,
        generatedAt: new Date().toISOString(),
        isApproved: false,
        mode: result.mode,
        words: result.words,
        alignment: result.alignment,
      };

      const persisted=await saveCurrentProject({
        narrationSource: newNarrationSource,
        audioNarration: compatNarration,
        status: 'audio_generated',
        audioApproved: false,
        videoReady: false,
      });
      if(!persisted)setAudioError('Ses üretildi ama kaydedilemedi. MP3 dosyasını indirip Kaydet düğmesini tekrar deneyin.');
      setVideoGenerated(false);
    } catch (err: any) {
      console.error('Audio generation error:', err);
      setAudioError(err instanceof Error ? err.message : 'Seslendirme oluşturulamadı.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Handle Uploaded MP3 file with local Whisper speech-to-text
  const handleUploadMp3File = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.mp3') && !file.type.includes('audio')) {
      setAudioError('Lütfen geçerli bir .mp3 dosyası seçin.');
      return;
    }
    setAudioError(null);
    setIsTranscribingMp3(true);
    setTranscribeProgress({ progress: 10, message: 'Ses dosyası taranıyor...' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Transcribe locally in browser with Whisper - zero external AI API calls!
      const transcription = await localWhisperService.transcribeAudioLocally(
        arrayBuffer,
        (p) => {
          setTranscribeProgress({ progress: p.progress, message: p.message });
        }
      );

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64Data = dataUrl.split(',')[1] || dataUrl;

        const uploadedSource: NarrationSource = {
          type: 'uploaded',
          audioUrl: dataUrl,
          audioBase64: base64Data,
          duration: transcription.duration,
          fileName: file.name,
          words: transcription.words, // Normalized word-level timestamps!
          isApproved: false,
          generatedAt: new Date().toISOString(),
        };

        const compatNarration: AudioNarration = {
          audioUrl: dataUrl,
          audioBase64: base64Data,
          duration: transcription.duration,
          voiceId: 'local-whisper',
          voiceName: file.name,
          modelId: 'whisper-tiny-local',
          generatedAt: new Date().toISOString(),
          isApproved: false,
          mode: 'live',
          words: transcription.words,
        };

        updateCurrentProject({
          narrationSource: uploadedSource,
          audioNarration: compatNarration,
          audioApproved: false,
          videoReady: false,
        });
        setVideoGenerated(false);
        setIsTranscribingMp3(false);
        setTranscribeProgress(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.warn('Local Whisper transcription notice:', err);
      // Fallback: still load audio file so teacher is never blocked
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const tempAudio = new Audio();
        tempAudio.src = dataUrl;
        tempAudio.onloadedmetadata = () => {
          const duration = tempAudio.duration || 15;
          const uploadedSource: NarrationSource = {
            type: 'uploaded',
            audioUrl: dataUrl,
            audioBase64: dataUrl.split(',')[1] || '',
            duration: Math.round(duration * 100) / 100,
            fileName: file.name,
            words: [],
            isApproved: false,
            generatedAt: new Date().toISOString(),
          };
          updateCurrentProject({
            narrationSource: uploadedSource,
            audioApproved: false,
            videoReady: false,
          });
          setVideoGenerated(false);
          setIsTranscribingMp3(false);
          setTranscribeProgress(null);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // Delete audio
  const handleDeleteAudio = () => {
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
    const a = document.createElement('a');
    a.href = activeAudioUrl;
    const isUploaded = currentProject.narrationSource?.type === 'uploaded';
    const fallbackName = isUploaded
      ? currentProject.narrationSource?.fileName || 'yuklenen_ses.mp3'
      : `${currentProject.title || 'soru'}_seslendirme.mp3`;
    a.download = fallbackName.endsWith('.mp3') ? fallbackName : `${fallbackName}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Approve Voice
  const handleApproveVoice = () => {
    const currentSource = currentProject.narrationSource || (currentProject.audioNarration ? {
      type: 'elevenlabs' as const,
      audioUrl: currentProject.audioNarration.audioUrl,
      audioBase64: currentProject.audioNarration.audioBase64,
      duration: currentProject.audioNarration.duration,
      voiceId: currentProject.audioNarration.voiceId,
      voiceName: currentProject.audioNarration.voiceName,
      words: currentProject.audioNarration.words,
      alignment: currentProject.audioNarration.alignment,
      isApproved: true,
    } : undefined);

    if (!currentSource) return;

    updateCurrentProject({
      audioApproved: true,
      narrationSource: {
        ...currentSource,
        isApproved: true,
      },
      audioNarration: currentProject.audioNarration ? {
        ...currentProject.audioNarration,
        isApproved: true,
      } : undefined,
    });
  };

  // Stage 3 Audio Toggle
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
    updateCurrentProject({
      videoConfig: {
        ...currentProject.videoConfig,
        regions: result.regions,
        timelineActions: result.actions,
        captions: result.captions,
        timingQuality: result.timingQuality,
        pipelineVersion: 4,
        warnings: result.warnings,
      },
      ...(result.deducedCorrectAnswer ? { correctAnswer: result.deducedCorrectAnswer } : {}),
      status: 'video_ready',
      videoReady: true,
    });
    setVideoGenerated(true);
    setPreviewMode('video');
    setCurrentPreviewTime(0);
    setIsVideoModalOpen(false);
    setStep(3);setEditRegions(false);
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
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Soru görseli yüklenemedi.'));
        img.src = currentProject.imageUrl;
      });

      const duration = currentProject.narrationSource?.duration || currentProject.audioNarration?.duration || 15;
      const audioUrl = activeAudioUrl;

      const videoBlob = await videoExporter.exportVideo(
        (ctx, time) => {
          renderQuestionVideoFrame(
            ctx,
            ctx.canvas.width,
            ctx.canvas.height,
            img,
            currentProject.videoConfig.regions,
            currentProject.videoConfig.timelineActions,
            time,
            {
              width: 1920,
              height: 1080,
              aspectRatio: currentProject.videoConfig.aspectRatio || '16:9',
              showWatermark: currentProject.videoConfig.showWatermark,
              teacherTag: currentProject.videoConfig.teacherTag || 'Arapça YDT • Video Stüdyosu',
              captions: currentProject.videoConfig.captions,
              showCaptions: currentProject.videoConfig.showCaptions,
              captionY: currentProject.videoConfig.captionY,
            }
          );
        },
        audioUrl,
        duration,
        {
          resolution: '1080p',
          fps: 30,
          format: 'mp4',
          aspectRatio: (currentProject.videoConfig?.aspectRatio || '16:9') as '16:9' | '9:16',
        },
        (progress) => {
          setExportPercent(progress.percent);
        },
        exportAbortRef.current.signal
      );

      // Download file to teacher's computer
      const blobUrl = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanTitle = (currentProject.title || 'ydt_soru_cozumu').replace(/[^a-zA-Z0-9_\u0600-\u06FF\u00C0-\u017F-]/g, '_');
      a.download = `${cleanTitle}_1080p.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      const {error:activityError}=await database().rpc('record_video_export',{project_id:currentProject.id});
      if(activityError)setExportError('Video indirildi; üretim kaydı kaydedilemedi.');
    } catch (err) {
      console.error('Local MP4 Export error:', err);
      setExportError(err instanceof Error ? err.message : 'Video oluşturulamadı.');
    } finally {
      setIsExportingMp4(false);
      setExportPercent(null);
    }
  };

  // Helper formatting for time MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const hasImage = Boolean(currentProject.imageUrl);
  const hasSolution = Boolean(currentProject.solutionText && currentProject.solutionText.trim().length > 0);
  const hasAudio = Boolean(activeAudioUrl);
  const isAudioApproved = Boolean(
    currentProject.audioApproved ||
    currentProject.narrationSource?.isApproved ||
    currentProject.audioNarration?.isApproved
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

  const check=checkNarration(currentProject.solutionText,currentProject.correctAnswer);
  const enabled=[true,hasImage,hasImage&&hasSolution,isAudioApproved,videoGenerated&&isAudioApproved];
  const busy=isGeneratingAudio||sampleBusy||isTranscribingMp3||isExportingMp4;
  const go=(next:number)=>{if(!busy&&enabled[next]){setStep(next);setIsPlayingPreview(false);if(stageAudioRef.current)stageAudioRef.current.pause();setIsAudioPlaying(false);}};
  return (
    <div className="studio-editor flex flex-col h-screen w-screen overflow-hidden bg-[#FAF9F5]">
      {/* TOP BAR */}
      <header className="h-14 bg-white border-b border-[#E5E4DC] px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={()=>{if(!busy)onBack();}}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#55544F] hover:text-[#1C1917] px-2.5 py-1.5 rounded hover:bg-[#F0EFEA] transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Sorularım</span>
          </button>

          <div className="h-4 w-px bg-[#E5E4DC]" />

          <span className="editor-brand">Arapça YDT Stüdyosu</span>
        </div>

        <h1 className="text-sm font-bold text-[#1C1917] tracking-tight hidden md:block">
          {currentProject.title || 'Arapça YDT Stüdyosu'}
        </h1>

        <button
          type="button"
          onClick={handleSave} aria-label="Projeyi kaydet"
          className="px-4 py-1.5 rounded text-xs font-semibold bg-[#FAF9F5] border border-[#D5D4CC] text-[#1C1917] hover:bg-[#F0EFEA] transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          {saveStatus==='saved' ? (
            <>
              <Check size={14} className="text-[#15803D]" />
              <span role="status" className="text-[#15803D]">Kaydedildi</span>
            </>
          ) : (
            <span>{({saved:'Kaydedildi',pending:'Değişiklikler bekliyor',saving:'Kaydediliyor…',error:'Kaydı tekrar dene'})[saveStatus]}</span>
          )}
        </button>
      </header>

      <nav className="workflow-nav" aria-label="Video hazırlama adımları">{steps.map((label,i)=><button key={label} disabled={!enabled[i]||busy} aria-current={step===i?'step':undefined} onClick={()=>go(i)}><span className="step-number">{i+1}</span><span>{label}</span></button>)}</nav>
      {saveError&&<div role="alert" className="save-alert">{saveError} <button onClick={()=>void handleSave()}>Tekrar kaydet</button></div>}
      {/* TWO MAIN COLUMNS */}
      <div className="editor-columns flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT COLUMN: ~68% Large Visual / Video Preview */}
        <section className="editor-stage flex-[68] h-full bg-[#F7F6F0] border-r border-[#E5E4DC] p-6 pt-16 flex flex-col items-center overflow-y-auto relative">
          {/* Preview Mode Switcher (if video generated and image exists) */}
          {videoGenerated && hasImage && (
            <div className="absolute top-4 left-6 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-[#E5E4DC] shadow-xs">
              <button
                type="button"
                onClick={() => setPreviewMode('video')}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  previewMode === 'video'
                    ? 'bg-[#8B1E2D] text-white shadow-xs'
                    : 'text-[#55544F] hover:text-[#1C1917]'
                }`}
              >
                <FilmStrip size={14} weight="bold" />
                <span>Video Önizleme</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('image')}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  previewMode === 'image'
                    ? 'bg-[#8B1E2D] text-white shadow-xs'
                    : 'text-[#55544F] hover:text-[#1C1917]'
                }`}
              >
                <ImageIcon size={14} weight="bold" />
                <span>Soru Görseli</span>
              </button>
            </div>
          )}

          <div className="preview-content" hidden={step===3&&editRegions}>
          {previewMode === 'video' && videoGenerated ? (
            /* Generated Video Player powered by local Canvas engine */
            <div className="w-full max-w-4xl flex flex-col gap-4 p-4">
              <VideoPreviewCanvas
                imageUrl={currentProject.imageUrl}
                regions={currentProject.videoConfig.regions}
                actions={currentProject.videoConfig.timelineActions}
                currentTime={currentPreviewTime}
                duration={activeAudioDuration || 15}
                isPlaying={isPlayingPreview}
                onPlayPause={() => setIsPlayingPreview(!isPlayingPreview)}
                onSeek={(t) => setCurrentPreviewTime(t)}
                videoConfig={currentProject.videoConfig}
                audioUrl={activeAudioUrl}
              />
              <div className="flex gap-2 items-center text-xs">
                <label className="flex gap-2 items-center">
                <input type="checkbox" checked={currentProject.videoConfig.showCaptions !== false}
                  onChange={e => updateCurrentProject({ videoConfig: { ...currentProject.videoConfig, showCaptions: e.target.checked } })} />
                Altyazıları göster
                </label>
                <input aria-label="Altyazı yüksekliği" type="range" min="0.08" max="0.93" step="0.01"
                  value={currentProject.videoConfig.captionY ?? .85}
                  onChange={e => updateCurrentProject({ videoConfig: { ...currentProject.videoConfig, captionY: Number(e.target.value) } })} />
                Altyazı konumu
              </div>

              <details open={step===3&&!editRegions} hidden={step!==3} className="w-full text-xs bg-white rounded-lg p-3 border">
                <summary className="cursor-pointer font-semibold">İşaretlerin zamanlamasını düzenle</summary>
                <EditableTimelineUI duration={activeAudioDuration} currentTime={currentPreviewTime} isPlaying={isPlayingPreview}
                  onPlayPause={() => setIsPlayingPreview(!isPlayingPreview)} onSeek={setCurrentPreviewTime}
                  regions={currentProject.videoConfig.regions || []} actions={currentProject.videoConfig.timelineActions || []}
                  onUpdateActions={actions => updateCurrentProject({ videoConfig: { ...currentProject.videoConfig, timelineActions: actions } })}
                  onRequestAutoGenerate={() => setIsVideoModalOpen(true)} />
              </details>
            </div>
          ) : hasImage ? (
            /* Large, high-clarity question image preview */
            <div className="w-full flex items-center justify-center">
              <img
                src={currentProject.imageUrl}
                alt="Soru Görseli"
                className="max-h-[calc(100vh-16rem)] max-w-full object-contain rounded-lg border border-[#E5E4DC] bg-white shadow-xs p-2"
              />
            </div>
          ) : (
            /* Initial placeholder */
            <div className="flex flex-col items-center justify-center text-center p-8 max-w-md text-[#8C8A82]">
              <div className="w-16 h-16 rounded-full bg-[#FAF9F5] border border-[#D5D4CC] flex items-center justify-center mb-3 text-[#A8A69E]">
                <ImageIcon size={32} />
              </div>
              <p className="text-xs font-medium text-[#55544F]">
                Soru görseli henüz yüklenmedi
              </p>
              <p className="text-[11px] text-[#8C8A82] mt-1">
                Sağdaki panelden görseli yüklediğinizde burada net ve büyük boyutta görüntülenecektir.
              </p>
            </div>
          )}
          </div>
          {hasImage && step===3 && editRegions && <section className="w-full max-w-4xl shrink-0 text-xs bg-white rounded-xl p-3 border border-[#D5D4CC] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[#E5E4DC]">
              <div>
                <h3 className="font-semibold text-[#1C1917]">Görsel işaretleri düzenle</h3>
                <p className="text-[11px] text-[#787670] mt-0.5">Kutuları, kelime vurgularını ve temel animasyonları doğrudan soru üzerinde düzenleyin.</p>
              </div>
              <div className="flex items-center gap-2">
                <span role="status" className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${
                  saveStatus==='saved'
                    ? 'bg-[#EFF7F0] border-[#C5DAC8] text-[#1E562A]'
                    : saveStatus==='error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-[#FFF7ED] border-[#F1D7AF] text-[#8A5A12]'
                }`}>
                  {({saved:'Kaydedildi',pending:'Değişiklikler bekliyor',saving:'Kaydediliyor…',error:'Kayıt hatası'})[saveStatus]}
                </span>
                <button type="button" onClick={()=>void finishRegionEditing()}
                  className="px-3 py-2 rounded-lg bg-[#1C1917] hover:bg-[#33312E] text-white text-[11px] font-semibold transition-colors cursor-pointer">
                  Düzenlemeyi Bitir ve Önizlemeye Dön
                </button>
              </div>
            </div>
            <RegionEditorCanvas imageUrl={currentProject.imageUrl} regions={currentProject.videoConfig.regions || []}
              solutionText={currentProject.solutionText}
              currentTime={currentPreviewTime}
              audioDuration={activeAudioDuration || 15}
              actions={currentProject.videoConfig.timelineActions || []}
              onUpdateActions={actions=>updateCurrentProject({videoConfig:{...currentProject.videoConfig,timelineActions:actions}})}
              selectedRegionId={selectedRegionId} onSelectRegion={setSelectedRegionId}
              canUndo={regionHistory.length>0} onUndo={()=>{const previous=regionHistory.at(-1);if(previous){updateCurrentProject({videoConfig:previous});setRegionHistory(regionHistory.slice(0,-1));}}}
              onUpdateRegions={regions => {setRegionHistory(h=>[...h.slice(-29),currentProject.videoConfig]);updateCurrentProject({ videoConfig: applyRegionEdits(
                currentProject.videoConfig, regions, currentProject.solutionText,
                currentProject.narrationSource?.words || currentProject.audioNarration?.words || [], activeAudioDuration || 15
              ) });}} />
          </section>}
        </section>

        {/* RIGHT COLUMN: ~32% Progressive 4-Step Workflow Panel */}
        <aside className="editor-panel flex-[32] h-full bg-white overflow-y-auto p-6 flex flex-col space-y-6">
          <details hidden={step>1} className="border rounded-lg p-3 text-sm"><summary className="cursor-pointer font-semibold">Proje bilgileri</summary><div className="space-y-3 pt-3"><label className="block">Proje adı<input value={currentProject.title} onChange={e=>updateCurrentProject({title:e.target.value})} className="block w-full border rounded p-2"/></label><label className="block">Kategori<select className="block w-full border rounded p-2" value={currentProject.category} onChange={e=>updateCurrentProject({category:e.target.value})}>{QUESTION_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label className="block">Sınav / yıl<input value={currentProject.examYear} onChange={e=>updateCurrentProject({examYear:e.target.value})} className="block w-full border rounded p-2"/></label>{<label className="block">Koleksiyon / deneme adı<input placeholder="Örnek: Eylül Denemesi 1" value={currentProject.examName||''} onChange={e=>updateCurrentProject({examName:e.target.value})} className="block w-full border rounded p-2"/></label>}</div></details>
          {/* STEP 1: Soru Görseli */}
          <div hidden={step!==0} className="space-y-2.5">
            <h2 className="text-xs font-bold text-[#1C1917] tracking-tight">
              1. Soru Görseli
            </h2>

            {hasImage ? (
              <div className="p-3 rounded-lg border border-[#E5E4DC] bg-[#FAF9F5] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded border border-[#D5D4CC] overflow-hidden bg-white shrink-0">
                    <img
                      src={currentProject.imageUrl}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                      <CheckCircle size={15} weight="fill" />
                      <span className="truncate">{currentProject.imageFileName || 'Soru Görseli'}</span>
                    </div>
                    <div className="text-[11px] text-[#787670]">
                      YDT Soru Görseli
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="px-2.5 py-1 text-[11px] font-semibold text-[#55544F] hover:text-[#1C1917] bg-white border border-[#D5D4CC] rounded hover:bg-[#F0EFEA] cursor-pointer transition-colors">
                    Görseli Değiştir
                    <input
                      ref={replaceImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleDeleteImage}
                    title="Görseli Sil"
                    className="p-1.5 text-[#787670] hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
                }}
                className="w-full py-8 border-2 border-dashed border-[#D5D4CC] hover:border-[#8B1E2D] rounded-xl flex flex-col items-center justify-center cursor-pointer bg-[#FAF9F5] hover:bg-white transition-all text-center p-4 group"
              >
                <div className="w-10 h-10 rounded-full bg-white border border-[#D5D4CC] group-hover:border-[#8B1E2D] flex items-center justify-center text-[#787670] group-hover:text-[#8B1E2D] mb-2 transition-colors">
                  <UploadSimple size={20} />
                </div>
                <span className="text-xs font-semibold text-[#1C1917]">
                  PNG veya JPG yükle
                </span>
                <span className="text-[11px] text-[#787670] mt-0.5">
                  Soru görselini sürükleyin veya tıklayın
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                  }}
                />
              </label>
            )}
          </div>

          {/* STEP 2: Çözüm Metni */}
          <div hidden={step!==1} className="space-y-2.5">
            <h2 className="text-xs font-bold text-[#1C1917] tracking-tight">
              Çözüm metnini hazırlayın
            </h2>
            <label className="flex items-center gap-3">Doğru cevap<select className="border rounded px-3 py-2" value={currentProject.correctAnswer} onChange={e=>{updateCurrentProject({correctAnswer:e.target.value as QuestionProject['correctAnswer'],videoReady:false});setVideoGenerated(false);}}>{['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}</select></label>
            <textarea
              aria-label="Çözüm metni"
              disabled={isGeneratingAudio || sampleBusy}
              value={currentProject.solutionText}
              onChange={(e) => {
                updateCurrentProject({
                  solutionText: e.target.value,
                  audioApproved: false,
                  narrationSource: currentProject.narrationSource ? {...currentProject.narrationSource,isApproved:false} : undefined,
                  audioNarration: currentProject.audioNarration ? {...currentProject.audioNarration,isApproved:false} : undefined,
                  videoReady: false,
                });
                setVideoGenerated(false);
              }}
              placeholder="Sorunun çözümünü buraya yazın..."
              rows={12}
              dir="auto"
              className="w-full p-3.5 rounded-lg border border-[#D5D4CC] focus:border-[#8B1E2D] focus:ring-1 focus:ring-[#8B1E2D] text-xs text-[#1C1917] leading-relaxed bg-white outline-none resize-y placeholder:text-[#A8A69E]"
            />
          </div>

          {(step===1||step===2)&&<section className="narration-check" aria-label="Ses ön kontrolü"><strong>{check.characters.toLocaleString('tr')} / 5.000 karakter</strong><p>Doğru cevap: {currentProject.correctAnswer}. Ses üretimi ElevenLabs kotasından tüketir.</p>{check.characters>5000&&<p role="alert">Tek ses için metni 5.000 karakterin altına kısaltın.</p>}{check.missing.length>0&&<p>Metinde şık başlığı bulunamadı: {check.missing.join(', ')}. Açıklamalarınızı kontrol edin.</p>}{check.mismatch&&<p role="alert">Metin {check.mismatch} diyor; seçili cevap {currentProject.correctAnswer}. Ses üretmeden önce düzeltin.</p>}</section>}
          {step===2&&<VoiceSample text={currentProject.solutionText} disabled={isGeneratingAudio||isTranscribingMp3} onBusy={setSampleBusy}/>}
          {/* STEP 3: Seslendirme */}
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

          {step===3&&<section className="space-y-3"><h2>İşaretleri kontrol edin</h2><p>Önizlemeyi dinleyin. Gerekirse görsel üzerindeki alanları veya işaretlerin zamanını düzeltin.</p><div className="flex flex-wrap gap-2"><button className="studio-secondary" aria-pressed={editRegions} onClick={()=>setEditRegions(true)}>Görseli düzenle</button><button className="studio-secondary" disabled={!videoGenerated} aria-pressed={!editRegions} onClick={()=>{setEditRegions(false);setPreviewMode('video');}}>Zamanlamayı düzenle</button></div>{!videoGenerated&&<p>Önce aşağıdaki düğmeyle mevcut sesinize uygun işaretleri hazırlayın.</p>}</section>}
          {/* STEP 4: Video Oluştur */}
          <div hidden={step<3} className="space-y-3 pt-2 border-t border-[#E5E4DC]">
            <h2 className="text-xs font-bold text-[#1C1917] tracking-tight">
              {step===4?'Videonuzu indirin':'Animasyon önizlemesi'}
            </h2>

            {videoGenerated ? (
              /* Completed Video State: single clear download action + Yeniden Oluştur */
              <div className="p-4 rounded-xl border border-[#C5DAC8] bg-[#F4F9F5] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#15803D]">
                  <CheckCircle size={18} weight="fill" />
                  <span>Animasyon önizlemesi hazır</span>
                </div>

                <div className="space-y-2">
                  {(currentProject.videoConfig.pipelineVersion !== 4) && <p className="text-xs text-amber-800">Bu soru eski animasyon planını kullanıyor. Düzeltmeleri uygulamak için Yeniden Oluştur'a basın.</p>}
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
                    onClick={() => setIsVideoModalOpen(true)}
                    className="text-[11px] font-semibold text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer"
                  >
                    Yeniden Oluştur
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
          <footer className="workflow-footer"><p>{['Görseli yükleyin; özgün tasarımı videoda korunur.','Arapça ifadeleri harekeli yazın.','Sesi dinleyip “Bu Sesi Kullan” ile devam edin.','Kutuları ve zamanlamayı son kez kontrol edin.','MP4 bu tarayıcıda hazırlanır. İndirme bitene kadar sekmeyi açık tutun.'][step]}</p><div className="flex gap-2">{step>0&&<button className="studio-secondary" disabled={busy} onClick={()=>go(step-1)}>Geri</button>}{step<4&&<button className="studio-primary" disabled={busy||!enabled[step+1]} onClick={()=>go(step+1)}>{['Metne geç','Sese geç','İşaretlere geç','İndirmeye geç'][step]}</button>}</div></footer>
        </aside>
      </div>

      {/* Video Generation Pipeline Modal */}
      <VideoGenerationModal
        isOpen={isVideoModalOpen}
        project={currentProject}
        onClose={() => setIsVideoModalOpen(false)}
        onSuccess={handleVideoPipelineSuccess}
      />
    </div>
  );
};

