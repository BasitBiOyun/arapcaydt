import type { AudioNarration, NarrationSource, NarrationWord, QuestionProject } from '../../types';
import type { GenerateNarrationResponse } from '../../services/elevenlabs/types';
import type { LocalPipelineResult } from '../../services/pipeline/localVideoPipeline';
import { STANDARD_VOICE_CONFIG } from '../../config/voice';
import { CURRENT_PIPELINE_VERSION } from './readiness';

/** Project fields for a fresh TTS narration (Gemini primary, ElevenLabs fallback). */
export function narrationFromTts(result: GenerateNarrationResponse, approved = false): { narrationSource: NarrationSource; audioNarration: AudioNarration } {
  const audioUrl = result.audioUrl || (result.audioBase64 ? `data:${result.mimeType};base64,${result.audioBase64}` : '');
  const generatedAt = new Date().toISOString();
  const provider = result.provider === 'gemini' ? 'gemini' : 'elevenlabs';
  const voiceId = result.voiceId || STANDARD_VOICE_CONFIG.voiceId;
  const voiceName = result.voiceName || STANDARD_VOICE_CONFIG.name;
  const modelId = result.modelId || STANDARD_VOICE_CONFIG.modelId;
  const extension = result.mimeType.includes('wav') ? 'wav' : 'mp3';
  return {
    narrationSource: {
      type: provider, audioUrl, audioBase64: result.audioBase64, duration: result.durationSeconds,
      voiceId, voiceName, modelId, mimeType: result.mimeType, fileName: `seslendirme.${extension}`,
      assetPath: result.assetPath, fallbackReason: result.provider === 'elevenlabs' ? result.message : undefined,
      words: result.words, alignment: result.alignment, isApproved: approved, generatedAt,
    },
    audioNarration: {
      audioUrl, audioBase64: result.audioBase64, duration: result.durationSeconds,
      voiceId, voiceName, modelId, mimeType: result.mimeType,
      assetPath: result.assetPath, fallbackReason: result.provider === 'elevenlabs' ? result.message : undefined,
      generatedAt, isApproved: approved, mode: result.mode, words: result.words, alignment: result.alignment,
    },
  };
}

type TimingSource = NonNullable<NarrationSource['timingSource']>;

/** The narration with new word timings, on both the source and the legacy copy. */
export function withWordTimings(project: QuestionProject, words: NarrationWord[], timingSource: TimingSource): Pick<QuestionProject, 'narrationSource' | 'audioNarration'> {
  return {
    narrationSource: project.narrationSource && { ...project.narrationSource, words, timingSource },
    audioNarration: project.audioNarration && {
      ...project.audioNarration,
      words,
      wordAlignments: words.map(word => ({ word: word.text, start: word.start, end: word.end })),
    },
  };
}

/**
 * Word timings for freshly generated speech: the exact server alignment first,
 * then local Whisper. An empty answer from the server keeps approximate timing;
 * null means neither could time the audio.
 */
export async function timeGeneratedNarration(
  project: QuestionProject,
  exact: (project: QuestionProject) => Promise<{ words: NarrationWord[]; timingSource: TimingSource }>,
  local?: (project: QuestionProject) => Promise<NarrationWord[]>,
): Promise<{ words: NarrationWord[]; timingSource: TimingSource } | null> {
  try {
    return await exact(project);
  } catch (exactError) {
    console.warn('Exact server alignment unavailable; trying local Whisper:', exactError);
  }
  if (!local) return null;
  try {
    const words = await local(project);
    return words.length ? { words, timingSource: 'whisper' } : null;
  } catch (localError) {
    console.warn('Local Whisper timing unavailable:', localError);
    return null;
  }
}

/** Project fields once the animation plan is prepared from the current audio. */
export function applyPipelineResult(project: QuestionProject, result: LocalPipelineResult): Partial<QuestionProject> {
  return {
    videoConfig: {
      ...project.videoConfig,
      regions: result.regions,
      timelineActions: result.actions,
      captions: result.captions,
      timingQuality: result.timingQuality,
      pipelineVersion: CURRENT_PIPELINE_VERSION,
      warnings: result.warnings,
    },
    ...(result.deducedCorrectAnswer ? { correctAnswer: result.deducedCorrectAnswer } : {}),
    status: 'video_ready',
    videoReady: true,
  };
}
