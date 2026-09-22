import { AudioNarration, ElevenLabsVoice, ElevenLabsStatus, NarrationWord } from '../../types';

export interface GenerateNarrationRequest {
  projectId?: string;
  text: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
  voiceSettings?: {
    speed?: number;
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export interface GenerateNarrationResponse {
  audioBase64: string;
  mimeType: string;
  mode: 'live' | 'mock';
  durationSeconds: number;
  words?: NarrationWord[];
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
  wordAlignments?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  message?: string;
}

export interface IElevenLabsService {
  checkStatus(): Promise<ElevenLabsStatus>;
  getVoices(): Promise<ElevenLabsVoice[]>;
  generateNarration(req: GenerateNarrationRequest): Promise<GenerateNarrationResponse>;
}
