export type ProjectStatus = 'draft' | 'audio_generated' | 'audio_approved' | 'video_ready';

export type YdtCategory =
  | 'nahiv'
  | 'sarf'
  | 'kelime'
  | 'cumle_tamamlama'
  | 'ceviri'
  | 'paragraf'
  | 'diyalog'
  | 'anlam_butunlugu'
  | 'irab';

export interface User {
  id: string;
  name: string;
  email: string;
  title: string;
  institution?: string;
  role: 'teacher' | 'editor' | 'admin';
}

export type AnnotationType = 'check' | 'cross' | 'highlight' | 'underline' | 'rule_box';

export interface VideoAnnotation {
  id: string;
  type: AnnotationType;
  target?: 'A' | 'B' | 'C' | 'D' | 'E' | 'stem' | 'free';
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width?: number; // percentage (0 - 100)
  height?: number; // percentage (0 - 100)
  startTime: number; // seconds
  duration: number; // seconds visible
  color?: string;
  text?: string;
  label?: string;
}

export interface NarrationWord {
  text: string;
  start: number;
  end: number;
}

export type RegionType =
  | 'question'
  | 'question-root'
  | 'paragraph'
  | 'keyword'
  | 'word'
  | 'phrase'
  | 'option'
  | 'option-a'
  | 'option-b'
  | 'option-c'
  | 'option-d'
  | 'option-e'
  | 'custom';

export interface AnnotationRegion {
  id: string;
  label: string;
  type: RegionType;
  x: number; // normalized 0 to 1
  y: number; // normalized 0 to 1
  width: number; // normalized 0 to 1
  height: number; // normalized 0 to 1
  color?: string;
  content?: string;
  manuallyAdjusted?: boolean;
}

export interface VideoCaption {
  start: number;
  end: number;
  text: string;
}

export type VideoActionType =
  | 'highlight'
  | 'underline'
  | 'reject'
  | 'correct'
  | 'focus'
  | 'dim-others'
  | 'reset';

export interface VideoAction {
  id: string;
  start: number; // seconds
  startTime?: number; // alias
  duration: number; // seconds
  targetRegionId: string;
  regionId?: string; // alias
  type: VideoActionType;
  label?: string;
}

export interface AudioNarration {
  audioBase64?: string;
  audioUrl: string;
  duration: number;
  voiceId: string;
  voiceName: string;
  modelId: string;
  generatedAt: string;
  isApproved: boolean;
  mode: 'live' | 'mock';
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
}

export interface VideoConfig {
  aspectRatio: '9:16' | '16:9';
  fps: number;
  backgroundColor: string;
  showWatermark: boolean;
  teacherTag?: string;
  annotations: VideoAnnotation[];
  regions?: AnnotationRegion[];
  timelineActions?: VideoAction[];
  captions?: VideoCaption[];
  showCaptions?: boolean;
  captionY?: number;
  timingQuality?: 'word-aligned' | 'anchored' | 'approximate';
  pipelineVersion?: number;
  warnings?: string[];
  suppressedRegionIds?: string[];
}

export interface ExportConfig {
  resolution: '720p' | '1080p';
  fps: 30;
  format: 'mp4' | 'webm';
  aspectRatio: '16:9' | '9:16';
}

export type NarrationSourceType = 'elevenlabs' | 'uploaded';

export interface NarrationSource {
  type: NarrationSourceType;
  audioUrl: string;
  audioBase64?: string;
  duration: number;
  fileName?: string;
  voiceName?: string;
  voiceId?: string;
  words?: NarrationWord[];
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
  transcript?: string;
  generatedAt?: string;
  isApproved?: boolean;
}

export interface QuestionProject {
  id: string;
  title: string;
  examYear: string;
  questionNumber: number;
  category: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  imageFileName?: string;
  imageDimensions?: { width: number; height: number };
  arabicQuestionSnippet?: string;
  solutionText: string;
  audioApproved?: boolean;
  narrationSource?: NarrationSource;
  audioNarration?: AudioNarration;
  videoConfig: VideoConfig;
  videoReady?: boolean;
  renderedVideoUrl?: string;
  isOutdated?: boolean;
  notes?: string;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  language?: string;
  accent?: string;
  gender?: string;
  description?: string;
  preview_url?: string;
  recommended?: boolean;
}

export interface ElevenLabsStatus {
  configured: boolean;
  mode: 'live' | 'mock';
  message: string;
}
