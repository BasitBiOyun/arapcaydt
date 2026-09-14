import React from 'react';
import { 
  Waveform, 
  Clock, 
  Check, 
  X, 
  HighlighterCircle, 
  PencilSimpleLine, 
  ChatText,
  Sliders
} from '@phosphor-icons/react';
import { VideoAnnotation, AudioNarration } from '../../types';

interface TimelinePreviewProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  annotations: VideoAnnotation[];
  audioNarration?: AudioNarration;
  onUpdateAnnotationTime: (id: string, startTime: number) => void;
}

export const TimelinePreview: React.FC<TimelinePreviewProps> = ({
  duration = 15,
  currentTime,
  onSeek,
  annotations,
  audioNarration,
  onUpdateAnnotationTime,
}) => {
  const effectiveDuration = Math.max(5, duration);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(parseFloat((ratio * effectiveDuration).toFixed(1)));
  };

  // Generate 1-second interval tick marks
  const tickCount = Math.min(30, Math.ceil(effectiveDuration));
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i);

  return (
    <div className="p-3 rounded border border-[#E2E1D9] bg-[#FFFFFF] space-y-2 select-none">
      <div className="flex items-center justify-between text-xs pb-1 border-b border-[#EFEFEA]">
        <div className="flex items-center gap-2">
          <Clock size={15} weight="bold" className="text-[#8B1E2D]" />
          <span className="font-semibold text-[#1C1917]">
            Video & Ses Zaman Çizelgesi (Timeline)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono-code text-[#6E6D68]">
          <span className="text-[#8B1E2D] font-bold">{currentTime.toFixed(1)}s</span>
          <span>/</span>
          <span>{effectiveDuration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Main Timeline Ruler & Tracks Area */}
      <div
        onClick={handleTimelineClick}
        className="relative w-full bg-[#FAF9F5] border border-[#E5E4DC] rounded p-2 cursor-pointer overflow-hidden"
      >
        {/* Playhead Scrubber line */}
        <div
          style={{
            left: `${(currentTime / effectiveDuration) * 100}%`,
          }}
          className="absolute top-0 bottom-0 w-0.5 bg-[#8B1E2D] z-30 pointer-events-none transition-all duration-75"
        >
          <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-[#8B1E2D] shadow-xs"></div>
        </div>

        {/* 1. Time Ruler Ticks */}
        <div className="relative h-5 border-b border-[#E5E4DC] flex justify-between items-end pb-1 text-[9px] font-mono-code text-[#8C8A82]">
          {ticks.map((t) => (
            <div key={t} className="flex flex-col items-center">
              <span className="h-1.5 w-px bg-[#D5D4CC]"></span>
              {t % 2 === 0 && <span>{t}s</span>}
            </div>
          ))}
        </div>

        {/* 2. Track A: ElevenLabs Narration Audio Track */}
        <div className="pt-2">
          <div className="flex items-center gap-1 text-[10px] font-medium text-[#787670] pb-1">
            <Waveform size={12} className="text-[#8B1E2D]" />
            <span>Seslendirme Dalgası & Kelime Hizalaması:</span>
          </div>

          <div className="h-7 w-full bg-[#F2ECEC] border border-[#DFC8CB] rounded flex items-center px-2 relative overflow-hidden">
            {/* Waveform simulation bars */}
            <div className="flex items-center gap-0.5 w-full h-full opacity-60">
              {Array.from({ length: 60 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: `${20 + (Math.sin(i * 0.4) * 35 + 35)}%`,
                  }}
                  className="flex-1 bg-[#8B1E2D] rounded-full"
                />
              ))}
            </div>

            {/* Word Alignment markers if available */}
            {audioNarration?.wordAlignments && (
              <div className="absolute inset-0 flex items-center pointer-events-none">
                {audioNarration.wordAlignments.slice(0, 8).map((w, idx) => (
                  <span
                    key={idx}
                    style={{
                      left: `${(w.start / effectiveDuration) * 100}%`,
                      position: 'absolute',
                    }}
                    className="text-[9px] font-mono-code text-[#1C1917] bg-white/70 px-1 rounded shadow-xs"
                  >
                    {w.word}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Track B: Visual Annotations Cue Track */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-[10px] font-medium text-[#787670] pb-1">
            <span>Görsel İşaretleme & Animasyon İpuçları ({annotations.length}):</span>
          </div>

          <div className="h-8 w-full bg-[#FAF9F5] border border-[#E5E4DC] rounded relative flex items-center px-1">
            {annotations.length === 0 ? (
              <span className="text-[10px] text-[#8C8A82] italic px-2">
                Henüz görsel işaretleme eklenmedi. Yukarıdaki araçlarla ekleyebilirsiniz.
              </span>
            ) : (
              annotations.map((ann) => {
                const leftPercent = (ann.startTime / effectiveDuration) * 100;
                const widthPercent = Math.max(8, (ann.duration / effectiveDuration) * 100);

                return (
                  <div
                    key={ann.id}
                    style={{
                      left: `${Math.min(92, leftPercent)}%`,
                      width: `${Math.min(30, widthPercent)}%`,
                    }}
                    className={`absolute h-6 rounded px-1.5 flex items-center gap-1 text-[10px] font-medium shadow-xs truncate z-10 border ${
                      ann.type === 'check'
                        ? 'bg-[#EFF7F0] border-[#C5DAC8] text-[#1E562A]'
                        : ann.type === 'cross'
                        ? 'bg-[#FDF2F2] border-[#DFC8CB] text-[#8B1E2D]'
                        : ann.type === 'highlight'
                        ? 'bg-[#FAF5E6] border-[#E3D4A8] text-[#7A5812]'
                        : 'bg-[#F2F1EB] border-[#D5D4CC] text-[#33322E]'
                    }`}
                    title={`${ann.label || ann.type} (${ann.startTime}s - ${ann.startTime + ann.duration}s)`}
                  >
                    {ann.type === 'check' && <Check size={11} weight="bold" />}
                    {ann.type === 'cross' && <X size={11} weight="bold" />}
                    {ann.type === 'highlight' && <HighlighterCircle size={11} weight="fill" />}
                    {ann.type === 'underline' && <PencilSimpleLine size={11} />}
                    {ann.type === 'rule_box' && <ChatText size={11} />}
                    <span className="truncate">{ann.label || ann.type}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
