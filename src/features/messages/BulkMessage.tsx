import React, { useState } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';
import { FormattedText } from '../../components/common/FormattedText';
import { sendBulkMessage } from './messages';
import { plainMessage } from '../../services/plainError';

/** Admin "Toplu mesaj": one message, delivered into each chosen teacher's own Mesajlar conversation. */
export function BulkMessage({ teachers, onSent }: { teachers: { id: string; name: string; email: string }[]; onSent: () => void }) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(teachers.map(t => t.id)));
  const [text, setText] = useState('');
  const [state, setState] = useState<{ busy?: boolean; error?: string; notice?: string }>({});
  const toggle = (id: string) => setChosen(s => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const ids = teachers.filter(t => chosen.has(t.id)).map(t => t.id);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !ids.length || state.busy) return;
    setState({ busy: true });
    try {
      const count = await sendBulkMessage(ids, text);
      setText(''); setState({ notice: `Mesaj ${count} öğretmene gönderildi. Her biri kendi Mesajlar’ında görür ve size oradan cevap verebilir.` });
      onSent();
    } catch (err) { setState({ error: plainMessage(err, 'Mesaj gönderilemedi.') }); }
  };

  return (
    <form onSubmit={send} className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Toplu mesaj</p>
        <p className="text-xs text-[#787670]">Seçtiğiniz her öğretmene ayrı ayrı gider; cevaplar o öğretmenle olan yazışmanızda görünür.</p>
      </div>
      <fieldset className="rounded-lg border p-2">
        <legend className="px-1 text-xs text-[#787670]">Alıcılar · {ids.length}/{teachers.length}</legend>
        <div className="flex gap-3 text-xs mb-1.5">
          <button type="button" className="text-[#8B1E2D] font-semibold hover:underline" onClick={() => setChosen(new Set(teachers.map(t => t.id)))}>Tümünü seç</button>
          <button type="button" className="text-[#8B1E2D] font-semibold hover:underline" onClick={() => setChosen(new Set())}>Hiçbiri</button>
        </div>
        <div className="max-h-40 overflow-y-auto grid sm:grid-cols-2 gap-x-3 gap-y-1">
          {teachers.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-sm min-w-0">
              <input type="checkbox" checked={chosen.has(t.id)} onChange={() => toggle(t.id)} />
              <span className="truncate">{t.name || t.email}</span>
            </label>
          ))}
          {!teachers.length && <p className="text-sm text-[#787670]">Onaylı öğretmen yok.</p>}
        </div>
      </fieldset>
      <textarea aria-label="Toplu mesaj" value={text} onChange={e => { setText(e.target.value); setState({}); }} maxLength={2000} rows={6}
        placeholder="Tüm hocalara gidecek mesajı yazın"
        className="w-full rounded-lg border border-[#D5D4CC] p-2 text-sm outline-none focus:border-[#8B1E2D]" />
      <p className="text-xs text-[#787670]">**kalın** yazdığınız yer kalın, "- " ile başlayan satırlar madde olarak görünür. {text.length}/2000</p>
      {text.trim() && (
        <div className="rounded-lg bg-white border px-3 py-2 text-sm text-[#33322E]" aria-label="Mesaj önizlemesi">
          <p className="text-xs font-semibold text-[#787670] mb-1">Hocalar böyle görecek:</p>
          <FormattedText text={text} />
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-[#8B1E2D]">{state.error}</p>}
      {state.notice && <p role="status" className="text-sm text-[#1E562A]">{state.notice}</p>}
      <button className="studio-primary inline-flex items-center gap-1.5" disabled={state.busy || !text.trim() || !ids.length}>
        <PaperPlaneRight size={16} />{state.busy ? 'Gönderiliyor…' : `${ids.length} öğretmene gönder`}
      </button>
    </form>
  );
}
