import { useEffect, useState } from 'react';
import { database } from '../../services/supabase';
import { SectionTitle, activityStates, ago, card } from './adminShared';

interface ActivityItem { id: string; owner_id: string; kind: string; state: string; created_at: string }
const PAGE = 50;

/** What one activity row was, in plain words (every kind the activity table holds). */
export function activityKind(a: Pick<ActivityItem, 'kind' | 'state'>): string {
  switch (a.kind) {
    case 'voice': return a.state.startsWith('align') ? 'Ses hizalama' : 'ElevenLabs yedek sesi';
    case 'gemini_tts': return 'Gemini seslendirme';
    case 'gemini_transcribe': return 'Kelime zamanları';
    case 'elevenlabs_align': return 'ElevenLabs hizalama';
    case 'vision_ocr': return 'Görsel okuma (Vision)';
    case 'client_error': return 'Tarayıcı hatası';
    case 'video_export': return 'Video dışa aktarımı';
    case 'member_status': return a.state.startsWith('role_') ? 'Rol değişikliği' : 'Üyelik';
    default: return a.kind;
  }
}

/** Everything recorded (voices, timings, readings, exports, membership), newest first, a page at a time. */
export function ActivityList({ who, first }: { who: (id: string) => string; first: ActivityItem[] }) {
  const [items, setItems] = useState(first);
  const [more, setMore] = useState(first.length >= 100);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setItems(first); setMore(first.length >= 100); }, [first]);
  const loadMore = async () => {
    setLoading(true);
    const { data } = await database().from('activity').select('id,owner_id,kind,state,created_at')
      .order('created_at', { ascending: false }).range(items.length, items.length + PAGE - 1);
    const next = (data || []) as ActivityItem[];
    setItems(list => [...list, ...next.filter(n => !list.some(o => o.id === n.id))]);
    setMore(next.length === PAGE);
    setLoading(false);
  };
  return (
    <section className={card}>
      <SectionTitle title="Son işlemler" />
      <ul className="divide-y divide-[#EFEFEA] text-sm">
        {items.map(a => (
          <li key={a.id} className="py-2 flex justify-between gap-3">
            <span>
              <span className="font-semibold">{who(a.owner_id)}</span> ·{' '}
              {activityKind(a)}{' '}
              · <span className="text-[#55544F]">{activityStates[a.state] || a.state}</span>
            </span>
            <span className="text-xs text-[#A8A69E] whitespace-nowrap">{ago(a.created_at)}</span>
          </li>
        ))}
      </ul>
      {more && (
        <button type="button" disabled={loading} className="mt-3 text-sm font-semibold text-[#8B1E2D] hover:underline" onClick={() => void loadMore()}>
          {loading ? 'Yükleniyor…' : 'Daha eski işlemler'}
        </button>
      )}
    </section>
  );
}
