import { useEffect, useState } from 'react';
import { FileXls, MagnifyingGlass } from '@phosphor-icons/react';
import { getCategoryLabel } from '../../config/categories';
import { saveFile } from '../../services/narration/browserMedia';
import { plainMessage } from '../../services/plainError';
import { AdminProjectRow, PAGE_SIZE, ProgressFilter, loadAllProjects, loadProjectPage, progressLabel, projectsCsv } from './adminProjects';
import { Member, SectionTitle, card, dateTime } from './adminShared';

/**
 * Every question of every teacher, a page at a time: by teacher, finished or not, or by a word of
 * its title, collection or topic. The same list downloads as an Excel file.
 */
export function ProjectsBrowser({ members, who, busy, open, owner, onOwner }: {
  members: Member[]; who: (id: string) => string; busy: boolean; open: (id: string) => Promise<void>;
  owner: string; onOwner: (id: string) => void;
}) {
  const [progress, setProgress] = useState<ProgressFilter>('all');
  const [search, setSearch] = useState('');
  const [typed, setTyped] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ rows: AdminProjectRow[]; total: number } | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // A pause in typing searches; a new filter starts again from the first page.
  useEffect(() => { const t = setTimeout(() => setSearch(typed), 350); return () => clearTimeout(t); }, [typed]);
  useEffect(() => { setPage(0); }, [owner, progress, search]);
  useEffect(() => {
    let live = true;
    setError('');
    loadProjectPage({ owner: owner || undefined, progress, search }, page)
      .then(r => live && setResult(r), e => live && setError(plainMessage(e, 'Soru listesi okunamadı.')));
    return () => { live = false; };
  }, [owner, progress, search, page]);

  const download = async () => {
    setExporting(true);
    try {
      const rows = await loadAllProjects({ owner: owner || undefined, progress, search });
      const name = owner ? who(owner).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '-') : 'tum-ogretmenler';
      saveFile(new Blob([projectsCsv(rows, who)], { type: 'text/csv;charset=utf-8' }), `sorular-${name}.csv`);
    } catch (e) {
      setError(plainMessage(e, 'Excel listesi hazırlanamadı.'));
    } finally {
      setExporting(false);
    }
  };

  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const teachers = members.filter(m => m.questions > 0).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'tr'));
  return (
    <section className={card}>
      <SectionTitle title="Sorular" note="Bütün öğretmenlerin soruları, son değişiklik en üstte. Öğretmene, duruma ya da başlık, koleksiyon veya konudaki bir kelimeye göre süzün; aynı liste Excel olarak iner."
        action={<button type="button" className="studio-secondary !min-h-0 !py-2" disabled={exporting || !result?.total} onClick={() => void download()}>
          <FileXls size={16} /> {exporting ? 'Hazırlanıyor…' : 'Excel olarak indir'}
        </button>} />
      <div className="flex flex-wrap gap-2 mb-3">
        <select aria-label="Öğretmen" value={owner} onChange={e => onOwner(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white">
          <option value="">Bütün öğretmenler</option>
          {teachers.map(m => <option key={m.id} value={m.id}>{m.name || m.email} ({m.questions})</option>)}
        </select>
        <select aria-label="Durum" value={progress} onChange={e => setProgress(e.target.value as ProgressFilter)} className="border rounded-lg px-2 py-2 text-sm bg-white">
          <option value="all">Hepsi</option>
          <option value="completed">Tamamlananlar</option>
          <option value="open">Devam edenler</option>
        </select>
        <label className="flex items-center gap-2 border rounded-lg px-2 py-1.5 text-sm bg-white flex-1 min-w-[200px]">
          <MagnifyingGlass size={16} className="text-[#787670]" />
          <input aria-label="Soru ara" placeholder="Başlık, koleksiyon veya konu" value={typed} onChange={e => setTyped(e.target.value)} className="flex-1 outline-none" />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-[#8B1E2D] mb-2">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-[#666560]">
            <tr>{['Soru', 'Öğretmen', 'Koleksiyon', 'Konu', 'Tür', 'Durum', 'Son değişiklik'].map(t => <th key={t} className="px-2 py-2 font-semibold whitespace-nowrap">{t}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#EFEFEA]">
            {result?.rows.map(p => (
              <tr key={p.id}>
                <td className="px-2 py-2">
                  <button disabled={busy} className="font-semibold text-[#8B1E2D] hover:underline text-left" onClick={() => void open(p.id)}>{p.title || 'Adsız soru'}</button>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{who(p.owner_id)}</td>
                <td className="px-2 py-2 text-[#55544F]">{[p.examName, p.questionNumber ? `${p.questionNumber}. soru` : ''].filter(Boolean).join(' · ')}</td>
                <td className="px-2 py-2 text-[#55544F]">{p.topic || ''}</td>
                <td className="px-2 py-2 text-[#55544F]">{p.category ? getCategoryLabel(p.category) : ''}</td>
                <td className={`px-2 py-2 whitespace-nowrap ${p.completedAt ? 'text-[#166534] font-semibold' : ''}`}>{progressLabel(p)}</td>
                <td className="px-2 py-2 text-xs text-[#787670] whitespace-nowrap">{dateTime(p.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result && !result.rows.length && <p className="text-sm text-[#787670] py-3">Bu süzgece uyan soru yok.</p>}
      </div>
      {result && result.total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 mt-3 text-sm">
          <span className="text-[#787670]">{result.total} sorudan {page * PAGE_SIZE + 1}–{Math.min(result.total, (page + 1) * PAGE_SIZE)}</span>
          <div className="flex gap-2">
            <button type="button" className="studio-secondary !min-h-0 !py-1.5" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Önceki</button>
            <button type="button" className="studio-secondary !min-h-0 !py-1.5" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Sonraki</button>
          </div>
        </div>
      )}
    </section>
  );
}
