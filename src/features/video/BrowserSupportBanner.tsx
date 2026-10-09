import { useEffect, useState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { isTouchDevice, supportMessage, videoSupportProblem } from './browserSupport';

const DISMISS_KEY = 'browser-support-dismissed';

/** Says at the start, not at "İndir", when this browser or device cannot make the video. */
export function BrowserSupportBanner() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void videoSupportProblem().then(problem => {
      const text = supportMessage(problem, isTouchDevice());
      let dismissed = false;
      try { dismissed = sessionStorage.getItem(DISMISS_KEY) === text; } catch { /* private mode */ }
      if (live && text && !dismissed) setMessage(text);
    });
    return () => { live = false; };
  }, []);
  if (!message) return null;
  const close = () => {
    try { sessionStorage.setItem(DISMISS_KEY, message); } catch { /* private mode */ }
    setMessage(null);
  };
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
      <Warning size={18} weight="bold" className="shrink-0" />
      <p className="flex-1 min-w-0">{message}</p>
      <button type="button" className="studio-secondary !min-h-0 !py-1.5" onClick={close}>Anladım</button>
    </div>
  );
}
