import type { AudioNarration, NarrationSource, QuestionProject } from '../../types';
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
