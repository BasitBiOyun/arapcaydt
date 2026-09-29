import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  /** Text of the button that goes ahead, e.g. "Sil". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button for actions that throw work away. */
  danger?: boolean;
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<Ask | null>(null);

/**
 * One calm, readable question before anything that cannot be undone. Large buttons, Esc or a
 * click outside cancels, Enter confirms; the safe choice has the focus for dangerous actions.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  const ask = useCallback<Ask>(options => new Promise(resolve => setOpen({ ...options, resolve })), []);
  const close = (ok: boolean) => { open?.resolve(ok); setOpen(null); };

  useEffect(() => {
    if (!open) return;
    (open.danger ? cancelButton : confirmButton).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onMouseDown={() => close(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#E5E4DC] p-6 space-y-4" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <WarningCircle size={28} weight="fill" className={open.danger ? 'text-[#B91C1C] shrink-0' : 'text-[#8B1E2D] shrink-0'} />
              <div className="space-y-1.5">
                <h2 id="confirm-title" className="text-lg font-semibold text-[#1C1917]">{open.title}</h2>
                {open.message && <div className="text-[15px] leading-relaxed text-[#55544F]">{open.message}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button ref={cancelButton} type="button" onClick={() => close(false)}
                className="px-4 py-2.5 rounded-lg border border-[#D5D4CC] bg-white text-[15px] font-medium text-[#33322E] hover:bg-[#F2F1EB]">
                {open.cancelLabel || 'Vazgeç'}
              </button>
              <button ref={confirmButton} type="button" onClick={() => close(true)}
                className={`px-4 py-2.5 rounded-lg text-[15px] font-semibold text-white ${open.danger ? 'bg-[#B91C1C] hover:bg-[#991B1B]' : 'bg-[#8B1E2D] hover:bg-[#721824]'}`}>
                {open.confirmLabel || 'Devam et'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/** Asks the teacher before an irreversible step; resolves true only on an explicit yes. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  // Outside the provider (tests, isolated pages) the browser's own dialog still protects the work.
  return ask ?? (async options => window.confirm([options.title, typeof options.message === 'string' ? options.message : ''].filter(Boolean).join('\n\n')));
}
