import { Chip, ago, sorted, statuses } from './adminShared';
import type { AdminCtx } from './adminShared';
import { getCategoryLabel } from '../../config/categories';
import { quotaResetClock } from '../../services/narration/geminiKeyService';

export function TeachersTab({ ctx }: { ctx: AdminCtx }) {
  const { busy, members, change, promote, analytics, requests, limits, filter, setFilter, showProjects } = ctx;
  return (
      <section className="rounded-xl border bg-white overflow-hidden">
        <div className="p-5 flex flex-wrap items-center justify-between gap-3 border-b">
          <div>
            <h3 className="font-bold">Öğretmenler</h3>
            <p className="text-xs text-[#787670] mt-1">
              “Bugün”: Google haklarının yenilendiği saat {quotaResetClock()} (Türkiye saati) itibarıyla sayılır. Ses ve zamanlama ayrı sayılır; “ortak” ortak anahtardan alınanı gösterir. Ortak zamanlama öğretmen başına günde {limits.shared}, ElevenLabs hizalama {limits.eleven}; yöneticiler sınırsız.
            </p>
          </div>
          <input aria-label="Öğretmen ara" placeholder="Ad veya e-posta ara" value={filter} onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-64 max-w-full" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FAF9F5] text-xs text-[#666560]">
              <tr>
                {['Öğretmen', 'Sorular', 'Kalite', 'Anahtar', 'Bugün', 'Son çalışma', 'Erişim'].map((t) => (
                  <th key={t} className="px-3 py-2.5 font-semibold whitespace-nowrap">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEFEA]">
              {members
                .filter((m) => (m.name + ' ' + m.email).toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr')))
                .map((m) => {
                  const stats = analytics?.members[m.id];
                  const key = analytics?.teacherKeys?.[m.id];
                  const today = requests?.membersToday?.[m.id];
                  const admin = m.role === 'admin';
                  const types = sorted(stats?.categories);
                  const state = m.status === 'approved' ? { icon: '✓', tone: 'text-[#15803D]' } : m.status === 'pending' ? { icon: '⏳', tone: 'text-[#B45309]' } : { icon: '⛔', tone: 'text-red-700' };
                  const todayDetail = today ? [
                    `Ses: kendi anahtar ${today.ownTts ?? 0}${today.sharedTts ? ` · ortak ${today.sharedTts}` : ''}${today.ownTtsExhausted ? ` · ${today.ownTtsExhausted} model doldu` : ''}`,
                    `Zamanlama: kendi ${today.ownTranscribe ?? 0} · ortak ${today.sharedTranscribe ?? 0}${admin ? '' : `/${limits.shared}`} · ElevenLabs ${today.elevenlabsAlign ?? 0}${admin ? '' : `/${limits.eleven}`}${today.ownTranscribeExhausted ? ' · kendi kotası doldu' : ''}`,
                  ].join('\n') : undefined;
                  return (
                    <tr key={m.id} className="align-middle">
                      <td className="px-3 py-2 max-w-[260px]">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className={state.tone} title={statuses[m.status] || m.status} aria-label={statuses[m.status] || m.status}>{state.icon}</span>
                          <span className="truncate">{m.name}</span>{admin && <Chip tone="brand">Yönetici</Chip>}
                        </div>
                        <div className="text-xs text-[#787670] truncate">{m.email}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" title={types.length ? types.map(([id, n]) => `${getCategoryLabel(id)}: ${n}`).join('\n') : undefined}>
                        <span className="font-semibold tabular-nums">{m.questions}</span>
                        <span className="text-xs text-[#787670]"> · {stats?.videoReady || 0} video</span>
                        {m.questions > 0 && (
                          <button type="button" className="block text-xs font-semibold text-[#8B1E2D] hover:underline" onClick={() => showProjects(m.id)}>Sorularını gör</button>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs" title="tamamlandı ✓ · bekleyenler: yayına hazır · kontrol önerilir · düzeltme gerekli">
                        <span className="text-[#166534] font-bold">✓ {stats?.completed || 0}</span>
                        <span className="text-[#C9C7BE]"> · </span>
                        <span className="text-[#15803D] font-semibold">{stats?.quality.ready || 0}</span>
                        <span className="text-[#C9C7BE]"> · </span>
                        <span className="text-[#B45309] font-semibold">{stats?.quality.check || 0}</span>
                        <span className="text-[#C9C7BE]"> · </span>
                        <span className="text-red-700 font-semibold">{stats?.quality.blocked || 0}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold" title={key ? `••••${key.last4}` : undefined}>
                        {key ? (key.status === 'active' ? <span className="text-[#15803D]">Bağlı</span> : <span className="text-red-700">Geçersiz</span>) : <span className="text-[#8C8A82]">Yok</span>}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-[#55544F]" title={todayDetail}>
                        {requests?.migrationPending ? '—' : (
                          <>
                            <div>Ses {(today?.ownTts ?? 0) + (today?.sharedTts ?? 0)}{today?.ownTtsExhausted ? <span className="text-red-700"> · {today.ownTtsExhausted} model doldu</span> : ''}</div>
                            <div className="text-[#787670]">
                              Zaman. {today?.ownTranscribe ?? 0} · ortak {today?.sharedTranscribe ?? 0}{admin ? '' : `/${limits.shared}`}
                              {today?.ownTranscribeExhausted && <span className="text-red-700"> · kota doldu</span>}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-[#55544F]" title={stats?.lastProjectAt ? new Date(stats.lastProjectAt).toLocaleString('tr') : undefined}>
                        {ago(stats?.lastProjectAt)}
                      </td>
                      <td className="px-3 py-2">
                        {!admin ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <select aria-label={`${m.email} erişimi`} disabled={busy} value={m.status}
                              onChange={(e) => void change(m, e.target.value)} className="border rounded-lg px-2 py-1 text-sm bg-white">
                              <option value="pending">Onay bekliyor</option>
                              <option value="approved">Onaylı</option>
                              <option value="blocked">Durduruldu</option>
                            </select>
                            <button type="button" disabled={busy} onClick={() => void promote(m)} className="text-xs font-semibold text-[#8B1E2D] hover:underline">
                              Yönetici yap
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#787670]">Tam yetki</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#787670] px-5 py-4 border-t">
          Adın yanındaki işaret: ✓ onaylı · ⏳ onay bekliyor · ⛔ durduruldu. Soru ve kalite sayıları kayıtlı projelerin şu anki durumundan hesaplanır. “Bugün” sütunu Google kotasından düşen istekleri gösterir (429 ile reddedilenler hariç); ayrıntı için üzerine gelin.
        </p>
      </section>
  );
}
