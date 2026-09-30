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
/** Longest solution text the voice can read in one go (the server refuses longer). */
import { SPOKEN_LIMIT } from '../../../services/narration/narrationParts';
export { SPOKEN_LIMIT };

export function SolutionStep({
  step,
  currentProject,
  updateCurrentProject,
  setVideoGenerated,
  isGeneratingAudio,
  sampleBusy,
}: SolutionStepProps) {
  return (
    <div hidden={step !== 1} className="space-y-2.5">
      <h2 className="text-sm font-bold text-[#1C1917] tracking-tight">Çözüm metnini hazırlayın</h2>
      <label className="flex items-center gap-3">
        Doğru cevap
        <select
          className="border rounded px-3 py-2"
          value={currentProject.correctAnswer}
          onChange={e => {
            updateCurrentProject({ correctAnswer: e.target.value as QuestionProject['correctAnswer'], videoReady: false });
            setVideoGenerated(false);
          }}
        >
          {['A', 'B', 'C', 'D', 'E'].map(l => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <textarea
        aria-label="Çözüm metni"
        disabled={isGeneratingAudio || sampleBusy}
        value={currentProject.solutionText}
        onChange={e => {
          updateCurrentProject({
            solutionText: e.target.value,
            audioApproved: false,
            narrationSource: currentProject.narrationSource ? { ...currentProject.narrationSource, isApproved: false } : undefined,
            audioNarration: currentProject.audioNarration ? { ...currentProject.audioNarration, isApproved: false } : undefined,
            videoReady: false,
          });
          setVideoGenerated(false);
        }}
        placeholder="Sorunun çözümünü buraya yazın..."
        rows={12}
        dir="auto"
        className="w-full p-3.5 rounded-lg border border-[#D5D4CC] focus:border-[#8B1E2D] focus:ring-1 focus:ring-[#8B1E2D] text-sm text-[#1C1917] leading-relaxed bg-white outline-none resize-y placeholder:text-[#A8A69E]"
      />
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        {currentProject.narrationSource?.spokenText !== undefined
          && currentProject.narrationSource.spokenText.trim() !== currentProject.solutionText.trim() ? (
          <p role="status" className="text-[#92400E] bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
            Metni değiştirdiniz; şu anki ses eski metni okuyor. Değişikliklerin sese geçmesi için 3. adımda <b>Yeniden seslendir</b>’e basın.
          </p>
        ) : <span />}
        <span className={`ml-auto tabular-nums ${currentProject.solutionText.trim().length > SPOKEN_LIMIT ? 'text-[#B91C1C] font-semibold' : 'text-[#787670]'}`}>
          {currentProject.solutionText.trim().length.toLocaleString('tr')} / {SPOKEN_LIMIT.toLocaleString('tr')} karakter
          {currentProject.solutionText.trim().length > SPOKEN_LIMIT && ' · seslendirme için kısaltın'}
        </span>
      </div>
      {!currentProject.solutionText.trim() && (
        <p className="text-sm text-[#787670]">
          Hazır ses kaydınız (MP3) varsa metni yazmadan devam edin; bir sonraki adımda MP3’ü yükleyince çözüm metni sesinizden çıkarılır. Doğru cevabı seçmeyi unutmayın.
        </p>
      )}
    </div>
  );
}
