import { Counter, RequestService, STUDIO_TRANSCRIBE_DAILY, SectionTitle, Stat, card, counts, requestLabels, sorted, timingLabels } from './adminShared';
import type { AdminCtx } from './adminShared';
import { quotaResetClock } from '../../services/narration/geminiKeyService';
import { StorageSection } from './StorageSection';

export function UsageTab({ ctx }: { ctx: AdminCtx }) {
  const { who, members, analytics, requests, activeKeys, voice } = ctx;
  return (
      <div className="space-y-6">
        {requests?.migrationPending ? (
          <p className="text-sm bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-4">
            İstek sayacı için veritabanı güncellemesi bekleniyor: <code>supabase/migrations/20260928_teacher_keys.sql</code> dosyasını Supabase SQL Editor'da bir kez çalıştırın. O zamana kadar istekler sayılmaz, günlük haklar uygulanmaz ve öğretmenler anahtar kaydedemez.
          </p>
        ) : requests && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <Stat label="Kendi anahtarını bağlayan" value={activeKeys} hint={`${members.filter((m) => m.status === 'approved').length} onaylı üyeden`} />
              <Stat label="Ortak anahtar · bugünkü zamanlama" value={<>{requests.studio?.transcribeUsed ?? 0}<span className="text-base text-[#787670] font-semibold"> / ~{STUDIO_TRANSCRIBE_DAILY}</span></>}
                tone={requests.studio?.transcribeExhausted ? 'text-red-700' : undefined} hint={requests.studio?.transcribeExhausted ? `Bugünkü kota doldu · saat ${quotaResetClock()} itibarıyla yenilenir` : `Her gün saat ${quotaResetClock()} itibarıyla yenilenir`} />
              <Stat label="Ortak anahtar · kotası dolan ses modeli" value={requests.studio?.ttsExhausted.length ?? 0}
                hint={requests.studio?.ttsExhausted.length ? requests.studio.ttsExhausted.join(', ') : 'Hepsi kullanılabilir'} />
            </div>

            <section className={card}>
              <SectionTitle title="İstek sayaçları" note={<>Her istek ayrı sayılır: her Gemini model denemesi, yeniden seslendirmeler ve başarısız istekler dahil. “Bugün”: Google haklarının yenilendiği saat {quotaResetClock()} (Türkiye saati) itibarıyla sayılır.</>} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#FAF9F5] text-xs text-[#666560]">
                    <tr>{['Servis', 'Bugün', 'Son 30 gün', 'Toplam'].map((t) => <th key={t} className="px-3 py-2 font-semibold whitespace-nowrap">{t}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEFEA]">
                    {(Object.keys(requestLabels) as RequestService[]).map((k) => (
                      <tr key={k}>
                        <td className="px-3 py-2">{requestLabels[k]}</td>
                        <td className="px-3 py-2">{counts(requests.totals.today[k])}</td>
                        <td className="px-3 py-2">{counts(requests.totals.last30Days[k])}</td>
                        <td className="px-3 py-2">{counts(requests.totals.all[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {Object.keys(requests.geminiModels).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-[#666560] mb-2">Gemini seslendirme · model başına</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {(Object.entries(requests.geminiModels) as Array<[string, { today: Counter; last30Days: Counter; sharedToday?: number; lastQuota?: string }]>)
                      .sort((a, b) => b[1].last30Days.succeeded + b[1].last30Days.failed - (a[1].last30Days.succeeded + a[1].last30Days.failed))
                      .map(([model, c]) => (
                        <div key={model} className="border rounded-lg px-3 py-2 text-sm">
                          <p className="font-mono-code text-xs break-all">{model}</p>
                          <p>Bugün {counts(c.today)}</p>
                          <p className="text-xs text-[#787670]">Son 30 gün: {c.last30Days.succeeded + c.last30Days.failed}</p>
                          {c.sharedToday !== undefined && <p className="text-xs text-[#55544F]">Ortak anahtarla bugün: {c.sharedToday}</p>}
                          {c.lastQuota && <p className="text-xs text-[#8B1E2D]">Son kota hatası · {c.lastQuota}</p>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </section>

            {requests.membersWeek && Object.keys(requests.membersWeek).length > 0 && (
              <section className={card}>
                <SectionTitle title="Öğretmen başına istekler (son 7 gün)" note="Başarılı ve başarısız istekler birlikte: yalnız hatalara bakınca sorun olduğundan büyük görünür. Her model denemesi ayrı bir istektir." />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#FAF9F5] text-xs text-[#666560]">
                      <tr>{['Öğretmen', 'Seslendirme', 'Zamanlama', 'Başarı oranı'].map((t) => <th key={t} className="px-3 py-2 font-semibold whitespace-nowrap">{t}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEFEA]">
                      {Object.entries(requests.membersWeek)
                        .sort((a, b) => b[1].voice.failed + b[1].timing.failed - (a[1].voice.failed + a[1].timing.failed))
                        .map(([owner, w]) => {
                          const all = w.voice.succeeded + w.voice.failed + w.timing.succeeded + w.timing.failed;
                          const rate = all ? Math.round(((w.voice.succeeded + w.timing.succeeded) / all) * 100) : 0;
                          const cell = (c: Counter) => <><strong className="tabular-nums text-[#15803D]">{c.succeeded}</strong> başarılı{c.failed > 0 && <span className="text-red-700"> · {c.failed} başarısız</span>}</>;
                          return (
                            <tr key={owner}>
                              <td className="px-3 py-2 whitespace-nowrap">{who(owner)}</td>
                              <td className="px-3 py-2">{cell(w.voice)}</td>
                              <td className="px-3 py-2">{cell(w.timing)}</td>
                              <td className={`px-3 py-2 font-semibold ${rate < 50 ? 'text-red-700' : rate < 80 ? 'text-[#B45309]' : 'text-[#15803D]'}`}>%{rate}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className={card}>
              <SectionTitle title="Son başarısız istekler" note="Son 7 gün, en yeni üstte; servisin verdiği neden ile. Dakikalık sınır ve geçici hatalar kendiliğinden tekrar denenir." />
              {!requests.failures?.length ? <p className="text-sm text-[#787670]">Son 7 günde başarısız istek yok.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF9F5] text-[#666560]">
                      <tr>{['Zaman', 'Öğretmen', 'Servis', 'Anahtar', 'Model', 'Kod', 'Neden'].map((t) => <th key={t} className="px-3 py-2 font-semibold whitespace-nowrap">{t}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEFEA]">
                      {requests.failures.map((f, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 whitespace-nowrap">{new Date(f.at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{who(f.ownerId)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{requestLabels[f.kind]}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{f.keySource === 'teacher' ? 'kendi' : f.keySource === 'system' ? 'ortak' : '—'}</td>
                          <td className="px-3 py-2 font-mono-code whitespace-nowrap">{f.model}</td>
                          <td className="px-3 py-2">{f.status === '0' ? 'bağlantı' : f.status}</td>
                          <td className="px-3 py-2 text-[#55544F]">{f.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={card}>
              <SectionTitle title="Sunucu hataları" note="Son 7 gün: sunucunun hata ile yanıt verdiği istekler (öğretmen bildirmese de kaydedilir). Her sabah kontrol edilir." />
              {analytics?.serverErrors == null ? (
                <p className="text-sm text-[#78540E]">Kayıt için veritabanı güncellemesi bekleniyor: <code>supabase/migrations/20261007_reports_server_errors.sql</code>.</p>
              ) : !analytics.serverErrors.length ? <p className="text-sm text-[#787670]">Son 7 günde sunucu hatası yok.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF9F5] text-[#666560]">
                      <tr>{['Zaman', 'Öğretmen', 'İstek', 'Kod', 'Mesaj'].map((t) => <th key={t} className="px-3 py-2 font-semibold whitespace-nowrap">{t}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEFEA]">
                      {analytics.serverErrors.map((e, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 whitespace-nowrap">{new Date(e.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{e.owner_id ? who(e.owner_id) : '—'}</td>
                          <td className="px-3 py-2 font-mono-code whitespace-nowrap">{e.route}</td>
                          <td className="px-3 py-2">{e.status}</td>
                          <td className="px-3 py-2 text-[#55544F]">{e.message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {analytics && (
          <section className={card}>
            <SectionTitle title="Ses ve zamanlama" note="Her projenin şu anki ses kaydına göre. Ana ses Gemini, yedek ElevenLabs." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3 space-y-1.5 text-sm">
                <p className="text-xs font-semibold text-[#666560]">Ses motoru</p>
                <div className="flex justify-between gap-3"><span>Gemini</span><strong className="tabular-nums">{analytics.voice.gemini}</strong></div>
                <div className="flex justify-between gap-3"><span>ElevenLabs yedeği</span><strong className="tabular-nums">{analytics.voice.elevenlabs}</strong></div>
                <div className="flex justify-between gap-3 text-xs text-[#787670]"><span>Gemini hatası sonrası</span><span>{analytics.voice.geminiFallbacks}</span></div>
                <div className="flex justify-between gap-3"><span>Yüklenen MP3</span><strong className="tabular-nums">{analytics.voice.uploaded}</strong></div>
              </div>
              <div className="border rounded-lg p-3 space-y-1.5 text-sm">
                <p className="text-xs font-semibold text-[#666560]">Gemini modelleri</p>
                {sorted(analytics.voice.models).map(([model, n]) => (
                  <div key={model} className="flex justify-between gap-3"><span className="font-mono-code text-xs break-all">{model}</span><strong className="tabular-nums">{n}</strong></div>
                ))}
                {!Object.keys(analytics.voice.models).length && <p className="text-xs text-[#A8A69E]">Henüz Gemini sesi yok</p>}
              </div>
              <div className="border rounded-lg p-3 space-y-1.5 text-sm">
                <p className="text-xs font-semibold text-[#666560]">Kelime zamanı kaynağı</p>
                {sorted(analytics.voice.timing).map(([source, n]) => (
                  <div key={source} className="flex justify-between gap-3"><span>{timingLabels[source] || source}</span><strong className="tabular-nums">{n}</strong></div>
                ))}
                {!Object.keys(analytics.voice.timing).length && <p className="text-xs text-[#A8A69E]">Henüz ses yok</p>}
              </div>
              <div className="border rounded-lg p-3 space-y-1.5 text-sm">
                <p className="text-xs font-semibold text-[#666560]">ElevenLabs yedek kotası</p>
                <strong className="text-2xl tabular-nums">{voice?.remainingCharacters != null ? voice.remainingCharacters.toLocaleString('tr') : '—'}</strong>
                <p className="text-xs text-[#787670]">
                  {voice?.remainingCharacters != null ? `karakter kaldı${voice.tier ? ` · ${voice.tier}` : ''}` : voice?.configured ? 'Kota okunamadı' : 'ElevenLabs yapılandırılmamış'}
                </p>
                <p className="text-xs text-[#787670]">Gemini: {voice?.gemini?.configured ? 'yapılandırıldı' : 'yapılandırılmamış'}</p>
              </div>
            </div>
          </section>
        )}

        <StorageSection />
      </div>
  );
}
