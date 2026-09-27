import React from 'react';
import type { QuestionProject } from '../../../types';
import { checkNarration } from '../workflow';

export interface NarrationCheckProps {
  step: number;
  check: ReturnType<typeof checkNarration>;
  currentProject: QuestionProject;
}

export function NarrationCheck({ step, check, currentProject }: NarrationCheckProps) {
  return (
    (step===1||step===2)&&<section className="narration-check" aria-label="Ses ön kontrolü"><strong>{check.characters.toLocaleString('tr')} / 5.000 karakter</strong><p>Doğru cevap: {currentProject.correctAnswer}.</p>{check.characters>5000&&<p role="alert">Tek ses için metni 5.000 karakterin altına kısaltın.</p>}{check.missing.length>0&&<p>Metinde şık başlığı bulunamadı: {check.missing.join(', ')}. Açıklamalarınızı kontrol edin.</p>}{check.mismatch&&<p role="alert">Metin {check.mismatch} diyor; seçili cevap {currentProject.correctAnswer}. Ses üretmeden önce düzeltin.</p>}</section>
  );
}
