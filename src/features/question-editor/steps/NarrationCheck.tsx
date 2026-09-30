import React from 'react';
import type { QuestionProject } from '../../../types';
import { checkNarration } from '../workflow';
import { SPOKEN_LIMIT } from '../../../services/narration/narrationParts';

export interface NarrationCheckProps {
  step: number;
  check: ReturnType<typeof checkNarration>;
  currentProject: QuestionProject;
}

export function NarrationCheck({ step, check, currentProject }: NarrationCheckProps) {
  return (
    (step === 1 || step === 2) && (
      <section className="narration-check" aria-label="Ses ön kontrolü">
        <strong>{check.characters.toLocaleString('tr')} / {SPOKEN_LIMIT.toLocaleString('tr')} karakter</strong>
        <p>Doğru cevap: {currentProject.correctAnswer}.</p>
        {check.characters > 0 && (
          <ul className="mt-2 space-y-0.5" aria-label="Şıkların işaretleri">
            {(['A', 'B', 'C', 'D', 'E'] as const).map(letter => {
              const v = check.verdicts[letter];
              const trigger = v?.trigger.replace(/[.,;:!?]+$/, '');
              return (
                <li key={letter} className="flex gap-1.5">
                  <b className="w-4">{letter}</b>
                  {!v ? <span className="text-[#8A8780]">işaret yok (metinde geçmiyor)</span>
                    : v.stance === 'correct' ? <span className="text-[#15803D] font-semibold">✓ doğru cevap</span>
                      : <span className="text-[#8B1E2D]">✗ elenir{v.inferred ? ` · açıklamanın sonunda (“${trigger}”)` : ` · “${trigger}” denince`}</span>}
                </li>
              );
            })}
          </ul>
        )}
        {check.characters > SPOKEN_LIMIT && <p role="alert">Seslendirme için metni {SPOKEN_LIMIT.toLocaleString('tr')} karakterin altına kısaltın.</p>}
        {check.missing.length > 0 && <p>Metinde şık başlığı bulunamadı: {check.missing.join(', ')}. Açıklamalarınızı kontrol edin.</p>}
        {check.mismatch && (
          <p role="alert">
            Metin {check.mismatch} diyor; seçili cevap {currentProject.correctAnswer}. Ses üretmeden önce düzeltin.
          </p>
        )}
      </section>
    )
  );
}
