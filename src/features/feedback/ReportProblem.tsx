import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Lifebuoy, WarningCircle, X } from '@phosphor-icons/react';
import { collectContext, sendFeedback, type FeedbackContext, type SendResult } from './feedback';

/**
 * "Sorun bildir": one click opens a short form; the page, the open question and
 * the latest error messages are attached automatically.
 */
export function ReportProblem({ variant = 'link', sender }: { variant?: 'link' | 'compact' | 'button'; sender?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const start = () => { setContext(collectContext()); setResult(null); setOpen(true); };
  const close = () => { setOpen(false); if (result?.sent) setMessage(''); };
  useEffect(() => { if (open) field.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!context) return;
    setBusy(true);
    setResult(await sendFeedback(message, context, sender));
    setBusy(false);
  };

  const trigger = variant === 'compact'
    ? 'flex items-center gap-1.5 text-xs font-semibold text-[#55544F] hover:text-[#8B1E2D] px-2.5 py-1.5 rounded hover:bg-[#F7EEEE] transition-colors'
    : variant === 'button'
      ? 'studio-secondary inline-flex items-center gap-1.5'
      : 'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#55544F] hover:bg-[#F0EFEA] hover:text-[#8B1E2D] transition-colors';

  return (
    <>
      <button type="button" className={trigger} onClick={start}>
        <Lifebuoy size={variant === 'link' ? 18 : 16} /> Sorun bildir
      </button>
      {/* Rendered on <body>: inside the editor's header it would sit under the video's play button. */}
      {open && context && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4" onClick={close}>
          <form role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={submit} onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-xl border border-[#E5E4DC] shadow-xl p-5 space-y-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="report-title" className="text-base font-bold text-[#1C1917]">Sorun bildir</h2>
                <p className="text-xs text-[#787670] mt-0.5">Bildiriminiz stüdyo yöneticisine iletilir.</p>
              </div>
              <button type="button" onClick={close} className="p-1 rounded hover:bg-[#F0EFEA] text-[#787670]" aria-label="Kapat"><X size={16} /></button>
            </div>
            {result?.sent ? (
              <div className="space-y-4">
                <p role="status" className="flex items-center gap-2 text-sm text-[#1E562A]"><CheckCircle size={18} weight="fill" /> Teşekkürler, bildiriminiz iletildi.</p>
                <button type="button" className="studio-primary w-full" onClick={close}>Tamam</button>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-[#33322E]">
                  Ne oldu? <span className="font-normal text-[#787670]">(isteğe bağlı)</span>
                  <textarea ref={field} value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={4}
                    placeholder="Örnek: Ses üret düğmesine bastım, uzun süre bekledi ve hata verdi."
                    className="mt-1.5 block w-full rounded-lg border border-[#D5D4CC] p-3 text-sm outline-none focus:border-[#8B1E2D]" />
                </label>
                <div className="rounded-lg bg-[#FAF9F5] border border-[#E5E4DC] p-3 text-xs text-[#55544F] space-y-1">
                  <p className="font-semibold text-[#33322E]">Otomatik eklenecek bilgiler</p>
                  {context.page && <p>Sayfa: {context.page}</p>}
                  {context.projectTitle && <p>Soru: {context.projectTitle}{context.step ? ` · ${context.step} adımı` : ''}</p>}
                  <p>{context.shownErrors.length ? `Ekrandaki uyarı: ${context.shownErrors[0]}` : 'Ekranda uyarı yok'}{context.recentErrors.length ? ` · son ${context.recentErrors.length} hata kaydı` : ''}</p>
                  <p>Tarayıcı ve ekran boyutu</p>
                </div>
                {result && !result.sent && (
                  <p role="alert" className="flex items-start gap-2 text-sm text-[#8B1E2D]">
                    <WarningCircle size={18} weight="fill" className="shrink-0 mt-0.5" />
                    <span>{result.reason} <a href={result.mailto} className="underline font-semibold">E-postayla gönderin</a>; bilgiler hazır olarak açılır.</span>
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" className="studio-secondary" onClick={close}>Vazgeç</button>
                  <button className="studio-primary" disabled={busy}>{busy ? 'Gönderiliyor…' : 'Gönder'}</button>
                </div>
              </>
            )}
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
