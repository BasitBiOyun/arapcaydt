import React from 'react';
import { ProjectStatus } from '../../types';
import { CircleDashed, Waveform, CheckCircle, VideoCamera } from '@phosphor-icons/react';

interface StatusBadgeProps {
  status: ProjectStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const isSm = size === 'sm';

  switch (status) {
    case 'draft':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border border-[#DCDCD4] bg-[#F2F2EC] text-[#55544F] ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          }`}
        >
          <CircleDashed size={isSm ? 12 : 14} weight="bold" className="text-[#73726C]" />
          <span>Taslak</span>
        </span>
      );
    case 'audio_generated':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border border-[#E3D4A8] bg-[#FAF5E6] text-[#7A5812] ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          }`}
        >
          <Waveform size={isSm ? 12 : 14} weight="bold" className="text-[#B48419]" />
          <span>Ses Üretildi</span>
        </span>
      );
    case 'audio_approved':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border border-[#C5DAC8] bg-[#EFF7F0] text-[#1E562A] ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          }`}
        >
          <CheckCircle size={isSm ? 12 : 14} weight="fill" className="text-[#2E7D32]" />
          <span>Ses Onaylandı</span>
        </span>
      );
    case 'video_ready':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border border-[#DFBAC0] bg-[#F8EEEE] text-[#8B1E2D] ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          }`}
        >
          <VideoCamera size={isSm ? 12 : 14} weight="fill" className="text-[#8B1E2D]" />
          <span>Video Hazır</span>
        </span>
      );
    default:
      return null;
  }
};
