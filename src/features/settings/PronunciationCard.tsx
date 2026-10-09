import React, { useEffect, useState } from 'react';
import { SpeakerHigh, Trash } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthContext';
import { database } from '../../services/supabase';
import { isMigrationPending, MIGRATION_PENDING } from './studioSettings';
import { CardHeader, Result, card, field, primary } from './MySettingsCards';
import { plainMessage } from '../../services/plainError';

interface Entry { id: string; written: string; spoken: string; created_by: string }

/**
 * "Telaffuz sözlüğü": one list shared by all teachers. The voice reads each written word as its
 * spoken form; the solution text on screen and in the video stays as written (server/pronunciation.ts).
 */
export function PronunciationCard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [written, setWritten] = useState(''), [spoken, setSpoken] = useState(''), [filter, setFilter] = useState('');
  const [state, setState] = useState<{ notice?: string; error?: string; busy?: boolean }>({});

  const load = async () => {
    const { data, error } = await database().from('pronunciations').select('id, written, spoken, created_by').order('written');
    if (error) return setState({ error: isMigrationPending(error) ? MIGRATION_PENDING : plainMessage(error, 'Sözlük kaydedilemedi.') });
    setEntries(data as Entry[]);
  };
  useEffect(() => {
    void load();
    // Opened from the Ses step's link: bring the list into view.
    if (window.location.hash.includes('telaffuz')) document.getElementById('telaffuz')?.scrollIntoView({ block: 'start' });
  }, []);
  if (!user) return null;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!written.trim() || !spoken.trim()) return setState({ error: 'İki kutuyu da doldurun.' });
    setState({ busy: true });
    const { error } = await database().from('pronunciations').insert({ written: written.trim(), spoken: spoken.trim() });
    if (error) return setState({ error: error.code === '23505' ? 'Bu kelime sözlükte zaten var.' : isMigrationPending(error) ? MIGRATION_PENDING : plainMessage(error, 'Sözlük kaydedilemedi.') });
    setWritten(''); setSpoken('');
    setState({ notice: 'Eklendi. Bundan sonra seslendirilen metinlerde böyle okunur.' });
    await load();
  };
  const remove = async (entry: Entry) => {
    const { error } = await database().from('pronunciations').delete().eq('id', entry.id);
    if (error) return setState({ error: plainMessage(error, 'Sözlük kaydedilemedi.') });
    setState({ notice: `“${entry.written}” sözlükten çıkarıldı.` });
    await load();
  };
  const query = filter.trim().toLocaleLowerCase('tr');
  const shown = query ? entries.filter(e => (e.written + ' ' + e.spoken).toLocaleLowerCase('tr').includes(query)) : entries;

  return (
    <section id="telaffuz" className={card}>
      <CardHeader icon={SpeakerHigh} title="Telaffuz sözlüğü" hint="Bütün hocaların ortak listesi; ses bu kelimeleri yazdığınız gibi okur" />
      <p className="text-xs text-[#55544F] leading-relaxed">
        Ses bir kelimeyi yanlış okuyorsa buraya ekleyin: solda çözümde yazdığınız hâli, sağda nasıl okunması gerektiği.
        Ekranda ve videoda görünen yazı değişmez; yalnız ses böyle okur. Yeni eklenen kelime, sonraki seslendirmelerde geçerli olur.
      </p>
      <form onSubmit={add} className="flex flex-wrap gap-2 text-xs">
        <input aria-label="Yazılışı" placeholder="Yazılışı (ör. MEB)" maxLength={60} className={`${field} !w-auto flex-1 min-w-40`} value={written} onChange={e => setWritten(e.target.value)} />
        <input aria-label="Okunuşu" placeholder="Okunuşu (ör. Meb)" maxLength={120} className={`${field} !w-auto flex-1 min-w-40`} value={spoken} onChange={e => setSpoken(e.target.value)} />
        <button className={primary} disabled={state.busy}>Ekle</button>
      </form>
      <Result {...state} />
      {entries.length > 8 && <input aria-label="Sözlükte ara" placeholder="Sözlükte ara" className={field} value={filter} onChange={e => setFilter(e.target.value)} />}
      {shown.length > 0 && (
        <ul className="divide-y divide-[#EFEFEA] border border-[#EFEFEA] rounded max-h-80 overflow-y-auto text-sm">
          {shown.map(entry => (
            <li key={entry.id} className="flex items-center gap-3 px-3 py-1.5">
              <span dir="auto" className="font-semibold text-[#1C1917] min-w-0 break-words">{entry.written}</span>
              <span className="text-[#A3A29B]">→</span>
              <span dir="auto" className="flex-1 text-[#33322E] min-w-0 break-words">{entry.spoken}</span>
              {(entry.created_by === user.id || user.role === 'admin') && (
                <button type="button" aria-label={`${entry.written} kelimesini sil`} title="Sil" onClick={() => void remove(entry)}
                  className="p-1 rounded text-[#787670] hover:text-red-700 hover:bg-red-50 cursor-pointer"><Trash size={15} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!entries.length && !state.error && <p className="text-xs text-[#787670]">Sözlük henüz boş.</p>}
    </section>
  );
}
