import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChatCircleText, X } from '@phosphor-icons/react';
import { supabase } from '../../services/supabase';
import type { FeedbackContext } from '../feedback/feedback';
import { Conversation } from './Conversation';
import { loadConversation, messageTime, unread } from './messages';

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
/** Report replies newer than the last time the teacher opened Mesajlar on this device. */
export const unseenReplies = (reports: Pick<MyReport, 'replied_at'>[], seen: string) =>
  reports.filter(r => r.replied_at && r.replied_at > seen).length;

async function loadMyReports(me: string): Promise<MyReport[]> {
  if (!supabase) return [];
  // Admins can read every report; this list is only the signed-in person's own.
  const { data, error } = await supabase.from('feedback').select('id,message,context,status,created_at,reply,replied_at')
    .eq('owner_id', me).order('created_at', { ascending: false }).limit(30);
  return error ? [] : (data || []) as MyReport[];
}

/** "Mesajlar" in a teacher's side menu: the conversation with the admins and their own problem reports. */
export function Inbox({ userId }: { userId: string }) {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [reports, setReports] = useState<MyReport[]>([]);
  const [seen, setSeen] = useState(readSeen);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [messages, mine] = await Promise.all([loadConversation(userId).catch(() => []), loadMyReports(userId)]);
    setUnreadMessages(unread(messages, false));
    setReports(mine);
  }, [userId]);
  useEffect(() => {
    void refresh().catch(() => undefined);
    // A message written while the teacher works shows up when they come back to the tab, or within a few minutes.
    const again = () => { if (document.visibilityState === 'visible') void refresh().catch(() => undefined); };
    window.addEventListener('focus', again);
    const timer = window.setInterval(again, 3 * 60_000);
    return () => { window.removeEventListener('focus', again); window.clearInterval(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const badge = unreadMessages + unseenReplies(reports, seen);
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
        <span className="flex items-center gap-3"><ChatCircleText size={18} /> Mesajlar</span>
        {badge > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-[#8B1E2D] text-white tabular-nums">{badge}</span>}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="inbox-title" onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-[#E5E4DC] shadow-xl p-5 space-y-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="inbox-title" className="text-base font-bold text-[#1C1917]">Mesajlar</h2>
                <p className="text-xs text-[#787670] mt-0.5">Stüdyo yöneticisiyle yazışmanız. Yalnız siz ve yönetici görür.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[#F0EFEA] text-[#787670]" aria-label="Kapat"><X size={16} /></button>
            </div>
            <Conversation teacherId={userId} asAdmin={false} otherName="Yönetici" onChange={() => setUnreadMessages(0)} />
            {reports.length > 0 && (
              <section className="space-y-2 pt-2 border-t">
                <h3 className="text-sm font-semibold text-[#33322E]">Sorun bildirimlerim</h3>
                <ul className="space-y-2">
                  {reports.map(r => (
                    <li key={r.id} className="rounded-lg border p-3 text-sm space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-[#787670]">{messageTime(r.created_at)}{r.context?.projectTitle ? ` · ${r.context.projectTitle}` : r.context?.page ? ` · ${r.context.page}` : ''}</p>
                        <span className={`text-xs font-semibold shrink-0 ${r.status === 'resolved' ? 'text-[#15803D]' : 'text-[#78540E]'}`}>{r.status === 'resolved' ? 'Çözüldü' : 'Bekliyor'}</span>
                      </div>
                      {r.context?.reason && <p className="font-semibold text-[#33322E]">{r.context.reason}</p>}
                      {r.message && <p className="whitespace-pre-line text-[#33322E]">{r.message}</p>}
                      {r.reply && (
                        <p className="rounded-lg bg-[#F1F7F2] border border-[#CFE3D3] px-3 py-2 text-[#1E562A] whitespace-pre-line">
                          <span className="font-semibold">Yönetici{r.replied_at ? ` (${messageTime(r.replied_at)})` : ''}:</span> {r.reply}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
