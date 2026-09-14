/**
 * Centralized Voice Configuration for ElevenLabs
 * 
 * Platform standard narration voice for Arabic YDT question solution videos.
 * (eleven_multilingual_v2) is optimized for dual-language (Turkish & Arabic)
 * educational explanation cadence.
 */

export interface VoiceSettingsConfig {
  speed: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface VoiceConfig {
  voiceId: string;
  name: string;
  modelId: string;
  outputFormat: string;
  description?: string;
  voiceSettings: VoiceSettingsConfig;
  /** Audio stereo panning position (-1.0 left, 0.0 center, 1.0 right). Kept centered (0.0). */
  panning: number;
  audioSpecifications: {
    format: string;
    sampleRate: number;
    bitrate: string;
    channels: 'centered-stereo';
  };
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: 'eUUtjbi66JcWz3T4Gvvo',
  name: 'Eğitmen Sesi',
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
  description: 'Eleven Multilingual v2 - Türkçe & Arapça soru çözümü için platform standart sesi',

  voiceSettings: {
    speed: 1.0,
    stability: 0.50,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true,
  },

  panning: 0.0, // Centered audio in the stereo field (50% left / 50% right)

  audioSpecifications: {
    format: 'MP3',
    sampleRate: 44100,
    bitrate: '128 kbps',
    channels: 'centered-stereo',
  },
};

/** Standard voice configuration */
export const STANDARD_VOICE_CONFIG = DEFAULT_VOICE_CONFIG;
