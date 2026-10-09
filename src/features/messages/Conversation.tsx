import React, { useEffect, useRef, useState } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';
import { loadConversation, markRead, messageTime, QUICK_MESSAGES, sendMessage, type Message } from './messages';
import { FormattedText } from '../../components/common/FormattedText';
import { plainMessage } from '../../services/plainError';

/**
 * One teacher's conversation with the studio admins, oldest first, with a box to write.
 * The admin sees it from the admin panel, the teacher from Mesajlar in the side menu.
 */
export function Conversation({ teacherId, asAdmin, otherName, onChange }: {
  teacherId: string; asAdmin: boolean; otherName: string; onChange?: () => void;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setMessages(null); setError('');
    loadConversation(teacherId)
      .then(async list => {
        if (!live) return;
        setMessages(list);
        if (list.some(m => m.from_admin !== asAdmin && !m.read_at)) { await markRead(teacherId); onChange?.(); }
      })
      .catch(e => live && (setMessages([]), setError(plainMessage(e, 'Bilgi alınamadı.'))));
    return () => { live = false; };
    // onChange only reports back; a new function each render must not reload the conversation.
  }, [teacherId, asAdmin]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError('');
    try {
      const sent = await sendMessage(teacherId, text, asAdmin);
      setMessages(list => [...(list || []), sent]);
      setText('');
      onChange?.();
    } catch (err) {
      setError(plainMessage(err, 'İşlem tamamlanamadı.'));
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="max-h-[45vh] overflow-y-auto space-y-2 rounded-lg bg-[#FAF9F5] border p-3">
        {messages === null && <p className="text-sm text-[#787670]">Yükleniyor…</p>}
        {messages?.length === 0 && !error && (
          <p className="text-sm text-[#787670]">{asAdmin ? `${otherName} ile henüz mesaj yok.` : 'Henüz mesaj yok. Yöneticiye buradan yazabilirsiniz.'}</p>
        )}
        {messages?.map(m => {
          const mine = m.from_admin === asAdmin;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-[#8B1E2D] text-white' : 'bg-white border text-[#33322E]'}`}>
                <p className={`text-xs mb-0.5 ${mine ? 'text-white/75' : 'text-[#787670]'}`}>{mine ? 'Siz' : otherName} · {messageTime(m.created_at)}</p>
                <FormattedText text={m.body} />
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {error && <p role="alert" className="text-sm text-[#8B1E2D]">{error}</p>}
      <form onSubmit={send} className="space-y-2">
        {asAdmin && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MESSAGES.map(q => (
              <button key={q} type="button" onClick={() => setText(q)} className="px-2 py-1 rounded-full border bg-white text-xs hover:bg-[#F7EEEE]">{q}</button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea aria-label="Mesaj" value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(e); }}
            placeholder={asAdmin ? `${otherName} için mesaj yazın` : 'Yöneticiye mesaj yazın'}
            className="flex-1 rounded-lg border border-[#D5D4CC] p-2 text-sm outline-none focus:border-[#8B1E2D]" />
          <button className="studio-primary inline-flex items-center gap-1.5" disabled={busy || !text.trim()}>
            <PaperPlaneRight size={16} />{busy ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
      </form>
    </div>
  );
}
