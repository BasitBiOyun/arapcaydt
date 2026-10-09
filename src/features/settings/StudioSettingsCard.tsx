import React, { useEffect, useState } from 'react';
import { Buildings } from '@phosphor-icons/react';
import { CardHeader, Result, card, field, primary } from './MySettingsCards';
import {
  ANNOUNCEMENT_DURATIONS, ANNOUNCEMENT_MAX, MIGRATION_PENDING, announcementState, announcementUntil, loadStudioSettings, parseAutoApprove,
  saveStudioSettings, updateAnnouncement, type StudioSettings,
} from './studioSettings';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { FormattedText } from '../../components/common/FormattedText';
import { plainMessage } from '../../services/plainError';

const endsAt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Admin-only studio settings: announcement, daily limits, auto-approval and sign-ups. */
export function StudioSettingsCard() {
  const confirm = useConfirm();
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [approveText, setApproveText] = useState('');
  const [hours, setHours] = useState<number>(24);
  const [state, setState] = useState<{ notice?: string; error?: string; busy?: boolean; loading?: boolean; pending?: boolean }>({ loading: true });

  useEffect(() => {
    loadStudioSettings().then(({ settings: s, pending }) => {
      setSettings(s); setApproveText((s?.auto_approve || []).join('\n')); setState({ pending });
    }).catch(err => setState({ error: 'Stüdyo ayarları okunamadı: ' + err.message }));
  }, []);

  const set = (patch: Partial<StudioSettings>) => { setSettings(s => s && { ...s, ...patch }); setState(st => ({ pending: st.pending })); };
  const parsed = parseAutoApprove(approveText);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if (parsed.invalid.length) return setState({ error: `Okunamayan satırlar: ${parsed.invalid.join(', ')}. Her satıra bir e-posta ya da @alan adı yazın.` });
    setState({ busy: true });
    try {
      // The announcement has its own buttons; this saves only the other settings.
      const { updated_at: _u, announcement: _a, announcement_active: _on, announcement_until: _until, ...rest } = settings;
      await saveStudioSettings({ ...rest, auto_approve: parsed.entries });
      setApproveText(parsed.entries.join('\n'));
      setState({ notice: 'Stüdyo ayarları kaydedildi.' });
    } catch (err) { setState({ error: plainMessage(err, 'İşlem tamamlanamadı.') }); }
  };

  const announce = async (patch: Pick<StudioSettings, 'announcement' | 'announcement_active' | 'announcement_until'>, done: string) => {
    setState({ busy: true });
    try {
      const result = await updateAnnouncement(patch);
      setSettings(s => s && { ...s, ...result.patch });
      setState({ notice: result.expiryPending ? `${done} Süre için veritabanı güncellemesi bekleniyor (supabase/migrations/20261004_announcement_until.sql); o zamana kadar siz kaldırana dek görünür.` : done });
    } catch (err) { setState({ error: plainMessage(err, 'İşlem tamamlanamadı.') }); }
  };
  const live = settings ? announcementState(settings) : 'off';

  const number = (key: 'shared_transcribe_per_teacher' | 'elevenlabs_align_per_teacher', max: number) => (
    <input type="number" min={0} max={max} className={`${field} !w-24`} value={settings?.[key] ?? 0}
      onChange={e => set({ [key]: Math.max(0, Math.min(max, Math.round(Number(e.target.value) || 0))) } as Partial<StudioSettings>)} />
  );

  return (
    <form onSubmit={save} className={card}>
      <CardHeader icon={Buildings} title="Stüdyo ayarları (yönetici)" hint="Tüm öğretmenleri etkiler" />
      {state.loading && <p className="text-xs text-[#787670]">Yükleniyor…</p>}
      {state.pending && <p className="p-3 rounded bg-[#FAF5E6] border border-[#E5D7B0] text-xs text-[#78540E]">{MIGRATION_PENDING} (supabase/migrations/20261001_settings.sql) O zamana kadar günlük sınırlar 25 / 20, kayıtlar açık.</p>}
      {settings && (
        <div className="space-y-4 text-xs text-[#33322E]">
          <fieldset className="space-y-2">
            <legend className="font-medium mb-1">Duyuru</legend>
            <textarea aria-label="Duyuru metni" className={`${field} min-h-24`} maxLength={ANNOUNCEMENT_MAX} placeholder="Örnek: Cuma akşamına kadar Eylül denemesinin videolarını tamamlayalım."
              value={settings.announcement} onChange={e => set({ announcement: e.target.value })} />
            <p className="text-xs text-[#787670]">**kalın** yazdığınız yer kalın, "- " ile başlayan satırlar madde olarak görünür. {settings.announcement.length}/{ANNOUNCEMENT_MAX}</p>
            {settings.announcement.trim() && (
              <div className="rounded border border-[#E5D7B0] bg-[#FAF5E6] px-3 py-2 text-sm text-[#5C420B]" aria-label="Duyuru önizlemesi">
                <p className="text-xs font-semibold text-[#78540E] mb-1">Öğretmenler böyle görecek:</p>
                <FormattedText text={settings.announcement} />
              </div>
            )}
            <p className="text-xs" role="status">
              {live === 'live' ? <span className="text-[#1E562A] font-semibold">● Yayında{settings.announcement_until ? ` · ${endsAt(settings.announcement_until)} tarihine kadar` : ' · siz kaldırana kadar'}</span>
                : live === 'expired' ? <span className="text-[#78540E] font-semibold">Süresi doldu; öğretmenler artık görmüyor.</span>
                : <span className="text-[#787670]">Yayında değil.</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5">Süre
                <select className={`${field} !w-auto !py-1`} value={hours} onChange={e => setHours(Number(e.target.value))}>
                  {ANNOUNCEMENT_DURATIONS.map(d => <option key={d.hours} value={d.hours}>{d.label}</option>)}
                </select>
              </label>
              <button type="button" className={primary} disabled={state.busy || !settings.announcement.trim()}
                onClick={() => void announce({ announcement: settings.announcement.trim(), announcement_active: true, announcement_until: announcementUntil(hours) },
                  live === 'live' ? 'Duyuru güncellendi ve yeniden yayınlandı.' : 'Duyuru yayınlandı.')}>
                {live === 'live' ? 'Güncelle ve yayınla' : 'Yayınla'}
              </button>
              {live !== 'off' && <button type="button" className="px-3 py-1.5 rounded border border-[#D5D4CC] bg-white hover:bg-[#F2F1EB] font-semibold" disabled={state.busy}
                onClick={() => void announce({ announcement: settings.announcement, announcement_active: false, announcement_until: settings.announcement_until ?? null }, 'Duyuru yayından kaldırıldı.')}>Yayından kaldır</button>}
              {settings.announcement.trim() && <button type="button" className="px-3 py-1.5 rounded text-red-600 hover:bg-red-50 font-semibold" disabled={state.busy}
                onClick={async () => { if (await confirm({ title: 'Duyuru silinsin mi?', confirmLabel: 'Sil', danger: true })) void announce({ announcement: '', announcement_active: false, announcement_until: null }, 'Duyuru silindi.'); }}>Sil</button>}
            </div>
            <p className="text-xs text-[#787670]">Yayınlanan duyuru tüm sayfaların üstünde görünür; öğretmen kapatırsa o duyuruyu bir daha görmez. Yeniden yayınlarsanız herkese yeniden görünür.</p>
          </fieldset>
          <fieldset className="space-y-2 border-t border-[#EFEFEA] pt-3">
            <legend className="font-medium mb-1">Öğretmen başına günlük sınırlar</legend>
            <label className="flex items-center gap-2 flex-wrap">{number('shared_transcribe_per_teacher', 100)} ortak Google anahtarından kelime zamanı (varsayılan 25)</label>
            <label className="flex items-center gap-2 flex-wrap">{number('elevenlabs_align_per_teacher', 200)} ElevenLabs yedek hizalama (varsayılan 20, 0 kapatır)</label>
            <p className="text-xs text-[#787670]">Yöneticiler sınırsızdır. Kendi Google anahtarını ekleyen öğretmen önce kendi kotasını kullanır.</p>
          </fieldset>
          <fieldset className="space-y-2 border-t border-[#EFEFEA] pt-3">
            <legend className="font-medium mb-1">Otomatik onay</legend>
            <textarea aria-label="Otomatik onay listesi" className={`${field} min-h-20 font-mono-code`} placeholder={'ogretmen@okul.k12.tr\n@meb.gov.tr'}
              value={approveText} onChange={e => { setApproveText(e.target.value); setState(st => ({ pending: st.pending })); }} />
            <p className="text-xs text-[#787670]">Her satıra bir e-posta ya da “@alan.adı”. Listede olanlar e-postasını doğrulayınca beklemeden onaylanır; diğerleri sizin onayınızı bekler.</p>
          </fieldset>
          <fieldset className="space-y-2 border-t border-[#EFEFEA] pt-3">
            <legend className="font-medium mb-1">Yeni kayıtlar</legend>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.signups_open} onChange={e => set({ signups_open: e.target.checked })} /> Yeni hesap oluşturulabilsin</label>
            {!settings.signups_open && <p className="text-xs text-[#78540E]">Kapalıyken giriş sayfasında “Hesap oluştur” görünmez ve veritabanı yeni kaydı reddeder. Mevcut üyeler etkilenmez.</p>}
          </fieldset>
          <button className={primary} disabled={state.busy}>Stüdyo ayarlarını kaydet</button>
        </div>
      )}
      <Result notice={state.notice} error={state.error} />
    </form>
  );
}
