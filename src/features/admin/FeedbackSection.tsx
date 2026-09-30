import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Lifebuoy } from '@phosphor-icons/react';
import { database } from '../../services/supabase';
import { isMigrationPending } from '../settings/studioSettings';
import type { FeedbackContext } from '../feedback/feedback';

interface Report {
  id: string;
  owner_id: string;
  message: string;
  context: Partial<FeedbackContext>;
  status: 'open' | 'resolved';
  created_at: string;
}

const when = (iso: string) => new Date(iso).toLocaleString('tr', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Admin panel: teachers' "Sorun bildir" reports, newest first; open ones on top. */
/** Saves a report's teşhis record as the same file the editor's "Teşhis dosyasını indir" gives. */
async function downloadDiagnostics(report: Report) {
  const { data, error } = await database().from('feedback').select('diagnostics').eq('id', report.id).single();
  if (error || !data?.diagnostics) throw new Error('Teşhis kaydı okunamadı.');
  const blob = new Blob([JSON.stringify(data.diagnostics, null, 1)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const title = (report.context?.projectTitle || 'soru').replace(/[^\p{L}\p{N}]+/gu, '-');
  link.download = `teshis-${title}-${report.created_at.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function FeedbackSection({ who, onOpen }: { who: (ownerId: string) => string; onOpen?: (projectId: string) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'pending' | 'error'>('loading');
  const [showResolved, setShowResolved] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await database().from('feedback').select('id,owner_id,message,context,status,created_at')
      .order('created_at', { ascending: false }).limit(100);
    if (error) return setState(isMigrationPending(error) ? 'pending' : 'error');
    setReports((data || []) as Report[]);
    setState('ready');
  }, []);
  useEffect(() => { void load().catch(() => setState('error')); }, [load]);

  const resolve = async (id: string) => {
    const { error } = await database().from('feedback').update({ status: 'resolved' }).eq('id', id);
    if (!error) setReports(list => list.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
  };

  const open = reports.filter(r => r.status === 'open');
  const shown = showResolved ? reports : open;
  if (state === 'loading') return null;

  return (
    <section className={`rounded-xl border p-5 ${open.length ? 'border-[#DFC8CB] bg-[#FDF7F7]' : 'bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Lifebuoy size={18} className="text-[#8B1E2D]" />Sorun bildirimleri{open.length ? ` (${open.length} açık)` : ''}</h3>
        {state === 'ready' && reports.length > open.length && (
          <button type="button" className="text-xs font-semibold text-[#8B1E2D]" onClick={() => setShowResolved(v => !v)}>
            {showResolved ? 'Yalnız açıkları göster' : 'Çözülenleri de göster'}
          </button>
        )}
      </div>
      {state === 'pending' && <p className="text-sm text-[#78540E]">Bildirimler için veritabanı güncellemesi bekleniyor (supabase/migrations/20261003_feedback.sql). O zamana kadar hocaların bildirimleri e-posta taslağı olarak size gelir.</p>}
      {state === 'error' && <p className="text-sm text-[#8B1E2D]">Bildirimler okunamadı.</p>}
      {state === 'ready' && !shown.length && <p className="text-sm text-[#787670]">Açık bildirim yok.</p>}
      {downloadError && <p role="alert" className="text-sm text-[#8B1E2D] mb-2">{downloadError}</p>}
      <ul className="space-y-3">
        {shown.map(report => {
          const c = report.context || {};
          return (
            <li key={report.id} className="rounded-lg border bg-white p-4 text-sm space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{who(report.owner_id)}</p>
                  <p className="text-xs text-[#787670]">{when(report.created_at)}{c.page ? ` · ${c.page}` : ''}{c.projectTitle ? ` · ${c.projectTitle}` : ''}{c.step ? ` · ${c.step} adımı` : ''}</p>
                </div>
                {report.status === 'open'
                  ? <button type="button" onClick={() => void resolve(report.id)} className="px-2.5 py-1 rounded border text-xs font-semibold hover:bg-[#F0EFEA] inline-flex items-center gap-1"><CheckCircle size={14} />Çözüldü</button>
                  : <span className="text-xs font-semibold text-[#15803D]">Çözüldü</span>}
              </div>
              {c.reason && <p className="font-semibold text-[#8B1E2D]">{c.reason}</p>}
              {(report.message || !c.reason) && <p className="whitespace-pre-line text-[#33322E]">{report.message || <span className="text-[#787670]">(Açıklama yazılmadı)</span>}</p>}
              {(c.projectId || c.hasDiagnostics) && (
                <div className="flex flex-wrap gap-3 text-xs font-semibold">
                  {c.projectId && onOpen && <button type="button" className="text-[#8B1E2D] hover:underline" onClick={() => onOpen(c.projectId!)}>Soruyu aç</button>}
                  {c.hasDiagnostics && (
                    <button type="button" className="text-[#8B1E2D] hover:underline"
                      onClick={() => { setDownloadError(''); downloadDiagnostics(report).catch(e => setDownloadError(e.message)); }}>
                      Teşhis dosyasını indir
                    </button>
                  )}
                </div>
              )}
              {!!c.shownErrors?.length && <p className="text-xs text-[#8B1E2D]">Ekrandaki uyarı: {c.shownErrors.join(' · ')}</p>}
              {!!c.recentErrors?.length && (
                <details className="text-xs text-[#55544F]">
                  <summary className="cursor-pointer">Son hatalar ({c.recentErrors.length})</summary>
                  <ul className="mt-1 space-y-0.5 font-mono-code break-all">{c.recentErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
              {c.browser && <p className="text-xs text-[#8A8780] break-all">{c.browser} · {c.screen}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
