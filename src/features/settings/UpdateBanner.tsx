import { useEffect, useState } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';

/** The bundle this page runs ("assets/index-<hash>.js"), or null in development. */
export const bundleOf = (html: string) => /assets\/index-[\w-]+\.js/.exec(html)?.[0] ?? null;

/**
 * A page left open keeps running the studio as it was when it was opened. Every few minutes (and
 * when the tab comes back) it checks whether a newer studio is out and, if so, asks to reload, so
 * a fix is never missed because the tab was old.
 */
export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const mine = bundleOf(document.documentElement.innerHTML);
    if (!mine) return;
    let live = true;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/', { cache: 'no-store' }).then(r => r.text()).then(html => {
        const latest = bundleOf(html);
        if (live && latest && latest !== mine) setStale(true);
      }).catch(() => undefined);
    };
    const timer = setInterval(check, 5 * 60000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); };
  }, []);
  if (!stale) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 px-5 py-2.5 bg-[#EEF4FF] border-b border-[#C7D7F5] text-sm text-[#1E3A8A]">
      <ArrowClockwise size={18} weight="bold" className="shrink-0" />
      <p className="flex-1 min-w-0">Stüdyonun yeni bir sürümü yayınlandı. Düzeltmelerin çalışması için sayfayı yenileyin; kaydedilmiş çalışmalarınız korunur.</p>
      <button type="button" className="studio-primary !min-h-0 !py-1.5" onClick={() => window.location.reload()}>Sayfayı yenile</button>
    </div>
  );
}
