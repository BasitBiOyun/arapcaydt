import React from 'react';
import type { QuestionProject } from '../../../types';

export interface SolutionStepProps {
  step: number;
  currentProject: QuestionProject;
  updateCurrentProject: (updates: Partial<QuestionProject>) => void;
  setVideoGenerated: (ready: boolean) => void;
  isGeneratingAudio: boolean;
  sampleBusy: boolean;
}

/** STEP 2: Çözüm Metni */
export function SolutionStep({ step, currentProject, updateCurrentProject, setVideoGenerated, isGeneratingAudio, sampleBusy }: SolutionStepProps) {
  return (
    <div hidden={step!==1} className="space-y-2.5">
      <h2 className="text-xs font-bold text-[#1C1917] tracking-tight">
        Çözüm metnini hazırlayın
      </h2>
      <label className="flex items-center gap-3">Doğru cevap<select className="border rounded px-3 py-2" value={currentProject.correctAnswer} onChange={e=>{updateCurrentProject({correctAnswer:e.target.value as QuestionProject['correctAnswer'],videoReady:false});setVideoGenerated(false);}}>{['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}</select></label>
      <textarea
        aria-label="Çözüm metni"
        disabled={isGeneratingAudio || sampleBusy}
        value={currentProject.solutionText}
        onChange={(e) => {
          updateCurrentProject({
            solutionText: e.target.value,
            audioApproved: false,
            narrationSource: currentProject.narrationSource ? {...currentProject.narrationSource,isApproved:false} : undefined,
            audioNarration: currentProject.audioNarration ? {...currentProject.audioNarration,isApproved:false} : undefined,
            videoReady: false,
          });
          setVideoGenerated(false);
        }}
        placeholder="Sorunun çözümünü buraya yazın..."
        rows={12}
        dir="auto"
        className="w-full p-3.5 rounded-lg border border-[#D5D4CC] focus:border-[#8B1E2D] focus:ring-1 focus:ring-[#8B1E2D] text-xs text-[#1C1917] leading-relaxed bg-white outline-none resize-y placeholder:text-[#A8A69E]"
      />
    </div>
  );
}
