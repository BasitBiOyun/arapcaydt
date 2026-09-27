import React, { useEffect, useState } from 'react';
import { Buildings } from '@phosphor-icons/react';
import { CardHeader, Result, card, field, primary } from './MySettingsCards';
import { MIGRATION_PENDING, loadStudioSettings, parseAutoApprove, saveStudioSettings, type StudioSettings } from './studioSettings';

/** Admin-only studio settings: announcement, daily limits, auto-approval and sign-ups. */
export function StudioSettingsCard() {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [approveText, setApproveText] = useState('');
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
      const { updated_at: _ignored, ...rest } = settings;
      await saveStudioSettings({ ...rest, announcement: rest.announcement.trim(), auto_approve: parsed.entries });
      setApproveText(parsed.entries.join('\n'));
      setState({ notice: 'Stüdyo ayarları kaydedildi.' });
    } catch (err: any) { setState({ error: err.message }); }
  };

  const number = (key: 'shared_transcribe_per_teacher' | 'elevenlabs_align_per_teacher', max: number) => (
    <input type="number" min={0} max={max} className={`${field} !w-24`} value={settings?.[key] ?? 0}
      onChange={e => set({ [key]: Math.max(0, Math.min(max, Math.round(Number(e.target.value) || 0))) } as Partial<StudioSettings>)} />
  );

  return (
    <form onSubmit={save} className={card}>
      <CardHeader icon={Buildings} title="Stüdyo ayarları (yönetici)" hint="Tüm öğretmenleri etkiler" />
      {state.loading && <p className="text-xs text-[#787670]">Yükleniyor…</p>}
      {state.pending && <p className="p-3 rounded bg-[#FAF5E6] border border-[#E5D7B0] text-[11px] text-[#78540E]">{MIGRATION_PENDING} (supabase/migrations/20261001_settings.sql) O zamana kadar günlük sınırlar 25 / 20, kayıtlar açık.</p>}
      {settings && (
        <div className="space-y-4 text-xs text-[#33322E]">
          <fieldset className="space-y-2">
            <legend className="font-medium mb-1">Duyuru</legend>
            <textarea aria-label="Duyuru metni" className={`${field} min-h-16`} maxLength={500} placeholder="Örnek: Cuma akşamına kadar Eylül denemesinin videolarını tamamlayalım."
              value={settings.announcement} onChange={e => set({ announcement: e.target.value })} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.announcement_active} onChange={e => set({ announcement_active: e.target.checked })} /> Duyuruyu herkese göster</label>
          </fieldset>
          <fieldset className="space-y-2 border-t border-[#EFEFEA] pt-3">
            <legend className="font-medium mb-1">Öğretmen başına günlük sınırlar</legend>
            <label className="flex items-center gap-2 flex-wrap">{number('shared_transcribe_per_teacher', 100)} ortak Google anahtarından kelime zamanı (varsayılan 25)</label>
            <label className="flex items-center gap-2 flex-wrap">{number('elevenlabs_align_per_teacher', 200)} ElevenLabs yedek hizalama (varsayılan 20, 0 kapatır)</label>
            <p className="text-[11px] text-[#787670]">Yöneticiler sınırsızdır. Kendi Google anahtarını ekleyen öğretmen önce kendi kotasını kullanır.</p>
          </fieldset>
          <fieldset className="space-y-2 border-t border-[#EFEFEA] pt-3">
            <legend className="font-medium mb-1">Otomatik onay</legend>
            <textarea aria-label="Otomatik onay listesi" className={`${field} min-h-20 font-mono-code`} placeholder={'ogretmen@okul.k12.tr\n@meb.gov.tr'}
              value={approveText} onChange={e => { setApproveText(e.target.value); setState(st => ({ pending: st.pending })); }} />
            <p className="text-[11px] text-[#787670]">Her satıra bir e-posta ya da “@alan.adı”. Listede olanlar e-postasını doğrulayınca beklemeden onaylanır; diğerleri sizin onayınızı bekler.</p>
          </fieldset>
          <fieldset className="space-y-2 border-t border-[#EFEFEA] pt-3">
            <legend className="font-medium mb-1">Yeni kayıtlar</legend>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.signups_open} onChange={e => set({ signups_open: e.target.checked })} /> Yeni hesap oluşturulabilsin</label>
            {!settings.signups_open && <p className="text-[11px] text-[#78540E]">Kapalıyken giriş sayfasında “Hesap oluştur” görünmez ve veritabanı yeni kaydı reddeder. Mevcut üyeler etkilenmez.</p>}
          </fieldset>
          <button className={primary} disabled={state.busy}>Stüdyo ayarlarını kaydet</button>
        </div>
      )}
      <Result notice={state.notice} error={state.error} />
    </form>
  );
}
