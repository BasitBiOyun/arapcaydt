import { useEffect, useState } from 'react';
import { CheckCircle, CircleNotch, Circle } from '@phosphor-icons/react';
import { VoiceProgress, voiceSteps, voiceWaitNote } from './voiceProgress';

/** What "Seslendirme Oluştur" is doing right now, step by step, with the time that has passed. */
export function VoiceProgressPanel({ progress }: { progress: VoiceProgress }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-[#E5E4DC] bg-[#FAFAF7] p-3 space-y-1.5">
      {voiceSteps(progress).map(step => (
        <p key={step.label} className={`flex items-center gap-2 text-sm ${step.state === 'todo' ? 'text-[#A8A69E]' : 'text-[#1C1917]'} ${step.state === 'active' ? 'font-bold' : ''}`}>
          {step.state === 'done' ? <CheckCircle size={16} weight="fill" className="text-[#2F7D3B] shrink-0" />
            : step.state === 'active' ? <CircleNotch size={16} className="animate-spin text-[#8B1E2D] shrink-0" />
            : <Circle size={16} className="shrink-0" />}
          {step.label}
        </p>
      ))}
      <p className="text-xs text-[#787670] pt-1">{voiceWaitNote(progress, now)}</p>
    </div>
  );
}
