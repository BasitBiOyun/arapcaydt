import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { YdtQuestionComposition } from './YdtQuestionComposition';
import { YdtVideoProps } from './types';
import { Play, Pause, CornersOut, ArrowCounterClockwise } from '@phosphor-icons/react';

interface RemotionPreviewPlayerProps {
  props: YdtVideoProps;
  className?: string;
}

export const RemotionPreviewPlayer: React.FC<RemotionPreviewPlayerProps> = ({
  props,
  className = '',
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fps = 30;
  const durationInSeconds = Math.max(1, props.durationInSeconds || 15);
  const durationInFrames = Math.max(30, Math.ceil(durationInSeconds * fps));

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Subscribe to Player frame and playback events
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = (e: { frame: number }) => {
      setCurrentFrame(e.frame);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentFrame(0);
    };

    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (playerRef.current.isPlaying()) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  }, []);

  const handleSeek = (newFrame: number) => {
    setCurrentFrame(newFrame);
    playerRef.current?.seekTo(newFrame);
  };

  const handleFullscreen = () => {
    if (playerRef.current) {
      if (playerRef.current.isFullscreen()) {
        playerRef.current.exitFullscreen();
      } else {
        playerRef.current.requestFullscreen();
      }
    } else if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentTimeSeconds = currentFrame / fps;

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col items-center select-none ${className}`}
    >
      {/* Remotion Player Viewport */}
      <div className="w-full relative aspect-video rounded-xl overflow-hidden border border-[#D5D4CC] bg-[#1C1917] shadow-sm">
        <Player
          ref={playerRef}
          component={YdtQuestionComposition}
          inputProps={props}
          durationInFrames={durationInFrames}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={fps}
          controls={false}
          clickToPlay={true}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* Teacher Control Bar: Play / Pause, Time scrubber, Duration, Fullscreen */}
      <div className="w-full mt-3 px-4 py-2.5 rounded-lg bg-white border border-[#E5E4DC] flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className="w-8 h-8 rounded-full bg-[#8B1E2D] hover:bg-[#721824] text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            title={isPlaying ? 'Durdur' : 'Oynat'}
          >
            {isPlaying ? (
              <Pause size={15} weight="fill" />
            ) : (
              <Play size={15} weight="fill" className="ml-0.5" />
            )}
          </button>

          {/* Reset to Start */}
          <button
            type="button"
            onClick={() => handleSeek(0)}
            className="p-1.5 rounded-md hover:bg-[#F0EFEA] text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer"
            title="Başa Dön"
          >
            <ArrowCounterClockwise size={16} />
          </button>

          {/* Time Display MM:SS / MM:SS */}
          <div className="text-xs font-mono-code text-[#55544F] min-w-[90px]">
            <span className="font-semibold text-[#1C1917]">
              {formatTime(currentTimeSeconds)}
            </span>
            <span className="text-[#8C8A82]"> / </span>
            <span>{formatTime(durationInSeconds)}</span>
          </div>
        </div>

        {/* Scrubber Range */}
        <div className="flex-1 max-w-xl mx-2 flex items-center">
          <input
            type="range"
            min={0}
            max={durationInFrames - 1}
            step={1}
            value={currentFrame}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-[#E5E4DC] rounded-lg appearance-none cursor-pointer accent-[#8B1E2D]"
          />
        </div>

        {/* Fullscreen */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleFullscreen}
            className="p-1.5 rounded-md hover:bg-[#F0EFEA] text-[#55544F] hover:text-[#1C1917] transition-colors cursor-pointer"
            title="Tam Ekran"
          >
            <CornersOut size={17} />
          </button>
        </div>
      </div>
    </div>
  );
};
