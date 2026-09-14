import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SpeakerHigh, 
  SpeakerSlash, 
  ArrowCounterClockwise, 
  Waveform,
  Lightning
} from '@phosphor-icons/react';

interface AudioPlayerBarProps {
  audioUrl?: string;
  duration?: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audioUrl,
  duration = 15,
  currentTime,
  onTimeUpdate,
  isPlaying,
  onPlayPause,
  onSeek,
}) => {
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          // If browser policy prevents autoplay, toggle isPlaying off
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Sync internal audio current time if seeking occurs externally
  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      onTimeUpdate(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    if (isPlaying) {
      onPlayPause();
    }
    onSeek(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(next);
  };

  return (
    <div className="p-3 rounded border border-[#E2E1D9] bg-[#FFFFFF] shadow-xs select-none space-y-2">
      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={handleAudioEnded}
          muted={isMuted}
        />
      )}

      {/* Scrubber & Waveform Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-mono-code text-[#6E6D68]">
          <span className="font-semibold text-[#1C1917]">{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="relative w-full h-4 flex items-center cursor-pointer group">
          <input
            type="range"
            min={0}
            max={duration || 10}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onSeek(val);
              if (audioRef.current) {
                audioRef.current.currentTime = val;
              }
            }}
            className="w-full h-1.5 bg-[#E8E7E0] rounded-lg appearance-none cursor-pointer accent-[#8B1E2D]"
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={onPlayPause}
            className="w-8 h-8 rounded-full bg-[#8B1E2D] hover:bg-[#721824] text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
            title={isPlaying ? 'Durdur' : 'Oynat'}
          >
            {isPlaying ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" className="ml-0.5" />}
          </button>

          {/* Reset to Start */}
          <button
            type="button"
            onClick={() => {
              onSeek(0);
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
            className="p-1.5 text-[#6E6D68] hover:text-[#1C1917] hover:bg-[#F2F1EB] rounded transition-colors cursor-pointer"
            title="Başa Sar"
          >
            <ArrowCounterClockwise size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed Toggle */}
          <button
            type="button"
            onClick={cycleSpeed}
            className="px-2 py-0.5 rounded text-[11px] font-mono-code bg-[#FAF9F5] border border-[#DCDCD4] text-[#44423D] hover:bg-[#EFEFEA] cursor-pointer"
            title="Oynatma Hızı"
          >
            {playbackSpeed}x
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 text-[#6E6D68] hover:text-[#1C1917] hover:bg-[#F2F1EB] rounded transition-colors cursor-pointer"
            title={isMuted ? 'Sesi Aç' : 'Sessize Al'}
          >
            {isMuted ? <SpeakerSlash size={16} /> : <SpeakerHigh size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
