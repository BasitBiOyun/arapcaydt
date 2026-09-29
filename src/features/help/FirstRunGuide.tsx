import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from '@phosphor-icons/react';
import { helpImage } from './helpTopics';

const STEPS = [
  { title: 'Soru Stüdyosu’na hoş geldiniz', text: 'Soru görselinizi ve çözümünüzü sesli, işaretli bir çözüm videosuna dönüştürürsünüz. Size birkaç adımda stüdyoyu tanıtalım.', image: 'panel' },
  { title: 'Yeni bir soruyla başlayın', text: 'Sol üstteki kırmızı “Yeni soru” düğmesine basın, soru türünü seçin ve soru görselinizi yükleyin.', image: 'yeni-soru' },
  { title: 'Beş kolay adım', text: 'Her soru aynı sırayla ilerler: Soru → Metin → Ses → İşaretler → İndir. Çalışmanız kendiliğinden kaydedilir.', image: 'adimlar' },
  { title: 'Sorularınız bir arada', text: '“Sorularım” sayfasında sorularınızı arar, sıralar, koleksiyonlara ayırır ve yedeğini alırsınız. Silinen sorular 30 gün çöp kutusunda bekler.', image: 'soru-listesi' },
  { title: 'Yardım her zaman yanınızda', text: 'Bir şeyi unuttuğunuzda sol menüdeki “Yardım ve rehber” sayfasını açın: her konu resimlerle anlatılır.', image: 'yardim' },
];

/** Once per teacher on this device; the help page can show it again. */
export const guideSeenKey = (userId: string) => `studio-guide-seen:${userId}`;
export function guideSeen(userId: string): boolean {
  try { return localStorage.getItem(guideSeenKey(userId)) === 'yes'; } catch { return true; }
}

export function FirstRunGuide({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => { primary.current?.focus(); }, [step]);
  const close = () => {
    try { localStorage.setItem(guideSeenKey(userId), 'yes'); } catch { /* shows again next time */ }
    onClose();
  };
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="guide-title"
      onKeyDown={e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight' && !last) setStep(step + 1); if (e.key === 'ArrowLeft' && step) setStep(step - 1); }}>
      <div className="first-run-guide">
        <button className="guide-close" onClick={close} aria-label="Tanıtımı kapat"><X size={22} /></button>
        <img src={helpImage(current.image)} alt="" />
        <div className="guide-body">
          <p className="guide-count">{step + 1} / {STEPS.length}</p>
          <h2 id="guide-title">{current.title}</h2>
          <p>{current.text}</p>
          <div className="guide-dots" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
          <div className="guide-actions">
            <button className="guide-skip" onClick={close}>{last ? '' : 'Tanıtımı geç'}</button>
            {step > 0 && <button className="studio-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={18} />Geri</button>}
            <button ref={primary} className="studio-primary" onClick={() => (last ? close() : setStep(step + 1))}>
              {last ? 'Başlayalım' : 'İleri'}{!last && <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
