import React, { useCallback, useEffect, useState } from 'react';
import { authHeaders } from '../../services/supabase';

type Bucket = { count: number; bytes: number };
interface StorageInfo {
  migrationPending: boolean;
  totalBytes: number;
  limitBytes: number;
  byKind: Record<'wav' | 'mp3' | 'image' | 'other', Bucket>;
  orphans: Bucket;
  convertible: number;
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('tr', { maximumFractionDigits: bytes < 10 * 1024 * 1024 ? 1 : 0 })} MB`;

async function call(body?: unknown) {
  const res = await fetch('/api/admin/storage', {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...await authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Depolama servisi hata döndürdü (HTTP ${res.status}).`);
  return data;
}

const AUTO_SWEEP_KEY = 'studio-auto-sweep';
const WEEK_MS = 7 * 24 * 3600 * 1000;
/** Whether a week has passed since this browser last cleaned up automatically. */
export function autoSweepDue(now = Date.now(), last = (() => { try { return Number(localStorage.getItem(AUTO_SWEEP_KEY)) || 0; } catch { return now; } })()): boolean {
  return now - last >= WEEK_MS;
}
const markAutoSweep = () => { try { localStorage.setItem(AUTO_SWEEP_KEY, String(Date.now())); } catch { /* per-device only */ } };

/** Admin panel: Supabase storage usage, WAV → MP3 conversion and removal of files no project uses. */
export const StorageSection: React.FC = () => {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { const next: StorageInfo = await call(); setInfo(next); setError(''); return next; }
    catch (e) { setError(e instanceof Error ? e.message : 'Depolama bilgisi alınamadı.'); return null; }
  }, []);
  // Weekly automatic cleanup when an admin opens the panel: unused files older than 7 days go.
  useEffect(() => {
    void load().then(async first => {
      if (!first || first.migrationPending || !first.orphans.count || !autoSweepDue()) return;
      setBusy(true);
      try {
        const r = await call({ action: 'sweep', scope: 'all' });
        markAutoSweep();
        if (r.removed) setProgress(`Otomatik temizlik: ${r.removed} kullanılmayan dosya silindi, ${mb(r.bytes)} yer açıldı.`);
      } catch { /* the manual button still works */ }
      finally { setBusy(false); await load(); }
    });
  }, [load]);

  const convertAll = async () => {
    if (!info || !window.confirm(`${info.convertible} WAV ses MP3'e çevrilecek. Kelime zamanlamaları değişmez. Devam edilsin mi?`)) return;
    setBusy(true); setError('');
    const skip: string[] = [];
    let done = 0;
    try {
      for (;;) {
        const r = await call({ action: 'convert', skip });
        done += r.converted;
        for (const f of r.failures) skip.push(f.path);
        setProgress(`${done} ses MP3'e çevrildi${skip.length ? `, ${skip.length} atlandı` : ''} · ${r.remaining} kaldı`);
        if (!r.remaining || (!r.converted && !r.failures.length)) break;
      }
      const swept = await call({ action: 'sweep', scope: 'wav' });
      setProgress(`${done} ses MP3'e çevrildi, eski WAV dosyalarından ${mb(swept.bytes)} yer açıldı.${skip.length ? ` ${skip.length} ses atlandı (proje o sırada değişmiş olabilir); tekrar çalıştırabilirsiniz.` : ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dönüştürme tamamlanamadı.');
    } finally {
      setBusy(false);
      await load();
    }
  };

  const sweepAll = async () => {
    if (!info || !window.confirm(`Hiçbir projenin kullanmadığı ${info.orphans.count} dosya (${mb(info.orphans.bytes)}) kalıcı olarak silinecek. Son 7 günde oluşan dosyalara dokunulmaz. Devam edilsin mi?`)) return;
    setBusy(true); setError('');
    try {
      const r = await call({ action: 'sweep', scope: 'all' });
      setProgress(`${r.removed} kullanılmayan dosya silindi, ${mb(r.bytes)} yer açıldı.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silme tamamlanamadı.');
    } finally {
      setBusy(false);
      await load();
    }
  };

  const share = info ? info.totalBytes / info.limitBytes : 0;
  const barColor = share > 0.9 ? 'bg-red-600' : share > 0.7 ? 'bg-amber-500' : 'bg-[#15803D]';

  return (
    <section className="bg-white border rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Depolama</h3>
          <p className="text-xs text-stone-500 mt-1">Supabase ücretsiz planı 1 GB. Görseller ve sesler burada tutulur; MP4'ler tutulmaz.</p>
        </div>
        <button disabled={busy} onClick={() => void load()} className="border rounded px-3 py-1.5 text-sm">Yenile</button>
      </div>
      {error && <p role="alert" className="mt-3 bg-red-50 text-red-800 p-2 rounded text-sm">{error}</p>}
      {info?.migrationPending && (
        <p className="mt-3 text-sm bg-amber-50 text-amber-900 border border-amber-200 rounded p-3">
          Depolama göstergesi için <code>supabase/migrations/20260930_storage_admin.sql</code> dosyasını Supabase SQL Editor'da bir kez çalıştırın.
        </p>
      )}
      {info && !info.migrationPending && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="flex justify-between text-sm"><strong>{mb(info.totalBytes)}</strong><span className="text-stone-500">/ {mb(info.limitBytes)} · %{Math.round(share * 100)}</span></div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden mt-1"><div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, share * 100)}%` }} /></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            {([['Ses (MP3)', info.byKind.mp3], ['Ses (WAV, eski)', info.byKind.wav], ['Görseller', info.byKind.image], ['Kullanılmayan', info.orphans]] as Array<[string, Bucket]>).map(([label, b]) => (
              <div key={label} className="border rounded-lg px-3 py-2"><p className="text-xs text-stone-500">{label}</p><strong>{mb(b.bytes)}</strong><span className="text-xs text-stone-500"> · {b.count} dosya</span></div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || !info.convertible} onClick={() => void convertAll()}
              className="bg-[#8B1E2D] hover:bg-[#721824] disabled:opacity-50 text-white rounded px-3 py-2 text-sm font-semibold">
              {info.convertible ? `${info.convertible} WAV sesi MP3'e çevir` : 'Çevrilecek WAV ses yok'}
            </button>
            <button disabled={busy || !info.orphans.count} onClick={() => void sweepAll()}
              className="border border-[#8B1E2D] text-[#8B1E2D] hover:bg-[#F8EEEE] disabled:opacity-50 rounded px-3 py-2 text-sm font-semibold">
              {info.orphans.count ? `Kullanılmayan ${info.orphans.count} dosyayı sil (${mb(info.orphans.bytes)})` : 'Kullanılmayan dosya yok'}
            </button>
          </div>
          {progress && <p role="status" className="text-sm text-[#1E562A]">{busy ? '⏳ ' : ''}{progress}</p>}
          <p className="text-xs text-stone-500">
            Çeviri sesi 6 kat küçültür, animasyon zamanlaması değişmez. "Kullanılmayan" dosyalar, hiçbir projenin artık göstermediği eski ses ve görsellerdir (yeniden seslendirme, silinen projeler); son 7 gündekiler korunur. Bu panel haftada bir açıldığında kullanılmayan dosyalar otomatik temizlenir. Yeni yüklenen soru görselleri kaydedilmeden önce küçültülür.
          </p>
        </div>
      )}
    </section>
  );
};
