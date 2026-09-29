import { readProjectForOverview } from '../features/projects/cloudProjectRepository';
import { quotaResetClock } from '../services/narration/geminiKeyService';
import { ProjectViewer } from '../features/projects/ProjectViewer';
import { StorageSection } from '../features/admin/StorageSection';
import { FeedbackSection } from '../features/admin/FeedbackSection';
import type { QuestionProject } from '../types';
import { projectRepository } from '../features/projects/projectRepository';
import { useProjects } from '../features/projects/ProjectContext';
import React, { useCallback, useEffect, useState } from 'react';
import { authHeaders, database } from '../services/supabase';
import { getCategoryLabel } from '../config/categories';
import { elevenlabsService } from '../services/elevenlabs/elevenlabsService';
import type { ElevenLabsStatus } from '../types';
import { ArrowClockwise, CheckCircle, UserPlus } from '@phosphor-icons/react';

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
  projects: Array<{ id: string; owner_id: string; title: string; category: string; status: string; updated_at: string }>;
  activity: Array<{ id: string; owner_id: string; kind: string; state: string; characters: number; created_at: string }>;
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
interface MemberToday {
  ownTts: number;
  ownTranscribe: number;
  ownTranscribeExhausted: boolean;
  ownTtsExhausted: number;
  sharedTts: number;
  sharedTranscribe: number;
  elevenlabsAlign: number;
}
type Counter = { succeeded: number; failed: number };
type RequestService = 'gemini_tts' | 'gemini_transcribe' | 'elevenlabs_align' | 'voice';
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
    resetsAt?: string;
    failures?: Array<{ at: string; ownerId: string; kind: RequestService; keySource: string | null; model: string; status: string; reason: string }>;
    totals: Record<'today' | 'last30Days' | 'all', Record<RequestService, Counter>>;
    geminiModels: Record<string, { today: Counter; last30Days: Counter; sharedToday?: number; lastQuota?: string }>;
    members: Record<string, Record<RequestService, number>>;
    membersToday?: Record<string, MemberToday>;
    studio?: { transcribeUsed: number; transcribeExhausted: boolean; ttsExhausted: string[] };
    limits?: { sharedTranscribePerTeacher: number; elevenlabsAlignPerTeacher: number };
  };
}

/** The studio key's Transcribe quota per day on the free tier (billing off on the studio owner's AI Studio project). */
const STUDIO_TRANSCRIBE_DAILY = 25;
const requestLabels: Record<RequestService, string> = {
  gemini_tts: 'Gemini seslendirme',
  gemini_transcribe: 'Gemini Transcribe',
  elevenlabs_align: 'ElevenLabs Forced Alignment',
  voice: 'ElevenLabs yedek sesi',
};
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
const activityStates: Record<string, string> = {
  succeeded: 'Tamamlandı',
  requested: 'İstek gönderildi',
  failed: 'Başarısız',
  aligned: 'Tamamlandı',
  align_failed: 'Başarısız',
  uncertain: 'Sonuç doğrulanamadı',
  client_reported: 'Tarayıcıda tamamlandı',
  role_admin: 'Yönetici yapıldı',
  ...statuses,
};

const counts = (c?: Counter) =>
  c ? (
    <>
      <strong className="tabular-nums">{c.succeeded + c.failed}</strong>
      {c.failed > 0 && <span className="text-xs text-red-700"> · {c.failed} başarısız</span>}
    </>
  ) : (
    '—'
  );
const sorted = (map: Record<string, number> | undefined) => Object.entries(map || {}).sort((a, b) => b[1] - a[1]);
const dateTime = (iso: string) => new Date(iso).toLocaleString('tr', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return rtf.format(-Math.round(minutes / 60), 'hour');
  return rtf.format(-Math.round(minutes / 1440), 'day');
}

type Tab = 'overview' | 'teachers' | 'usage' | 'projects';
const card = 'rounded-xl border bg-white p-5';

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }> = ({ label, value, hint, tone }) => (
  <div className={card}>
    <p className="text-sm text-[#666560]">{label}</p>
    <p className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${tone || 'text-[#1C1917]'}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-[#787670]">{hint}</p>}
  </div>
);
const SectionTitle: React.FC<{ title: string; note?: React.ReactNode; action?: React.ReactNode }> = ({ title, note, action }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
    <div>
      <h3 className="font-bold text-[#1C1917]">{title}</h3>
      {note && <p className="text-xs text-[#787670] mt-1 max-w-3xl">{note}</p>}
    </div>
    {action}
  </div>
);
const Chip: React.FC<{ tone: 'green' | 'amber' | 'red' | 'gray' | 'brand'; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
      {
        green: 'bg-[#EFF7F0] text-[#1E562A]',
        amber: 'bg-[#FFF8E6] text-[#78540E]',
        red: 'bg-red-50 text-red-700',
        gray: 'bg-[#F2F1EB] text-[#55544F]',
        brand: 'bg-[#F8EEEE] text-[#8B1E2D]',
      }[tone]
    }`}
  >
    {children}
  </span>
);

export const AdminPage: React.FC = () => {
  const { loadProjects } = useProjects();
  const [tab, setTab] = useState<Tab>('overview');
  const [viewing, setViewing] = useState<QuestionProject | null>(null);
  const [voice, setVoice] = useState<ElevenLabsStatus | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [importMessage, setImportMessage] = useState('');

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
      if (!analyticsResponse.ok) throw new Error(analyticsPayload?.error || 'Yönetim istatistikleri alınamadı.');
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

  const change = async (member: Member, status: string) => {
    if (status === 'blocked' && !window.confirm(`${member.name || member.email} için erişim durdurulsun mu? Projeleri silinmez.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await database().rpc('set_member_status', { member_id: member.id, new_status: status });
      if (error) throw error;
      setMessage(`${member.name || member.email}: ${statuses[status] || status}.`);
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

  const importLegacy = async () => {
    setBusy(true);
    try {
      const {
        data: { user },
      } = await database().auth.getUser();
      if (!user) throw new Error('Yeniden giriş yapın.');
      const raw =
        localStorage.getItem('arabic_ydt_teacher_projects_v2') || localStorage.getItem('arabic_ydt_teacher_projects_v1') || '[]';
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

  const members = data?.members || [];
  const pending = members.filter((m) => m.status === 'pending');
  const who = (id: string) => members.find((m) => m.id === id)?.name || 'Öğretmen';
  const memberStats = Object.values<MemberAnalytics>(analytics?.members || {});
  const totalVideoReady = memberStats.reduce((sum, m) => sum + m.videoReady, 0);
  const requests = analytics?.requests;
  const limits = { shared: requests?.limits?.sharedTranscribePerTeacher ?? 25, eleven: requests?.limits?.elevenlabsAlignPerTeacher ?? 20 };
  const activeKeys = Object.values<{ status: string }>(analytics?.teacherKeys || {}).filter((k) => k.status === 'active').length;

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: 'overview', label: 'Genel bakış' },
    { id: 'teachers', label: 'Öğretmenler', badge: pending.length || undefined },
    { id: 'usage', label: 'Kullanım' },
    { id: 'projects', label: 'Projeler' },
  ];

  const issuesList = (limit?: number) =>
    analytics && analytics.issues.length > 0 ? (
      <ul className="divide-y divide-[#EFEFEA]">
        {analytics.issues.slice(0, limit).map((issue) => (
          <li key={issue.projectId + issue.detail} className="py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button disabled={busy} className="font-semibold text-[#8B1E2D] hover:underline text-left" onClick={() => void open(issue.projectId)}>
                {issue.title}
              </button>{' '}
              <span className="text-sm text-[#787670]">· {who(issue.ownerId)}</span>
              <p className="text-xs text-[#55544F] break-words mt-0.5">{issue.detail}</p>
            </div>
            <span className="text-xs text-[#A8A69E] whitespace-nowrap">{ago(issue.updatedAt)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-[#787670] flex items-center gap-2">
        <CheckCircle size={18} weight="fill" className="text-[#15803D]" /> Dikkat gerektiren proje yok.
      </p>
    );

  return (
    <section className="studio-library">
      {viewing && <ProjectViewer project={viewing} onClose={() => setViewing(null)} />}
      <header className="library-heading !mb-5">
        <div>
          <h2>Yönetim</h2>
          <p>Üyelik erişimini yönetin, öğretmenlerin üretimini ve kaynak kullanımını izleyin.</p>
        </div>
        <button disabled={busy} onClick={() => void load()} className="studio-secondary">
          <ArrowClockwise size={16} weight="bold" className={busy ? 'animate-spin' : ''} /> {busy ? 'Yükleniyor…' : 'Yenile'}
        </button>
      </header>

      <div role="tablist" aria-label="Yönetim bölümleri" className="flex gap-1 border-b mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 -mb-px border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-[#8B1E2D] text-[#8B1E2D]' : 'border-transparent text-[#666560] hover:text-[#1C1917]'
            }`}
          >
            {t.label}
            {t.badge ? <span className="ml-2 rounded-full bg-[#8B1E2D] text-white text-[11px] px-1.5 py-0.5">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 bg-red-50 text-red-800 p-3 rounded-xl text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 bg-[#EFF7F0] text-[#1E562A] p-3 rounded-xl text-sm">
          {message}
        </p>
      )}

      {tab === 'overview' && (
        <div className="space-y-6">
          <FeedbackSection who={who} />
          {pending.length > 0 && (
            <section className="rounded-xl border border-[#E5D7B0] bg-[#FFF8E6] p-5">
              <SectionTitle title={`Onay bekleyen hesaplar (${pending.length})`} note="E-postasını doğrulamış ve onayınızı bekleyen öğretmenler." />
              <ul className="space-y-2">
                {pending.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white border px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserPlus size={20} className="text-[#78540E] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{m.name}</p>
                        <p className="text-xs text-[#787670] truncate">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button disabled={busy} className="studio-primary !min-h-0 !py-2" onClick={() => void change(m, 'approved')}>
                        Onayla
                      </button>
                      <button disabled={busy} className="studio-secondary !min-h-0 !py-2" onClick={() => void change(m, 'blocked')}>
                        Reddet
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Onaylı öğretmen" value={members.filter((m) => m.status === 'approved' && m.role === 'teacher').length}
              hint={`${activeKeys} kişi kendi Google anahtarını bağladı`} />
            <Stat label="Soru" value={analytics?.totalProjects ?? members.reduce((s, m) => s + m.questions, 0)}
              hint={`${analytics?.funnel.withAudio ?? 0} tanesi seslendirildi`} />
            <Stat label="Video hazır" value={totalVideoReady} tone="text-[#8B1E2D]"
              hint={`${members.reduce((s, m) => s + m.exports, 0)} MP4 indirildi`} />
            <Stat label="Yayına hazır" value={analytics?.quality.ready ?? 0} tone="text-[#1E562A]"
              hint={analytics ? `${analytics.quality.check} kontrol önerilir · ${analytics.quality.blocked} düzeltme gerekli` : undefined} />
          </div>

          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
            <section className={card}>
              <SectionTitle
                title="Dikkat gerektiren projeler"
                action={analytics && analytics.issues.length > 6 ? (
                  <button className="text-sm font-semibold text-[#8B1E2D] hover:underline" onClick={() => setTab('projects')}>Tümü</button>
                ) : undefined}
              />
              {issuesList(6)}
            </section>
            <section className={card}>
              <SectionTitle title="Üretim hunisi" />
              {analytics && (
                <div className="space-y-3">
                  {([
                    ['Proje', analytics.funnel.total],
                    ['Sesli', analytics.funnel.withAudio],
                    ['İşaretleri hazır', analytics.funnel.withMarkers],
                    ['Yayına hazır', analytics.funnel.ready],
                  ] as Array<[string, number]>).map(([label, value]) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm"><span className="text-[#55544F]">{label}</span><strong className="tabular-nums">{value}</strong></div>
                      <div className="h-2 rounded-full bg-[#F2F1EB] mt-1 overflow-hidden">
                        <div className="h-full bg-[#8B1E2D]" style={{ width: `${analytics.funnel.total ? (value / analytics.funnel.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {requests && !requests.migrationPending && (
                <div className="mt-5 pt-4 border-t text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-[#55544F]">Ortak anahtar · bugünkü zamanlama</span>
                    <strong className={`tabular-nums ${requests.studio?.transcribeExhausted ? 'text-red-700' : ''}`}>{requests.studio?.transcribeUsed ?? 0} / ~{STUDIO_TRANSCRIBE_DAILY}</strong></div>
                  <div className="flex justify-between"><span className="text-[#55544F]">ElevenLabs yedek kotası</span>
                    <strong className="tabular-nums">{voice?.remainingCharacters != null ? `${voice.remainingCharacters.toLocaleString('tr')} karakter` : '—'}</strong></div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'teachers' && (
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
                  {['Öğretmen', 'Durum', 'Sorular', 'Kalite', 'Google anahtarı', 'Bugün', 'Son çalışma', 'Erişim'].map((t) => (
                    <th key={t} className="px-4 py-3 font-semibold whitespace-nowrap">{t}</th>
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
                    return (
                      <tr key={m.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold flex items-center gap-2">{m.name}{admin && <Chip tone="brand">Yönetici</Chip>}</div>
                          <div className="text-xs text-[#787670]">{m.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Chip tone={m.status === 'approved' ? 'green' : m.status === 'pending' ? 'amber' : 'red'}>{statuses[m.status] || m.status}</Chip>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold tabular-nums">{m.questions}</span>
                          <span className="text-xs text-[#787670]"> · {stats?.videoReady || 0} video</span>
                          {types.length > 0 && (
                            <div className="text-xs text-[#787670]" title={types.map(([id, n]) => `${getCategoryLabel(id)}: ${n}`).join('\n')}>
                              {types.length === 1 ? getCategoryLabel(types[0][0]) : `${types.length} soru tipi`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs" title="yayına hazır · kontrol önerilir · düzeltme gerekli">
                          <span className="text-[#15803D] font-semibold">{stats?.quality.ready || 0}</span>
                          <span className="text-[#C9C7BE]"> · </span>
                          <span className="text-[#B45309] font-semibold">{stats?.quality.check || 0}</span>
                          <span className="text-[#C9C7BE]"> · </span>
                          <span className="text-red-700 font-semibold">{stats?.quality.blocked || 0}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {key ? (key.status === 'active' ? <Chip tone="green">Bağlı · ••••{key.last4}</Chip> : <Chip tone="red">Geçersiz</Chip>) : <Chip tone="gray">Yok</Chip>}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap text-[#55544F]">
                          {requests?.migrationPending ? '—' : (
                            <>
                              <div>Ses: kendi {today?.ownTts ?? 0}{today?.sharedTts ? ` · ortak ${today.sharedTts}` : ''}{today?.ownTtsExhausted ? <span className="text-red-700"> · {today.ownTtsExhausted} model doldu</span> : ''}</div>
                              <div className="text-[#787670]">
                                Zamanlama: kendi {today?.ownTranscribe ?? 0} · ortak {today?.sharedTranscribe ?? 0}{admin ? '' : `/${limits.shared}`} · ElevenLabs {today?.elevenlabsAlign ?? 0}{admin ? '' : `/${limits.eleven}`}
                                {today?.ownTranscribeExhausted && <span className="text-red-700"> · kendi kotası doldu</span>}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap text-[#55544F]" title={stats?.lastProjectAt ? new Date(stats.lastProjectAt).toLocaleString('tr') : undefined}>
                          {ago(stats?.lastProjectAt)}
                        </td>
                        <td className="px-4 py-3">
                          {!admin ? (
                            <div className="flex flex-col gap-1.5 items-start">
                              <select aria-label={`${m.email} erişimi`} disabled={busy} value={m.status}
                                onChange={(e) => void change(m, e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
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
            Soru ve kalite sayıları kayıtlı projelerin şu anki durumundan hesaplanır. “Bugün” sütunu Google kotasından düşen istekleri gösterir (429 ile reddedilenler hariç).
          </p>
        </section>
      )}

      {tab === 'usage' && (
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
      )}

      {tab === 'projects' && (
        <div className="space-y-6">
          <section className={card}>
            <SectionTitle title="Dikkat gerektiren projeler" note="Gemini'nin kullanılamadığı, kelime zamanı alınamayan veya yayın kontrolünde düzeltme gereken son projeler." />
            {issuesList()}
          </section>

          {analytics && (
            <section className={card}>
              <SectionTitle title="Soru tipi dağılımı" note="Tüm öğretmenlerin kaydettiği projeler, soru tipine göre." />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sorted(analytics.categoryTotals).map(([id, n]) => (
                  <div key={id} className="border rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                    <span className="text-sm">{getCategoryLabel(id)}</span>
                    <strong className="tabular-nums">{n}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
            <section className={card}>
              <SectionTitle title="Son projeler" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-[#666560]">
                    <tr>{['Proje', 'Öğretmen', 'Tür', 'Durum', 'Güncelleme'].map((t) => <th key={t} className="px-2 py-2 font-semibold">{t}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEFEA]">
                    {data?.projects.map((p) => (
                      <tr key={p.id}>
                        <td className="px-2 py-2">
                          <button disabled={busy} className="font-semibold text-[#8B1E2D] hover:underline text-left" onClick={() => void open(p.id)}>{p.title}</button>
                        </td>
                        <td className="px-2 py-2">{who(p.owner_id)}</td>
                        <td className="px-2 py-2 text-[#55544F]">{getCategoryLabel(p.category)}</td>
                        <td className="px-2 py-2">{statuses[p.status] || p.status}</td>
                        <td className="px-2 py-2 text-xs text-[#787670] whitespace-nowrap">{dateTime(p.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className={card}>
              <SectionTitle title="Son işlemler" />
              <ul className="divide-y divide-[#EFEFEA] text-sm">
                {data?.activity.map((a) => (
                  <li key={a.id} className="py-2 flex justify-between gap-3">
                    <span>
                      <span className="font-semibold">{who(a.owner_id)}</span> ·{' '}
                      {a.kind === 'voice' ? (a.state.startsWith('align') ? 'Ses hizalama' : 'ElevenLabs yedek sesi')
                        : a.kind === 'video_export' ? 'Video dışa aktarımı' : a.kind === 'member_role' ? 'Rol değişikliği' : 'Üyelik'}{' '}
                      · <span className="text-[#55544F]">{activityStates[a.state] || a.state}</span>
                    </span>
                    <span className="text-xs text-[#A8A69E] whitespace-nowrap">{ago(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <details className={`${card} text-sm`}>
            <summary className="cursor-pointer font-semibold text-[#55544F]">Eski tarayıcı kayıtlarım</summary>
            <p className="my-3 text-[#55544F]">
              Önceki sürümde bu tarayıcıya kaydettiğiniz projeleri kendi yönetici hesabınıza aktarın. Daha önce aktarılanlar tekrar eklenmez.
            </p>
            <button disabled={busy} className="studio-secondary" onClick={() => void importLegacy()}>Eski projelerimi aktar</button>
            {importMessage && <p role="status" className="mt-2">{importMessage}</p>}
          </details>
        </div>
      )}
      {!analytics && !error && busy && (
        <p className="text-sm text-[#787670] flex items-center gap-2"><ArrowClockwise size={16} className="animate-spin" /> Yönetim bilgileri yükleniyor…</p>
      )}
    </section>
  );
};
