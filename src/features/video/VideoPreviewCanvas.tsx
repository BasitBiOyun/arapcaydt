import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AnnotationRegion, VideoAction, VideoConfig } from '../../types';
import { renderQuestionVideoFrame } from './engine/renderer';
import { 
  Play, 
  Pause, 
  ArrowCounterClockwise, 
  CornersOut, 
  Desktop, 
  DeviceMobile,
  Clock,
  Sparkle
} from '@phosphor-icons/react';

interface VideoPreviewCanvasProps {
  imageUrl: string;
  regions: AnnotationRegion[];
  actions: VideoAction[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  videoConfig: VideoConfig;
  selectedRegionId?: string | null;
  audioUrl?: string;
}

export const VideoPreviewCanvas: React.FC<VideoPreviewCanvasProps> = ({
  imageUrl,
  regions = [],
  actions = [],
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeek,
  videoConfig,
  selectedRegionId = null,
  audioUrl,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  // Load image element when imageUrl changes
  useEffect(() => {
    if (!imageUrl) {
      setImageElement(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      setImageElement(img);
    };
  }, [imageUrl]);

  // Sync audio with video playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (Math.abs(audio.currentTime - currentTime) > 0.3) {
        audio.currentTime = currentTime;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync audio seek
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && Math.abs(audio.currentTime - currentTime) > 0.4) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  // Redraw canvas whenever currentTime, image, regions, or actions change
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderQuestionVideoFrame(
      ctx,
      canvas.width,
      canvas.height,
      imageElement,
      regions,
      actions,
      currentTime,
      {
        width: canvas.width,
        height: canvas.height,
        aspectRatio: videoConfig.aspectRatio || '16:9',
        showWatermark: videoConfig.showWatermark,
        teacherTag: videoConfig.teacherTag || 'Arapça YDT • Video Stüdyosu',
        selectedRegionId,
        interactiveMode: false,
      }
    );
  }, [currentTime, imageElement, regions, actions, videoConfig, selectedRegionId]);

  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  const effectiveDuration = Math.max(1, duration);

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleRestart = () => {
    onSeek(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const newTime = (clickX / rect.width) * effectiveDuration;
    onSeek(newTime);
  };

  return (
    <div ref={containerRef} className="flex flex-col space-y-2 select-none w-full">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => {
            if (isPlaying) onPlayPause();
            onSeek(0);
          }}
          className="hidden"
        />
      )}

      {/* Canvas Display Viewport */}
      <div className="relative w-full aspect-video bg-[#1C1917] rounded-xl border border-[#D5D4CC] overflow-hidden shadow-sm flex items-center justify-center group">
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="w-full h-full object-contain"
        />

        {/* Center overlay play button when paused */}
        {!isPlaying && (
          <button
            type="button"
            onClick={onPlayPause}
            className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-[#8B1E2D]/90 hover:bg-[#8B1E2D] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer backdrop-blur-xs z-20"
            title="Videoyu Oynat"
          >
            <Play size={24} weight="fill" className="ml-1" />
          </button>
        )}
      </div>

      {/* Scrubber and Controls */}
      <div className="flex flex-col gap-2 p-3 rounded-lg bg-white border border-[#E5E4DC] text-xs shadow-xs">
        {/* Scrubber progress bar */}
        <div
          onClick={handleScrubberClick}
          className="w-full h-3 bg-[#FAF9F5] border border-[#E5E4DC] rounded-full cursor-pointer relative overflow-hidden flex items-center"
          title="Zaman Çizelgesi"
        >
          <div
            className="h-full bg-[#8B1E2D] rounded-full transition-all duration-75"
            style={{ width: `${Math.min(100, (currentTime / effectiveDuration) * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPlayPause}
              className="p-1.5 rounded-md bg-[#FAF9F5] hover:bg-[#8B1E2D] hover:text-white border border-[#D5D4CC] text-[#1C1917] transition-colors cursor-pointer"
              title={isPlaying ? 'Durdur' : 'Oynat'}
            >
              {isPlaying ? <Pause size={15} weight="bold" /> : <Play size={15} weight="bold" />}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="p-1.5 rounded-md bg-[#FAF9F5] hover:bg-[#EFEFEA] border border-[#D5D4CC] text-[#55544F] transition-colors cursor-pointer"
              title="Başa Dön"
            >
              <ArrowCounterClockwise size={15} weight="bold" />
            </button>

            <div className="text-xs font-mono text-[#55544F] ml-1">
              <span className="font-semibold text-[#1C1917]">
                {Math.floor(currentTime / 60).toString().padStart(2, '0')}:
                {Math.floor(currentTime % 60).toString().padStart(2, '0')}
              </span>
              <span> / </span>
              <span>
                {Math.floor(effectiveDuration / 60).toString().padStart(2, '0')}:
                {Math.floor(effectiveDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[#787670]">1080p • 30fps Yerel Render</span>
            <button
              type="button"
              onClick={handleFullscreen}
              className="p-1.5 rounded-md bg-[#FAF9F5] hover:bg-[#EFEFEA] border border-[#D5D4CC] text-[#55544F] transition-colors cursor-pointer"
              title="Tam Ekran"
            >
              <CornersOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
