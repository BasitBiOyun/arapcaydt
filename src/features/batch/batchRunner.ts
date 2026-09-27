import type { QuestionProject } from '../../types';
import type { GenerateNarrationResponse } from '../../services/elevenlabs/types';
import type { LocalPipelineResult } from '../../services/pipeline/localVideoPipeline';
import type { UploadedNarrationResult } from '../../services/narration/uploadedNarration';
import { assessReadiness, type Readiness } from '../question-editor/readiness';
import { applyPipelineResult, narrationFromTts } from '../question-editor/projectUpdates';
import type { BatchItem } from './batchPlan';

export type BatchStage = 'waiting' | 'creating' | 'voice' | 'markers' | 'video' | 'done' | 'failed' | 'skipped' | 'stopped';
export interface BatchRowState {
  stage: BatchStage;
  message?: string;
  projectId?: string;
  readiness?: Readiness['level'];
  percent?: number;
}

export interface BatchOptions {
  category: string;
  examName: string;
  examYear: string;
  /** Narrate questions without an MP3 with Gemini free-tier TTS first, then ElevenLabs fallback. */
  generateVoice: boolean;
  /** Encode and download each MP4 once its markers are ready. */
  exportVideo: boolean;
}

export interface BatchDeps<F> {
  readDataUrl(file: F): Promise<string>;
  createProject(project: Omit<QuestionProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuestionProject>;
  saveProject(project: QuestionProject): Promise<QuestionProject>;
  generateVoice(project: QuestionProject): Promise<GenerateNarrationResponse>;
  alignGeneratedVoice?(project: QuestionProject): Promise<{ words: Array<{ text: string; start: number; end: number }>; timingSource: 'gemini-transcribe' | 'forced-alignment' }>;
  alignGeneratedVoiceLocal?(project: QuestionProject): Promise<Array<{ text: string; start: number; end: number }>>;
  prepareUpload(project: QuestionProject, file: F): Promise<UploadedNarrationResult>;
  runPipeline(project: QuestionProject, declaredAnswer?: QuestionProject['correctAnswer']): Promise<LocalPipelineResult>;
  exportVideo(project: QuestionProject, onPercent: (percent: number) => void, signal?: AbortSignal): Promise<Blob>;
  download(blob: Blob, project: QuestionProject): void;
  recordExport(project: QuestionProject): Promise<void>;
  wait(ms: number): Promise<void>;
  now(): number;
}

/** Four Gemini models each expose 10 RPM in the current free tier; route keys distribute load across them. */
export const VOICE_SPACING_MS = 1_700;

/**
 * Processes matched questions one by one: project → narration → markers →
 * (optional) MP4. A failure only stops its own question; "stop" finishes the
 * current step's request and leaves the rest untouched. Every project is
 * saved after each step, so a stopped batch can be continued in the editor.
 */
export async function runBatch<F extends { name: string }>(
  items: BatchItem<F>[], options: BatchOptions, deps: BatchDeps<F>,
  update: (number: number, state: BatchRowState) => void, signal?: AbortSignal,
): Promise<void> {
  let lastVoiceAt = -Infinity;
  const spaceVoice = async () => {
    const wait = lastVoiceAt + VOICE_SPACING_MS - deps.now();
    if (wait > 0) await deps.wait(wait);
    lastVoiceAt = deps.now();
  };

  for (const item of items) {
    if (signal?.aborted) { update(item.number, { stage: 'stopped', message: 'Durduruldu' }); continue; }
    if (item.problems.length || !item.image || !item.solution) {
      update(item.number, { stage: 'skipped', message: item.problems.join(' · ') || 'Eksik dosya' });
      continue;
    }
    let project: QuestionProject | undefined;
    try {
      update(item.number, { stage: 'creating', message: 'Proje oluşturuluyor' });
      project = await deps.createProject({
        title: `Soru ${item.number}`, questionNumber: item.number, examYear: options.examYear, examName: options.examName,
        category: options.category, correctAnswer: item.answer || 'A', status: 'draft',
        imageUrl: await deps.readDataUrl(item.image), imageFileName: item.image.name, solutionText: item.solution,
        audioApproved: false, videoReady: false,
        videoConfig: { aspectRatio: '16:9', fps: 30, backgroundColor: '#FFFFFF', showWatermark: true, teacherTag: 'Arapça YDT Soru Çözümü', annotations: [] },
      });
      const projectId = project.id;
      const step = (stage: BatchStage, message: string, percent?: number) => update(item.number, { stage, message, projectId, percent });

      if (item.audio) {
        step('voice', 'MP3 metne hizalanıyor');
        await spaceVoice();
        const uploaded = await deps.prepareUpload(project, item.audio);
        project = await deps.saveProject({ ...project, narrationSource: { ...uploaded.source, isApproved: true },
          audioNarration: { ...uploaded.compat, isApproved: true }, audioApproved: true, status: 'audio_approved' });
      } else if (options.generateVoice) {
        step('voice', 'Gemini TTS ile seslendiriliyor');
        await spaceVoice();
        const generated = await deps.generateVoice(project);
        const narration = narrationFromTts(generated, true);
        project = await deps.saveProject({ ...project, ...narration, audioApproved: true, status: 'audio_approved' });
        if (generated.provider === 'gemini' && deps.alignGeneratedVoice) {
          step('voice', 'Kelime zaman damgaları alınıyor');
          try {
            const alignment = await deps.alignGeneratedVoice(project);
            if (alignment.words.length) {
              project = await deps.saveProject({
                ...project,
                narrationSource: project.narrationSource ? {
                  ...project.narrationSource,
                  words: alignment.words,
                  timingSource: alignment.timingSource,
                } : project.narrationSource,
                audioNarration: project.audioNarration ? {
                  ...project.audioNarration,
                  words: alignment.words,
                  wordAlignments: alignment.words.map(word => ({ word: word.text, start: word.start, end: word.end })),
                } : project.audioNarration,
              });
            }
          } catch {
            if (deps.alignGeneratedVoiceLocal) {
              try {
                const words = await deps.alignGeneratedVoiceLocal(project);
                if (words.length) {
                  project = await deps.saveProject({
                    ...project,
                    narrationSource: project.narrationSource ? { ...project.narrationSource, words, timingSource: 'whisper' } : project.narrationSource,
                    audioNarration: project.audioNarration ? {
                      ...project.audioNarration,
                      words,
                      wordAlignments: words.map(word => ({ word: word.text, start: word.start, end: word.end })),
                    } : project.audioNarration,
                  });
                }
              } catch {
                // Exact services and local Whisper failed; the video pipeline can still use approximate timing.
              }
            }
          }
        }
      } else {
        update(item.number, { stage: 'done', message: 'Proje oluşturuldu; ses bekleniyor', projectId, readiness: assessReadiness(project).level });
        continue;
      }
      if (signal?.aborted) { update(item.number, { stage: 'stopped', message: 'Ses hazır; durduruldu', projectId }); continue; }

      step('markers', 'İşaretler hazırlanıyor');
      const result = await deps.runPipeline(project, item.answer);
      project = await deps.saveProject({ ...project, ...applyPipelineResult(project, result) });
      if (signal?.aborted) { update(item.number, { stage: 'stopped', message: 'İşaretler hazır; durduruldu', projectId }); continue; }

      if (options.exportVideo) {
        step('video', 'MP4 hazırlanıyor', 0);
        const saved = project;
        const blob = await deps.exportVideo(saved, percent => step('video', 'MP4 hazırlanıyor', percent), signal);
        deps.download(blob, saved);
        await deps.recordExport(saved).catch(() => undefined);
      }
      update(item.number, { stage: 'done', message: options.exportVideo ? 'MP4 indirildi' : 'İşaretler hazır', projectId, readiness: assessReadiness(project).level });
    } catch (error) {
      const aborted = signal?.aborted || (error instanceof DOMException && error.name === 'AbortError');
      update(item.number, { stage: aborted ? 'stopped' : 'failed', projectId: project?.id,
        message: aborted ? 'Durduruldu' : error instanceof Error ? error.message : 'Bilinmeyen hata' });
    }
  }
}
