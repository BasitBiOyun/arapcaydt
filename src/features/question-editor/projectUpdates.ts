import type { AudioNarration, NarrationSource, QuestionProject } from '../../types';
import type { GenerateNarrationResponse } from '../../services/elevenlabs/types';
import type { LocalPipelineResult } from '../../services/pipeline/localVideoPipeline';
import { STANDARD_VOICE_CONFIG } from '../../config/voice';
import { CURRENT_PIPELINE_VERSION } from './readiness';

/** Project fields for a fresh ElevenLabs narration (editor and batch share this shape). */
export function narrationFromTts(result: GenerateNarrationResponse, approved = false): { narrationSource: NarrationSource; audioNarration: AudioNarration } {
  const audioUrl = `data:${result.mimeType};base64,${result.audioBase64}`;
  const generatedAt = new Date().toISOString();
  return {
    narrationSource: {
      type: 'elevenlabs', audioUrl, audioBase64: result.audioBase64, duration: result.durationSeconds,
      voiceId: STANDARD_VOICE_CONFIG.voiceId, voiceName: STANDARD_VOICE_CONFIG.name,
      words: result.words, alignment: result.alignment, isApproved: approved, generatedAt,
    },
    audioNarration: {
      audioUrl, audioBase64: result.audioBase64, duration: result.durationSeconds,
      voiceId: STANDARD_VOICE_CONFIG.voiceId, voiceName: STANDARD_VOICE_CONFIG.name, modelId: STANDARD_VOICE_CONFIG.modelId,
      generatedAt, isApproved: approved, mode: result.mode, words: result.words, alignment: result.alignment,
    },
  };
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
