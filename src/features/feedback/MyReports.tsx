import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChatCircleText, X } from '@phosphor-icons/react';
import { supabase } from '../../services/supabase';
import type { FeedbackContext } from './feedback';

interface MyReport {
  id: string;
  message: string;
  context: Partial<FeedbackContext>;
  status: 'open' | 'resolved';
  created_at: string;
  reply: string | null;
  replied_at: string | null;
}

const SEEN = 'studio-report-replies-seen';
const readSeen = () => { try { return localStorage.getItem(SEEN) || ''; } catch { return ''; } };
/** Replies newer than the last time the teacher opened Bildirimlerim on this device. */
export const unseenReplies = (reports: Pick<MyReport, 'replied_at'>[], seen: string) =>
  reports.filter(r => r.replied_at && r.replied_at > seen).length;

const when = (iso: string) => new Date(iso).toLocaleString('tr', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "Bildirimlerim" in the side menu: the teacher's own reports and the admin's replies. */
export function MyReports() {
  const [reports, setReports] = useState<MyReport[]>([]);
  const [seen, setSeen] = useState(readSeen);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getSession();
    const me = auth.session?.user.id;
    if (!me) return;
    // Admins can read every report; this list is only the signed-in person's own.
    const { data, error } = await supabase.from('feedback').select('id,message,context,status,created_at,reply,replied_at')
      .eq('owner_id', me).order('created_at', { ascending: false }).limit(30);
    if (!error) setReports((data || []) as MyReport[]);
  }, []);
  useEffect(() => {
    void load().catch(() => undefined);
    // A reply written while the teacher works shows up when they come back to the tab.
    const onFocus = () => { void load().catch(() => undefined); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!reports.length) return null;
  const unseen = unseenReplies(reports, seen);
  const show = () => {
    setOpen(true);
    const latest = reports.reduce((max, r) => (r.replied_at && r.replied_at > max ? r.replied_at : max), seen);
    try { localStorage.setItem(SEEN, latest); } catch { /* per-device only */ }
    setSeen(latest);
  };

  return (
    <>
      <button type="button" onClick={show}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-[#55544F] hover:bg-[#F0EFEA] hover:text-[#8B1E2D] transition-colors">
        <span className="flex items-center gap-3"><ChatCircleText size={18} /> Bildirimlerim</span>
        {unseen > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-[#8B1E2D] text-white">{unseen} yanıt</span>}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="my-reports-title" onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-xl border border-[#E5E4DC] shadow-xl p-5 space-y-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="my-reports-title" className="text-base font-bold text-[#1C1917]">Bildirimlerim</h2>
                <p className="text-xs text-[#787670] mt-0.5">Gönderdiğiniz sorun bildirimleri ve yöneticinin yanıtları.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[#F0EFEA] text-[#787670]" aria-label="Kapat"><X size={16} /></button>
            </div>
            <ul className="space-y-3">
              {reports.map(r => (
                <li key={r.id} className="rounded-lg border p-3 text-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-[#787670]">{when(r.created_at)}{r.context?.projectTitle ? ` · ${r.context.projectTitle}` : r.context?.page ? ` · ${r.context.page}` : ''}</p>
                    <span className={`text-xs font-semibold shrink-0 ${r.status === 'resolved' ? 'text-[#15803D]' : 'text-[#78540E]'}`}>{r.status === 'resolved' ? 'Çözüldü' : 'Bekliyor'}</span>
                  </div>
                  {r.context?.reason && <p className="font-semibold text-[#33322E]">{r.context.reason}</p>}
                  {r.message && <p className="whitespace-pre-line text-[#33322E]">{r.message}</p>}
                  {r.reply && (
                    <p className="rounded-lg bg-[#F1F7F2] border border-[#CFE3D3] px-3 py-2 text-[#1E562A] whitespace-pre-line">
                      <span className="font-semibold">Yönetici{r.replied_at ? ` (${when(r.replied_at)})` : ''}:</span> {r.reply}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
