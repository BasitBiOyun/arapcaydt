import {steps,resumeStep,checkNarration} from '../features/question-editor/workflow';
import {VoiceSample} from '../features/question-editor/VoiceSample';
import {type ReadinessAction} from '../features/question-editor/readiness';
import {applyPipelineResult, narrationFromTts} from '../features/question-editor/projectUpdates';
import { database } from '../services/supabase';
import React, { useState, useEffect, useRef } from 'react';
import { QuestionProject, VideoConfig } from '../types';
import { useProjects } from '../features/projects/ProjectContext';
import { VideoGenerationModal } from '../features/video/VideoGenerationModal';
import { LocalPipelineResult } from '../services/pipeline/localVideoPipeline';
import { localWhisperService } from '../services/whisper/localWhisperService';
import { localOcrService } from '../services/ocr/localOcrService';
import { prepareUploadedNarration } from '../services/narration/uploadedNarration';
import { readDataUrl, readAudioDuration } from '../services/narration/browserMedia';
import { elevenlabsService } from '../services/elevenlabs/elevenlabsService';
import { narrationService } from '../services/narration/narrationService';
import { STANDARD_VOICE_CONFIG } from '../config/voice';
import { QUESTION_CATEGORIES } from '../config/categories';
import { exportProjectVideo, videoFileName } from '../features/video/exportProjectVideo';
import { ExportStep } from '../features/question-editor/steps/ExportStep';
import { AudioStep } from '../features/question-editor/steps/AudioStep';
import { NarrationCheck } from '../features/question-editor/steps/NarrationCheck';
import { SolutionStep } from '../features/question-editor/steps/SolutionStep';
import { EditorStage } from '../features/question-editor/steps/EditorStage';
import { ImageStep } from '../features/question-editor/steps/ImageStep';
import { ArrowLeft, Check } from '@phosphor-icons/react';

function hasAnimationPlan(project: QuestionProject | null | undefined) {
  return Boolean(project && project.videoReady !== false &&
    (project.videoReady || (project.videoConfig.timelineActions && project.videoConfig.timelineActions.length > 0)));
}

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
  const [videoGenerated, setVideoGenerated] = useState(() => hasAnimationPlan(currentProject));
  const [videoButtonWarning, setVideoButtonWarning] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'video' | 'image'>(() => hasAnimationPlan(currentProject) ? 'video' : 'image');

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
    return () => { if (idle) (window as any).cancelIdleCallback?.(handle); else window.clearTimeout(handle); };
  }, [needsOcrSoon]);

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

  // Generate audio with Gemini free-tier TTS first; ElevenLabs remains the automatic fallback.
  const handleGenerateAudio = async () => {
    if (!currentProject.solutionText || currentProject.solutionText.trim().length === 0) {
      setAudioError('Lütfen önce çözüm metnini yazın.');
      return;
    }

    setAudioError(null);
    setIsGeneratingAudio(true);

    try {
      if(!await saveCurrentProject())throw new Error('Önce proje kaydedilmelidir.');
      const result = await narrationService.generateNarration({
        projectId: currentProject.id,
        text: currentProject.solutionText,
        voiceId: STANDARD_VOICE_CONFIG.voiceId,
        modelId: STANDARD_VOICE_CONFIG.modelId,
        outputFormat: STANDARD_VOICE_CONFIG.outputFormat,
      });

      const { narrationSource: newNarrationSource, audioNarration: compatNarration } = narrationFromTts(result);

      const persisted=await saveCurrentProject({
        narrationSource: newNarrationSource,
        audioNarration: compatNarration,
        status: 'audio_generated',
        audioApproved: false,
        videoReady: false,
      });
      if(!persisted) {
        setAudioError('Ses üretildi ama kaydedilemedi. Ses dosyasını indirip Kaydet düğmesini tekrar deneyin.');
      } else if (result.provider === 'gemini') {
        try {
          const alignment = await narrationService.alignGeneratedNarration(persisted.id);
          if (alignment.words.length) {
            await saveCurrentProject({
              narrationSource: persisted.narrationSource ? {
                ...persisted.narrationSource,
                words: alignment.words,
                timingSource: alignment.timingSource,
              } : persisted.narrationSource,
              audioNarration: persisted.audioNarration ? {
                ...persisted.audioNarration,
                words: alignment.words,
                wordAlignments: alignment.words.map(word => ({ word: word.text, start: word.start, end: word.end })),
              } : persisted.audioNarration,
            });
          }
        } catch (exactAlignError) {
          console.warn('Exact server alignment unavailable; trying local Whisper:', exactAlignError);
          try {
            const audioUrl = persisted.narrationSource?.audioUrl || persisted.audioNarration?.audioUrl;
            if (!audioUrl) throw new Error('Ses dosyası bağlantısı bulunamadı.');
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) throw new Error(`Ses dosyası indirilemedi (HTTP ${audioResponse.status}).`);
            const local = await localWhisperService.transcribeAudioLocally(await audioResponse.arrayBuffer());
            if (!local.words.length) throw new Error('Whisper kelime zaman damgası döndürmedi.');
            await saveCurrentProject({
              narrationSource: persisted.narrationSource ? {
                ...persisted.narrationSource,
                words: local.words,
                timingSource: 'whisper',
              } : persisted.narrationSource,
              audioNarration: persisted.audioNarration ? {
                ...persisted.audioNarration,
                words: local.words,
                wordAlignments: local.words.map(word => ({ word: word.text, start: word.start, end: word.end })),
              } : persisted.audioNarration,
            });
          } catch (localAlignError) {
            console.warn('Local Whisper timing unavailable:', localAlignError);
            setAudioError('Ses oluşturuldu ancak kelime zamanları alınamadı. Animasyon yaklaşık zamanlamayla hazırlanır; işaretleri kontrol edin.');
          }
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
    setIsTranscribingMp3(true);
    setTranscribeProgress({ progress: 10, message: 'Ses dosyası taranıyor...' });
    try {
      const text = currentProject.solutionText.trim();
      // The server reserves usage against the saved project, so save before aligning.
      const canAlign = text.length > 0 && text.length <= 5000 && await saveCurrentProject();
      const result = await prepareUploadedNarration(file, {
        readDataUrl, readDuration: readAudioDuration,
        align: canAlign ? (audioBase64, mimeType) =>
          elevenlabsService.alignUploadedNarration({ projectId: currentProject.id, text, audioBase64, mimeType }) : undefined,
        transcribe: async upload => localWhisperService.transcribeAudioLocally(await upload.arrayBuffer(),
          p => setTranscribeProgress({ progress: p.progress, message: p.message })),
        onProgress: (progress, message) => setTranscribeProgress({ progress, message }),
      });
      updateCurrentProject({
        narrationSource: result.source,
        audioNarration: result.compat,
        audioApproved: false,
        videoReady: false,
      });
      if (result.notice) setAudioError(result.notice);
      setVideoGenerated(false);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Ses dosyası okunamadı.');
    } finally {
      setIsTranscribingMp3(false);
      setTranscribeProgress(null);
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
    const generatedExtension = currentProject.narrationSource?.mimeType?.includes('wav') ? 'wav' : 'mp3';
    const fallbackName = isUploaded
      ? currentProject.narrationSource?.fileName || 'yuklenen_ses.mp3'
      : currentProject.narrationSource?.fileName || `${currentProject.title || 'soru'}_seslendirme.${generatedExtension}`;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Approve Voice
  const handleApproveVoice = () => {
    const currentSource = currentProject.narrationSource || (currentProject.audioNarration ? {
      type: currentProject.audioNarration.modelId?.startsWith('gemini-') ? 'gemini' as const : 'elevenlabs' as const,
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
    updateCurrentProject(applyPipelineResult(currentProject, result));
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
      const videoBlob = await exportProjectVideo(currentProject, setExportPercent, exportAbortRef.current.signal);

      // Download file to teacher's computer
      const blobUrl = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = videoFileName(currentProject);
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

  const handleReadinessAction = (action: ReadinessAction) => {
    if (action === 'regenerate') { setIsVideoModalOpen(true); return; }
    if (action === 'text') { go(1); return; }
    setStep(3);
    setIsPlayingPreview(false);
    setEditRegions(action === 'regions');
    if (action === 'timing') setPreviewMode('video');
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
          <EditorStage videoGenerated={videoGenerated} hasImage={hasImage} previewMode={previewMode} setPreviewMode={setPreviewMode} step={step} editRegions={editRegions} currentProject={currentProject} updateCurrentProject={updateCurrentProject} currentPreviewTime={currentPreviewTime} setCurrentPreviewTime={setCurrentPreviewTime} isPlayingPreview={isPlayingPreview} setIsPlayingPreview={setIsPlayingPreview} activeAudioDuration={activeAudioDuration} activeAudioUrl={activeAudioUrl} setIsVideoModalOpen={setIsVideoModalOpen} saveStatus={saveStatus} finishRegionEditing={finishRegionEditing} selectedRegionId={selectedRegionId} setSelectedRegionId={setSelectedRegionId} regionHistory={regionHistory} setRegionHistory={setRegionHistory} />
        </section>

        {/* RIGHT COLUMN: ~32% Progressive 4-Step Workflow Panel */}
        <aside className="editor-panel flex-[32] h-full bg-white overflow-y-auto p-6 flex flex-col space-y-6">
          <details hidden={step>1} className="border rounded-lg p-3 text-sm"><summary className="cursor-pointer font-semibold">Proje bilgileri</summary><div className="space-y-3 pt-3"><label className="block">Proje adı<input value={currentProject.title} onChange={e=>updateCurrentProject({title:e.target.value})} className="block w-full border rounded p-2"/></label><label className="block">Kategori<select className="block w-full border rounded p-2" value={currentProject.category} onChange={e=>updateCurrentProject({category:e.target.value})}>{QUESTION_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label className="block">Sınav / yıl<input value={currentProject.examYear} onChange={e=>updateCurrentProject({examYear:e.target.value})} className="block w-full border rounded p-2"/></label>{<label className="block">Koleksiyon / deneme adı<input placeholder="Örnek: Eylül Denemesi 1" value={currentProject.examName||''} onChange={e=>updateCurrentProject({examName:e.target.value})} className="block w-full border rounded p-2"/></label>}</div></details>
          <ImageStep step={step} hasImage={hasImage} currentProject={currentProject} replaceImageInputRef={replaceImageInputRef} handleImageFile={handleImageFile} handleDeleteImage={handleDeleteImage} />
          <SolutionStep step={step} currentProject={currentProject} updateCurrentProject={updateCurrentProject} setVideoGenerated={setVideoGenerated} isGeneratingAudio={isGeneratingAudio} sampleBusy={sampleBusy} />
          <NarrationCheck step={step} check={check} currentProject={currentProject} />
          {step===2&&<VoiceSample text={currentProject.solutionText} disabled={isGeneratingAudio||isTranscribingMp3} onBusy={setSampleBusy}/>}
          <AudioStep step={step} hasAudio={hasAudio} hasSolution={hasSolution} isUploadedAudio={isUploadedAudio} isAudioApproved={isAudioApproved} currentProject={currentProject} isAudioPlaying={isAudioPlaying} toggleStageAudio={toggleStageAudio} formatTime={formatTime} audioPlayTime={audioPlayTime} setAudioPlayTime={setAudioPlayTime} activeAudioDuration={activeAudioDuration} activeAudioUrl={activeAudioUrl} stageAudioRef={stageAudioRef} uploadMp3InputRef={uploadMp3InputRef} handleDownloadNarrationMp3={handleDownloadNarrationMp3} handleUploadMp3File={handleUploadMp3File} handleDeleteAudio={handleDeleteAudio} handleGenerateAudio={handleGenerateAudio} handleApproveVoice={handleApproveVoice} isGeneratingAudio={isGeneratingAudio} sampleBusy={sampleBusy} isTranscribingMp3={isTranscribingMp3} transcribeProgress={transcribeProgress} audioError={audioError} />
          {step===3&&<section className="space-y-3"><h2>İşaretleri kontrol edin</h2><p>Önizlemeyi dinleyin. Gerekirse görsel üzerindeki alanları veya işaretlerin zamanını düzeltin.</p><div className="flex flex-wrap gap-2"><button className="studio-secondary" aria-pressed={editRegions} onClick={()=>setEditRegions(true)}>Görseli düzenle</button><button className="studio-secondary" disabled={!videoGenerated} aria-pressed={!editRegions} onClick={()=>{setEditRegions(false);setPreviewMode('video');}}>Zamanlamayı düzenle</button></div>{!videoGenerated&&<p>Önce aşağıdaki düğmeyle mevcut sesinize uygun işaretleri hazırlayın.</p>}</section>}
          <ExportStep step={step} videoGenerated={videoGenerated} currentProject={currentProject} handleReadinessAction={handleReadinessAction} exportError={exportError} isExportingMp4={isExportingMp4} exportAbortRef={exportAbortRef} handleDownloadMp4={handleDownloadMp4} exportPercent={exportPercent} setIsVideoModalOpen={setIsVideoModalOpen} handleAttemptCreateVideo={handleAttemptCreateVideo} isAudioApproved={isAudioApproved} videoButtonWarning={videoButtonWarning} />
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

