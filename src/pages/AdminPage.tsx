import { readProjectForOverview } from '../features/projects/cloudProjectRepository';
import { ProjectViewer } from '../features/projects/ProjectViewer';
import { StorageSection } from '../features/admin/StorageSection';
import type { QuestionProject } from '../types';
import { projectRepository } from '../features/projects/projectRepository';
import { useProjects } from '../features/projects/ProjectContext';
import React, { useCallback, useEffect, useState } from 'react';
import { authHeaders, database } from '../services/supabase';
import { getCategoryLabel } from '../config/categories';
import { elevenlabsService } from '../services/elevenlabs/elevenlabsService';
import type { ElevenLabsStatus } from '../types';
interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  questions: number;
  mock_questions: number;
  mock_exams: number;
  voice_attempts: number;
  voices: number;
  characters: number;
  exports: number;
}
interface Overview {
  members: Member[];
  projects: Array<{
    id: string;
    owner_id: string;
    title: string;
    category: string;
    status: string;
    updated_at: string;
  }>;
  activity: Array<{
    id: string;
    owner_id: string;
    kind: string;
    state: string;
    characters: number;
    created_at: string;
  }>;
}
interface MemberAnalytics {
  categories: Record<string, number>;
  draft: number;
  audioGenerated: number;
  audioApproved: number;
  videoReady: number;
  withAudio: number;
  uploadedAudio: number;
  gemini: number;
  elevenlabs: number;
  geminiFallbacks: number;
  quality: { ready: number; check: number; blocked: number };
  lastProjectAt: string | null;
}
interface Analytics {
  totalProjects: number;
  categoryTotals: Record<string, number>;
  members: Record<string, MemberAnalytics>;
  voice: {
    gemini: number;
    elevenlabs: number;
    geminiFallbacks: number;
    uploaded: number;
    none: number;
    models: Record<string, number>;
    timing: Record<string, number>;
  };
  funnel: { total: number; withAudio: number; withMarkers: number; ready: number };
  quality: { ready: number; check: number; blocked: number };
  issues: Array<{ projectId: string; ownerId: string; title: string; updatedAt: string; detail: string }>;
  teacherKeys?: Record<string, { last4: string; status: string; updatedAt: string }>;
  requests?: {
    migrationPending: boolean;
    quotaDay: string;
    totals: Record<'today' | 'last30Days' | 'all', Record<RequestService, Counter>>;
    geminiModels: Record<string, { today: Counter; last30Days: Counter }>;
    members: Record<string, Record<RequestService, number>>;
    membersToday?: Record<string, MemberToday>;
    studio?: { transcribeUsed: number; transcribeExhausted: boolean; ttsExhausted: string[] };
    limits?: { sharedTranscribePerTeacher: number; elevenlabsAlignPerTeacher: number };
  };
}
interface MemberToday {
  ownTts: number;
  ownTranscribe: number;
  ownTranscribeExhausted: boolean;
  ownTtsExhausted: number;
  sharedTts: number;
  sharedTranscribe: number;
  elevenlabsAlign: number;
}
/** The studio key's free Transcribe quota per day (Google AI Studio project of the studio owner). */
const STUDIO_TRANSCRIBE_DAILY = 100;
type Counter = { succeeded: number; failed: number };
type RequestService = 'gemini_tts' | 'gemini_transcribe' | 'elevenlabs_align' | 'voice';
const requestLabels: Record<RequestService, string> = {
  gemini_tts: 'Gemini seslendirme',
  gemini_transcribe: 'Gemini Transcribe',
  elevenlabs_align: 'ElevenLabs Forced Alignment',
  voice: 'ElevenLabs yedek sesi',
};
const counts = (c?: Counter) =>
  c ? (
    <>
      <strong>{c.succeeded + c.failed}</strong>
      {c.failed > 0 && <span className="text-xs text-red-700"> · {c.failed} başarısız</span>}
    </>
  ) : (
    '—'
  );
const timingLabels: Record<string, string> = {
  'gemini-transcribe': 'Gemini Transcribe',
  'forced-alignment': 'ElevenLabs Forced Alignment',
  whisper: 'Yerel Whisper',
  'elevenlabs-tts': 'ElevenLabs ses zamanları',
  none: 'Yok (yaklaşık zamanlama)',
};
const statuses: Record<string, string> = {
  pending: 'Onay bekliyor',
  approved: 'Onaylı',
  blocked: 'Durduruldu',
  draft: 'Taslak',
  audio_generated: 'Ses hazır',
  audio_approved: 'Ses seçildi',
  video_ready: 'Video hazır',
};
export const AdminPage: React.FC = () => {
  const { loadProjects } = useProjects();
  const [viewing, setViewing] = useState<QuestionProject | null>(null);
  const open = async (id: string) => {
    setBusy(true);
    try {
      const p = await readProjectForOverview(id);
      if (!p) throw new Error('Proje bulunamadı.');
      setViewing(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proje açılamadı.');
    } finally {
      setBusy(false);
    }
  };
  const [importMessage, setImportMessage] = useState('');
  const importLegacy = async () => {
    setBusy(true);
    try {
      const {
        data: { user },
      } = await database().auth.getUser();
      if (!user) throw new Error('Yeniden giriş yapın.');
      const raw =
        localStorage.getItem('arabic_ydt_teacher_projects_v2') ||
        localStorage.getItem('arabic_ydt_teacher_projects_v1') ||
        '[]';
      const projects = JSON.parse(raw);
      if (!Array.isArray(projects)) throw new Error('Eski kayıt okunamadı.');
      let count = 0;
      for (const p of projects) {
        if (!p.id || !p.videoConfig || typeof p.solutionText !== 'string') continue;
        const id = `legacy_${user.id}_${p.id}`;
        if (await projectRepository.getById(id)) continue;
        await projectRepository.save({ ...p, id });
        count++;
        setImportMessage(`${count} proje aktarıldı…`);
      }
      setImportMessage(`${count} eski proje hesabınıza aktarıldı. Tarayıcıdaki kopyalar korundu.`);
      await loadProjects();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktarım tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };
  const [voice, setVoice] = useState<ElevenLabsStatus | null>(null);
  const [data, setData] = useState<Overview | null>(null),
    [analytics, setAnalytics] = useState<Analytics | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [overviewResult, analyticsResponse, voiceStatus] = await Promise.all([
        database().rpc('admin_overview'),
        fetch('/api/admin/analytics', { headers: await authHeaders(), cache: 'no-store' }),
        elevenlabsService.checkStatus(),
      ]);
      setVoice(voiceStatus);
      if (overviewResult.error) throw overviewResult.error;
      const analyticsPayload = await analyticsResponse.json().catch(() => null);
      if (!analyticsResponse.ok) throw new Error(analyticsPayload?.error || 'Soru tipi istatistikleri alınamadı.');
      setData(overviewResult.data);
      setAnalytics(analyticsPayload);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yönetim bilgileri alınamadı.');
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const change = async (id: string, status: string) => {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await database().rpc('set_member_status', { member_id: id, new_status: status });
      if (error) throw error;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Değişiklik kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };
  const promote = async (member: Member) => {
    if (
      !window.confirm(
        `${member.name || member.email} kullanıcısına tam yönetici yetkisi verilsin mi? Yönetici tüm öğretmenleri ve projeleri görüntüleyebilir, üyelik erişimini yönetebilir.`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ memberId: member.id, role: 'admin' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Yönetici yetkisi verilemedi (HTTP ${response.status}).`);
      setMessage(`${member.name || member.email} artık yönetici.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yönetici yetkisi verilemedi.');
    } finally {
      setBusy(false);
    }
  };
  const who = (id: string) => data?.members.find((m) => m.id === id)?.name || 'Öğretmen';
  const categoryEntries = (counts: Record<string, number> | undefined) =>
    Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  const totalVideoReady = Object.values<MemberAnalytics>(analytics?.members || {}).reduce(
    (sum, m) => sum + m.videoReady,
    0,
  );
  const totalUploadedAudio = Object.values<MemberAnalytics>(analytics?.members || {}).reduce(
    (sum, m) => sum + m.uploadedAudio,
    0,
  );
  return (
    <section className="p-6 space-y-6 max-w-7xl mx-auto">
      {viewing && <ProjectViewer project={viewing} onClose={() => setViewing(null)} />}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Stüdyo yönetimi</h2>
          <p className="text-stone-500 text-sm mt-1">
            Üyelik erişimini yönetin, öğretmenlerin üretimlerini görüntüleyin. İçerikler için yönetici onayı gerekmez.
          </p>
        </div>
        <button disabled={busy} onClick={() => void load()} className="border rounded px-4 py-2">
          {busy ? 'Yükleniyor…' : 'Yenile'}
        </button>
      </div>
      {error && (
        <p role="alert" className="bg-red-50 text-red-800 p-3 rounded">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="bg-green-50 text-green-800 p-3 rounded">
          {message}
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          ['Öğretmen', data?.members.filter((m) => m.role === 'teacher').length || 0],
          ['Onay bekleyen', data?.members.filter((m) => m.status === 'pending').length || 0],
          ['Soru', analytics?.totalProjects ?? data?.members.reduce((s, m) => s + m.questions, 0) ?? 0],
          ['Seslendirilen soru', analytics?.funnel.withAudio ?? 0],
          ['Video hazır', totalVideoReady],
          ['Yüklenen MP3', totalUploadedAudio],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border rounded-xl p-5">
            <p className="text-sm text-stone-500">{label}</p>
            <strong className="text-3xl">{value}</strong>
          </div>
        ))}
      </div>
      {analytics?.requests && (
        <section className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold">İstek sayaçları</h3>
          <p className="text-xs text-stone-500 mt-1 mb-3">
            Her istek ayrı sayılır: her Gemini model denemesi, yeniden seslendirmeler ve başarısız istekler dahil.
            "Bugün", Gemini günlük kotasının sıfırlandığı Pasifik saatine göredir ({analytics.requests.quotaDay}).
          </p>
          {analytics.requests.migrationPending ? (
            <p className="text-sm bg-amber-50 text-amber-900 border border-amber-200 rounded p-3">
              İstek sayacı için veritabanı güncellemesi bekleniyor:{' '}
              <code>supabase/migrations/20260928_teacher_keys.sql</code> dosyasını Supabase SQL Editor'da bir kez
              çalıştırın. O zamana kadar istekler sayılmaz, günlük haklar uygulanmaz ve öğretmenler anahtar kaydedemez.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-stone-50">
                    <tr>
                      {['Servis', 'Bugün', 'Son 30 gün', 'Toplam'].map((t) => (
                        <th key={t} className="p-2 whitespace-nowrap">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(requestLabels) as RequestService[]).map((k) => (
                      <tr key={k} className="border-t">
                        <td className="p-2">{requestLabels[k]}</td>
                        <td className="p-2">{counts(analytics.requests!.totals.today[k])}</td>
                        <td className="p-2">{counts(analytics.requests!.totals.last30Days[k])}</td>
                        <td className="p-2">{counts(analytics.requests!.totals.all[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {Object.keys(analytics.requests.geminiModels).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-stone-500 mb-1">Gemini seslendirme · model başına</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {(
                      Object.entries(analytics.requests.geminiModels) as Array<
                        [string, { today: Counter; last30Days: Counter }]
                      >
                    )
                      .sort(
                        (a, b) =>
                          b[1].last30Days.succeeded +
                          b[1].last30Days.failed -
                          (a[1].last30Days.succeeded + a[1].last30Days.failed),
                      )
                      .map(([model, c]) => (
                        <div key={model} className="border rounded-lg px-3 py-2 text-sm">
                          <p className="font-mono-code text-xs break-all">{model}</p>
                          <p>Bugün {counts(c.today)}</p>
                          <p className="text-xs text-stone-500">
                            Son 30 gün: {c.last30Days.succeeded + c.last30Days.failed}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
      {analytics?.requests && !analytics.requests.migrationPending && (
        <section className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold">Google anahtarları ve bugünkü haklar</h3>
          <p className="text-xs text-stone-500 mt-1 mb-3">
            Sıra: öğretmenin kendi anahtarı → ortak anahtar (zamanlamada öğretmen başına günde{' '}
            {analytics.requests.limits?.sharedTranscribePerTeacher ?? 25}) → ElevenLabs hizalama (öğretmen başına günde{' '}
            {analytics.requests.limits?.elevenlabsAlignPerTeacher ?? 20}) → bilgisayarda Whisper. Yöneticiler
            sınırsızdır. Günlük kota dolan modeller Pasifik gece yarısına kadar atlanır.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <div className="border rounded-lg p-3">
              <p className="text-xs text-stone-500">Kendi anahtarını bağlayan</p>
              <strong className="text-2xl">
                {
                  Object.values<{ status: string }>(analytics.teacherKeys || {}).filter((k) => k.status === 'active')
                    .length
                }
              </strong>
              <span className="text-sm text-stone-500">
                {' '}
                / {data?.members.filter((m) => m.status === 'approved').length ?? 0} üye
              </span>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-stone-500">Ortak anahtar · bugünkü zamanlama</p>
              <strong className="text-2xl">{analytics.requests.studio?.transcribeUsed ?? 0}</strong>
              <span className="text-sm text-stone-500"> / ~{STUDIO_TRANSCRIBE_DAILY}</span>
              {analytics.requests.studio?.transcribeExhausted && (
                <p className="text-xs text-red-700">Bugünkü kota doldu</p>
              )}
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-stone-500">Ortak anahtar · kotası dolan ses modelleri</p>
              {analytics.requests.studio?.ttsExhausted.length ? (
                analytics.requests.studio.ttsExhausted.map((m) => (
                  <p key={m} className="font-mono-code text-xs break-all">
                    {m}
                  </p>
                ))
              ) : (
                <p className="text-sm">Yok</p>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50">
                <tr>
                  {[
                    'Öğretmen',
                    'Kendi anahtarı',
                    'Kendi ses',
                    'Kendi zamanlama',
                    'Ortak ses',
                    'Ortak zamanlama',
                    'ElevenLabs hizalama',
                  ].map((t) => (
                    <th key={t} className="p-2 whitespace-nowrap">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.members
                  .filter((m) => m.status === 'approved')
                  .map((m) => {
                    const k = analytics.teacherKeys?.[m.id];
                    const t = analytics.requests!.membersToday?.[m.id];
                    const admin = m.role === 'admin';
                    return (
                      <tr key={m.id} className="border-t">
                        <td className="p-2">{m.name}</td>
                        <td className="p-2 whitespace-nowrap">
                          {k ? (
                            k.status === 'active' ? (
                              <span className="text-[#15803D] font-semibold">Bağlı · ••••{k.last4}</span>
                            ) : (
                              <span className="text-red-700 font-semibold">Geçersiz</span>
                            )
                          ) : (
                            <span className="text-stone-400">Yok</span>
                          )}
                        </td>
                        <td className="p-2">
                          {t?.ownTts ?? 0}
                          {t?.ownTtsExhausted ? (
                            <span className="text-xs text-stone-500"> · {t.ownTtsExhausted} model doldu</span>
                          ) : null}
                        </td>
                        <td className="p-2">
                          {t?.ownTranscribe ?? 0}
                          {t?.ownTranscribeExhausted && <span className="text-xs text-red-700"> · doldu</span>}
                        </td>
                        <td className="p-2">{t?.sharedTts ?? 0}</td>
                        <td className="p-2">
                          {t?.sharedTranscribe ?? 0}
                          {!admin && (
                            <span className="text-stone-500">
                              {' '}
                              / {analytics.requests!.limits?.sharedTranscribePerTeacher ?? 25}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {t?.elevenlabsAlign ?? 0}
                          {!admin && (
                            <span className="text-stone-500">
                              {' '}
                              / {analytics.requests!.limits?.elevenlabsAlignPerTeacher ?? 20}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            "Bugün", {analytics.requests.quotaDay} Pasifik günüdür (Türkiye saatiyle 10:00–11:00 arası yenilenir).
            Sayılar kotadan düşen istekleri gösterir; 429 ile reddedilen istekler dahil değildir.
          </p>
        </section>
      )}
      <StorageSection />
      {analytics && (
        <section className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold">Ses ve zamanlama</h3>
          <p className="text-xs text-stone-500 mt-1 mb-3">
            Her projenin şu anki ses kaydına göre. Ana ses Gemini, yedek ElevenLabs.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 space-y-1.5 text-sm">
              <p className="text-xs font-semibold text-stone-500">Ses motoru</p>
              <div className="flex items-center justify-between gap-3">
                <span>Gemini</span>
                <strong>{analytics.voice.gemini}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>ElevenLabs yedeği</span>
                <strong>{analytics.voice.elevenlabs}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-stone-500">
                <span>Gemini hatası sonrası</span>
                <span>{analytics.voice.geminiFallbacks}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Yüklenen MP3</span>
                <strong>{analytics.voice.uploaded}</strong>
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-1.5 text-sm">
              <p className="text-xs font-semibold text-stone-500">Gemini modelleri</p>
              {categoryEntries(analytics.voice.models).map(([model, count]) => (
                <div key={model} className="flex items-center justify-between gap-3">
                  <span className="font-mono-code text-xs break-all">{model}</span>
                  <strong>{count}</strong>
                </div>
              ))}
              {!Object.keys(analytics.voice.models).length && (
                <p className="text-xs text-stone-400">Henüz Gemini sesi yok</p>
              )}
            </div>
            <div className="border rounded-lg p-3 space-y-1.5 text-sm">
              <p className="text-xs font-semibold text-stone-500">Kelime zamanı kaynağı</p>
              {categoryEntries(analytics.voice.timing).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between gap-3">
                  <span>{timingLabels[source] || source}</span>
                  <strong>{count}</strong>
                </div>
              ))}
              {!Object.keys(analytics.voice.timing).length && <p className="text-xs text-stone-400">Henüz ses yok</p>}
            </div>
            <div className="border rounded-lg p-3 space-y-1.5 text-sm">
              <p className="text-xs font-semibold text-stone-500">ElevenLabs yedek kotası</p>
              <strong className="text-2xl">
                {voice?.remainingCharacters != null ? voice.remainingCharacters.toLocaleString('tr') : '—'}
              </strong>
              <p className="text-xs text-stone-500">
                {voice?.remainingCharacters != null
                  ? `karakter kaldı${voice.tier ? ` · ${voice.tier}` : ''}`
                  : voice?.configured
                    ? 'Kota okunamadı'
                    : 'ElevenLabs yapılandırılmamış'}
              </p>
              <p className="text-xs text-stone-500">
                Gemini: {voice?.gemini?.configured ? 'yapılandırıldı' : 'yapılandırılmamış'}
              </p>
            </div>
          </div>
        </section>
      )}
      {analytics && (
        <section className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold mb-3">Üretim hunisi ve kalite</h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ['Proje', analytics.funnel.total],
              ['Sesli', analytics.funnel.withAudio],
              ['İşaretleri hazır', analytics.funnel.withMarkers],
              ['Yayına hazır', analytics.funnel.ready],
              ['MP4 indirilen', data?.members.reduce((s, m) => s + m.exports, 0) ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="border rounded-lg p-3">
                <p className="text-xs text-stone-500">{label}</p>
                <strong className="text-2xl">{value}</strong>
              </div>
            ))}
          </div>
          <p className="text-sm mt-3">
            <span className="text-[#15803D] font-semibold">{analytics.quality.ready} yayına hazır</span> ·{' '}
            <span className="text-[#B45309] font-semibold">{analytics.quality.check} kontrol önerilir</span> ·{' '}
            <span className="text-red-700 font-semibold">{analytics.quality.blocked} düzeltme gerekli</span>
          </p>
        </section>
      )}
      {analytics && analytics.issues.length > 0 && (
        <section className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold mb-3">Dikkat gerektiren projeler</h3>
          <ul className="divide-y text-sm">
            {analytics.issues.map((issue) => (
              <li
                key={issue.projectId + issue.detail}
                className="py-2 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <button
                    disabled={busy}
                    className="text-[#8b1e2d] underline text-left"
                    onClick={() => void open(issue.projectId)}
                  >
                    {issue.title}
                  </button>{' '}
                  <span className="text-stone-500">· {who(issue.ownerId)}</span>
                  <p className="text-xs text-stone-600 break-words">{issue.detail}</p>
                </div>
                <span className="text-xs text-stone-400 whitespace-nowrap">
                  {new Date(issue.updatedAt).toLocaleString('tr')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {analytics && (
        <section className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold">Soru tipi dağılımı</h3>
              <p className="text-xs text-stone-500 mt-1">Tüm öğretmenlerin kaydettiği projeler, soru tipine göre.</p>
            </div>
            <span className="text-xs text-stone-500">{Object.keys(analytics.categoryTotals).length} aktif tip</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {categoryEntries(analytics.categoryTotals).map(([id, count]) => (
              <div key={id} className="border rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                <span className="text-sm">{getCategoryLabel(id)}</span>
                <strong className="font-mono-code">{count}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      <details className="bg-white border rounded-xl p-4 text-sm">
        <summary>Eski tarayıcı kayıtlarım</summary>
        <p className="my-3">
          Önceki sürümde bu tarayıcıya kaydettiğiniz projeleri kendi yönetici hesabınıza aktarın. Daha önce aktarılanlar
          tekrar eklenmez.
        </p>
        <button disabled={busy} className="border rounded p-2" onClick={() => void importLegacy()}>
          Eski projelerimi aktar
        </button>
        {importMessage && (
          <p role="status" className="mt-2">
            {importMessage}
          </p>
        )}
      </details>
      <section className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 flex flex-wrap justify-between gap-3">
          <h3 className="font-semibold">Üyeler ve üretim</h3>
          <input
            aria-label="Öğretmen ara"
            placeholder="Ad veya e-posta ara"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded p-2 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50">
              <tr>
                {[
                  'Öğretmen',
                  'Rol',
                  'Durum',
                  'Sorular',
                  'Soru tipleri',
                  'Video hazır',
                  'Kalite',
                  'Gemini ses',
                  'Gemini istek',
                  'ElevenLabs yedeği',
                  'ElevenLabs karakter',
                  'Video dışa aktarım',
                  'Son çalışma',
                  'Erişim',
                ].map((t) => (
                  <th key={t} className="p-3 whitespace-nowrap">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.members
                .filter((m) =>
                  (m.name + ' ' + m.email).toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr')),
                )
                .map((m) => {
                  const stats = analytics?.members[m.id];
                  const types = categoryEntries(stats?.categories);
                  return (
                    <tr key={m.id} className="border-t align-top">
                      <td className="p-3">
                        <div>{m.name}</div>
                        <div className="text-xs text-stone-500">{m.email}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${m.role === 'admin' ? 'bg-[#F8EEEE] text-[#8B1E2D]' : 'bg-stone-100 text-stone-600'}`}
                        >
                          {m.role === 'admin' ? 'Yönetici' : 'Öğretmen'}
                        </span>
                      </td>
                      <td className="p-3">{statuses[m.status] || m.status}</td>
                      <td className="p-3 font-semibold">{m.questions}</td>
                      <td className="p-3 min-w-64">
                        {types.length ? (
                          <details>
                            <summary className="cursor-pointer text-[#8B1E2D] font-semibold">
                              {types.length} tip · ayrıntı
                            </summary>
                            <div className="mt-2 space-y-1">
                              {types.map(([id, count]) => (
                                <div key={id} className="flex items-center justify-between gap-3 text-xs">
                                  <span>{getCategoryLabel(id)}</span>
                                  <strong>{count}</strong>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <span className="text-stone-400">Henüz soru yok</span>
                        )}
                      </td>
                      <td className="p-3">{stats?.videoReady || 0}</td>
                      <td className="p-3 whitespace-nowrap text-xs">
                        <span className="text-[#15803D] font-semibold">{stats?.quality.ready || 0}</span> ·{' '}
                        <span className="text-[#B45309] font-semibold">{stats?.quality.check || 0}</span> ·{' '}
                        <span className="text-red-700 font-semibold">{stats?.quality.blocked || 0}</span>
                      </td>
                      <td className="p-3 font-semibold">{stats?.gemini || 0}</td>
                      <td className="p-3">
                        {analytics?.requests?.members[m.id]?.gemini_tts ?? 0}
                        <div className="text-xs text-stone-500">
                          {analytics?.requests?.members[m.id]?.gemini_transcribe ?? 0} transcribe
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{m.voices} başarılı</div>
                        <div className="text-xs text-stone-500">
                          {m.voice_attempts} deneme
                          {stats?.geminiFallbacks ? ` · ${stats.geminiFallbacks} Gemini hatası sonrası` : ''}
                        </div>
                      </td>
                      <td className="p-3">{m.characters.toLocaleString('tr')}</td>
                      <td className="p-3">{m.exports}</td>
                      <td className="p-3 whitespace-nowrap text-xs">
                        {stats?.lastProjectAt ? new Date(stats.lastProjectAt).toLocaleString('tr') : '-'}
                      </td>
                      <td className="p-3">
                        {m.role !== 'admin' ? (
                          <div className="flex flex-wrap gap-2 items-center">
                            <select
                              aria-label={`${m.email} erişimi`}
                              disabled={busy}
                              value={m.status}
                              onChange={(e) => void change(m.id, e.target.value)}
                              className="border rounded p-2"
                            >
                              <option value="pending">Onay bekliyor</option>
                              <option value="approved">Onayla</option>
                              <option value="blocked">Durdur</option>
                            </select>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void promote(m)}
                              className="border border-[#8B1E2D] text-[#8B1E2D] hover:bg-[#F8EEEE] rounded px-3 py-2 font-semibold whitespace-nowrap"
                            >
                              Yönetici Yap
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500">Tam yetki</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-stone-500 p-4">
          Soru tipi, kalite ve Gemini sayıları kayıtlı projelerin şu anki durumundan hesaplanır (kalite: yayına hazır ·
          kontrol önerilir · düzeltme gerekli). ElevenLabs sütunları yalnız yedek ses isteklerini gösterir; denemelere
          başarısız istekler dahildir, karakter sayısı fatura tutarı değildir. Video dışa aktarım sayısı tarayıcının
          bildirdiği tamamlanan dışa aktarımlardır.
        </p>
      </section>
      <section className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-3">Son 100 soru projesi</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                {['Proje', 'Öğretmen', 'Tür', 'Durum', 'Güncelleme'].map((t) => (
                  <th className="p-2" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.projects.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">
                    <button
                      disabled={busy}
                      className="text-[#8b1e2d] underline text-left"
                      onClick={() => void open(p.id)}
                    >
                      {p.title}
                    </button>
                  </td>
                  <td className="p-2">{who(p.owner_id)}</td>
                  <td className="p-2">{getCategoryLabel(p.category)}</td>
                  <td className="p-2">{statuses[p.status] || p.status}</td>
                  <td className="p-2">{new Date(p.updated_at).toLocaleString('tr')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-3">Son 100 işlem</h3>
        <ul className="divide-y text-sm">
          {data?.activity.map((a) => (
            <li key={a.id} className="py-2">
              {who(a.owner_id)} ·{' '}
              {a.kind === 'voice'
                ? a.state.startsWith('align')
                  ? 'Ses hizalama'
                  : 'ElevenLabs yedek sesi'
                : a.kind === 'video_export'
                  ? 'Video dışa aktarımı'
                  : a.kind === 'member_role'
                    ? 'Rol değişikliği'
                    : 'Üyelik'}{' '}
              ·{' '}
              {(
                {
                  succeeded: 'Tamamlandı',
                  requested: 'İstek gönderildi',
                  failed: 'Başarısız',
                  aligned: 'Tamamlandı',
                  align_failed: 'Başarısız',
                  uncertain: 'Sonuç doğrulanamadı',
                  client_reported: 'Tarayıcıda tamamlandı',
                  role_admin: 'Yönetici yapıldı',
                  ...statuses,
                } as Record<string, string>
              )[a.state] || a.state}{' '}
              <span className="text-stone-400">{new Date(a.created_at).toLocaleString('tr')}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
};
