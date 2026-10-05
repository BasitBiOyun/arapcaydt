import { useEffect, useState } from 'react';
import { Megaphone, X } from '@phosphor-icons/react';
import { loadAnnouncement } from './studioSettings';
import { FormattedText } from '../../components/common/FormattedText';

const DISMISSED = 'studio-announcement-dismissed';
const readDismissed = () => { try { return localStorage.getItem(DISMISSED) || ''; } catch { return ''; } };

/** The admin's announcement above every page; closing hides this version until it is edited. */
export function AnnouncementBanner() {
  const [note, setNote] = useState<{ text: string; updatedAt: string } | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  useEffect(() => {
    let live = true;
    const load = () => void loadAnnouncement().then(n => { if (live) setNote(n); }).catch(() => undefined);
    load();
    const timer = setInterval(load, 5 * 60000);
    return () => { live = false; clearInterval(timer); };
  }, []);
  if (!note || dismissed === note.updatedAt) return null;
  const close = () => { setDismissed(note.updatedAt); try { localStorage.setItem(DISMISSED, note.updatedAt); } catch { /* per-device only */ } };
  return (
    <div role="status" className="flex items-start gap-2.5 px-5 py-2.5 bg-[#FAF5E6] border-b border-[#E5D7B0] text-sm text-[#5C420B]">
      <Megaphone size={18} weight="fill" className="shrink-0 mt-0.5 text-[#B45309]" />
      <FormattedText text={note.text} className="flex-1 min-w-0 max-h-[40vh] overflow-y-auto" />
      <button type="button" onClick={close} className="p-1 -m-1 rounded hover:bg-[#F0E6C8]" aria-label="Duyuruyu kapat" title="Kapat"><X size={14} weight="bold" /></button>
    </div>
  );
}
