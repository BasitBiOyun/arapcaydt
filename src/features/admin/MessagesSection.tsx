import React, { useCallback, useEffect, useState } from 'react';
import { ChatCircleText, UsersThree } from '@phosphor-icons/react';
import { BulkMessage } from '../messages/BulkMessage';
import { Conversation } from '../messages/Conversation';
import { loadAllMessages, messageTime, type Message } from '../messages/messages';

const BULK = 'toplu';

interface Teacher { id: string; name: string; email: string; role: string; status: string }

/** Admin panel "Mesajlar": every approved teacher, newest conversation first, and a box to write. */
export function MessagesSection({ members, onUnread }: { members: Teacher[]; onUnread?: (count: number) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await loadAllMessages();
      setMessages(list); setError('');
      onUnread?.(list.filter(m => !m.from_admin && !m.read_at).length);
    } catch (e) { setError((e as Error).message); }
  }, [onUnread]);
  useEffect(() => { void load(); }, [load]);

  const last = new Map<string, Message>();
  const unreadBy = new Map<string, number>();
  for (const m of messages) {
    if (!last.has(m.teacher_id)) last.set(m.teacher_id, m);
    if (!m.from_admin && !m.read_at) unreadBy.set(m.teacher_id, (unreadBy.get(m.teacher_id) || 0) + 1);
  }
  const q = filter.trim().toLocaleLowerCase('tr');
  const approved = members.filter(m => m.status === 'approved' && m.role !== 'admin');
  const teachers = approved
    .filter(m => !q || `${m.name} ${m.email}`.toLocaleLowerCase('tr').includes(q))
    .sort((a, b) => (last.get(b.id)?.created_at || '').localeCompare(last.get(a.id)?.created_at || '') || a.name.localeCompare(b.name, 'tr'));
  const current = members.find(m => m.id === selected);

  return (
    <section className="rounded-xl border bg-white overflow-hidden">
      <div className="p-5 border-b">
        <h3 className="font-bold flex items-center gap-2"><ChatCircleText size={18} className="text-[#8B1E2D]" />Mesajlar</h3>
        <p className="text-xs text-[#787670] mt-1">Bir öğretmen seçip ona özel mesaj yazın. Öğretmen sol menüdeki Mesajlar’dan görür ve size yazabilir. Birden fazla öğretmene aynı mesaj için <strong>Toplu mesaj</strong>; sayfaların üstünde görünen duyuru için Ayarlar’daki duyuruyu kullanın.</p>
        {error && <p role="alert" className="text-sm text-[#78540E] mt-2">{error}</p>}
      </div>
      <div className="grid md:grid-cols-[260px_1fr]">
        <div className="border-b md:border-b-0 md:border-r">
          <div className="p-3 space-y-2">
            <button type="button" onClick={() => setSelected(BULK)} aria-current={selected === BULK ? 'true' : undefined}
              className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${selected === BULK ? 'bg-[#F7EEEE] border-[#8B1E2D] text-[#8B1E2D]' : 'hover:bg-[#FAF9F5]'}`}>
              <UsersThree size={16} />Toplu mesaj
            </button>
            <input aria-label="Öğretmen ara" placeholder="Öğretmen ara" value={filter} onChange={e => setFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-full" />
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {teachers.map(t => {
              const m = last.get(t.id);
              const count = unreadBy.get(t.id) || 0;
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => setSelected(t.id)} aria-current={selected === t.id ? 'true' : undefined}
                    className={`w-full text-left px-3 py-2.5 border-t text-sm ${selected === t.id ? 'bg-[#F7EEEE]' : 'hover:bg-[#FAF9F5]'}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate ${count ? 'font-bold' : 'font-semibold'}`}>{t.name || t.email}</span>
                      {count > 0 && <span className="text-xs font-bold px-1.5 rounded-full bg-[#8B1E2D] text-white tabular-nums">{count}</span>}
                    </span>
                    <span className="block text-xs text-[#787670] truncate">{m ? `${m.from_admin ? 'Siz: ' : ''}${m.body.replace(/\*\*/g, '')} · ${messageTime(m.created_at)}` : 'Mesaj yok'}</span>
                  </button>
                </li>
              );
            })}
            {!teachers.length && <li className="px-3 py-2.5 text-sm text-[#787670]">Öğretmen bulunamadı.</li>}
          </ul>
        </div>
        <div className="p-4">
          {selected === BULK
            ? <BulkMessage teachers={approved} onSent={() => void load()} />
            : current
            ? <Conversation key={current.id} teacherId={current.id} asAdmin otherName={current.name || current.email} onChange={() => void load()} />
            : <p className="text-sm text-[#787670]">Soldan bir öğretmen seçin.</p>}
        </div>
      </div>
    </section>
  );
}
