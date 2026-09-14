export type YdtEventType =
  | 'focus'
  | 'highlight'
  | 'underline'
  | 'reject'
  | 'correct'
  | 'dimOthers'
  | 'zoom';

export interface YdtRegion {
  id: string;
  type: string; // 'option-a' | 'option-b' | 'option-c' | 'option-d' | 'option-e' | 'question' | 'paragraph' | 'keyword' | string
  x: number; // normalized 0 to 1
  y: number; // normalized 0 to 1
  width: number; // normalized 0 to 1
  height: number; // normalized 0 to 1
}

export interface YdtEvent {
  id: string;
  start: number; // in seconds
  duration?: number; // in seconds (for temporary highlights/focus/dim/zoom)
  type: YdtEventType;
  targetRegionId: string;
}

export interface YdtVideoProps {
  questionImageUrl: string;
  audioUrl: string;
  durationInSeconds: number;
  regions: YdtRegion[];
  events: YdtEvent[];
  teacherTag?: string;
  showWatermark?: boolean;
  imageAspectRatio?: number;
}
