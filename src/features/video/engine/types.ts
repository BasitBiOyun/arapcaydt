import { AnnotationRegion, VideoAction, ExportConfig, VideoCaption } from '../../../types';

export interface ActiveHighlight {
  regionId: string;
  opacity: number;
  color?: string;
}

export interface ActiveUnderline {
  regionId: string;
  progress: number; // 0 to 1
  isRtl: boolean;
  color?: string;
  /** Fades the marker out at the end of its spoken span. */
  opacity?: number;
}

export interface ActiveFocus {
  regionId: string;
  intensity: number; // 0 to 1
}

export interface ActiveDimOthers {
  active: boolean;
  targetRegionId?: string;
  opacity: number;
}

export interface MarkerState {
  regionId: string;
  drawProgress: number; // 0 to 1
  timestamp: number;
}

export interface RenderState {
  activeHighlights: ActiveHighlight[];
  activeUnderlines: ActiveUnderline[];
  activeFocus: ActiveFocus[];
  activeDimOthers: ActiveDimOthers;
  rejectedRegions: Record<string, MarkerState>;
  correctRegions: Record<string, MarkerState>;
  selectedRegionId?: string | null;
}

export interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderOptions {
  width: number;
  height: number;
  aspectRatio: '16:9' | '9:16';
  showWatermark?: boolean;
  teacherTag?: string;
  selectedRegionId?: string | null;
  interactiveMode?: boolean;
  captions?: VideoCaption[];
  showCaptions?: boolean;
  captionY?: number;
  /** Narration length; draws the thin progress bar in exported frames. */
  duration?: number;
}

export interface ExportProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'finalizing' | 'completed' | 'error';
  percent: number;
  currentFrame?: number;
  totalFrames?: number;
  message?: string;
}

export interface IVideoExporter {
  exportVideo(
    canvasRenderer: (ctx: CanvasRenderingContext2D, time: number) => void,
    audioUrl: string | undefined,
    duration: number,
    config: ExportConfig,
    onProgress: (progress: ExportProgress) => void
  ): Promise<Blob>;
}
