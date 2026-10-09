import { readProjectForOverview } from '../features/projects/cloudProjectRepository';
import { ProjectViewer } from '../features/projects/ProjectViewer';
import { MessagesSection } from '../features/admin/MessagesSection';
import { loadAllMessages } from '../features/messages/messages';
import type { QuestionProject } from '../types';
import { projectRepository } from '../features/projects/projectRepository';
import { useProjects } from '../features/projects/ProjectContext';
import React, { useCallback, useEffect, useState } from 'react';
import { authHeaders, database } from '../services/supabase';
import { elevenlabsService } from '../services/elevenlabs/elevenlabsService';
import type { ElevenLabsStatus } from '../types';
import { ArrowClockwise, CheckCircle } from '@phosphor-icons/react';
import { useConfirm } from '../components/common/ConfirmDialog';
import { plainMessage } from '../services/plainError';

import { AdminCtx, Analytics, MemberAnalytics, Member, Overview, Tab, ago, statuses } from '../features/admin/adminShared';
import { OverviewTab } from '../features/admin/OverviewTab';
import { TeachersTab } from '../features/admin/TeachersTab';
import { UsageTab } from '../features/admin/UsageTab';
import { ProjectsTab } from '../features/admin/ProjectsTab';
import { StudioSettingsCard } from '../features/settings/StudioSettingsCard';

export const AdminPage: React.FC = () => {
  const confirm = useConfirm();
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
  const [projectOwner, setProjectOwner] = useState('');
  const showProjects = (ownerId: string) => { setProjectOwner(ownerId); setTab('projects'); };
  const [importMessage, setImportMessage] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    loadAllMessages().then(list => setUnreadMessages(list.filter(m => !m.from_admin && !m.read_at).length)).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    // Each part loads on its own: a failed statistics call never hides members waiting for approval.
    const problems: string[] = [];
    const [overview, analyticsResult, voiceResult] = await Promise.allSettled([
      database().rpc('admin_overview'),
      (async () => {
        const response = await fetch('/api/admin/analytics', { headers: await authHeaders(), cache: 'no-store' });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Yönetim istatistikleri alınamadı.');
        return payload;
      })(),
      elevenlabsService.checkStatus(),
    ]);
    if (overview.status === 'fulfilled' && !overview.value.error) setData(overview.value.data);
    else problems.push('Üye ve proje listesi alınamadı.');
    if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
    else problems.push(analyticsResult.reason instanceof Error ? analyticsResult.reason.message : 'Yönetim istatistikleri alınamadı.');
    if (voiceResult.status === 'fulfilled') setVoice(voiceResult.value);
    setError(problems.join(' '));
    setBusy(false);
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
      setError(plainMessage(e, 'Proje açılamadı.'));
    } finally {
      setBusy(false);
    }
  };

  const change = async (member: Member, status: string) => {
    if (status === 'blocked' && !await confirm({ title: 'Erişim durdurulsun mu?', message: `${member.name || member.email} artık giriş yapamaz. Projeleri silinmez.`, confirmLabel: 'Erişimi durdur', danger: true })) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await database().rpc('set_member_status', { member_id: member.id, new_status: status });
      if (error) throw error;
      setMessage(`${member.name || member.email}: ${statuses[status] || status}.`);
      await load();
    } catch (e) {
      setError(plainMessage(e, 'Değişiklik kaydedilemedi.'));
    } finally {
      setBusy(false);
    }
  };

  const promote = async (member: Member) => {
    if (!await confirm({ title: 'Yönetici yapılsın mı?', message: `${member.name || member.email} tüm öğretmenleri ve projeleri görebilir, üyelikleri yönetebilir.`, confirmLabel: 'Yönetici yap' })) return;
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
      setError(plainMessage(e, 'Yönetici yetkisi verilemedi.'));
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
      setError(plainMessage(e, 'Aktarım tamamlanamadı.'));
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
    { id: 'messages', label: 'Mesajlar', badge: unreadMessages || undefined },
    { id: 'teachers', label: 'Öğretmenler', badge: pending.length || undefined },
    { id: 'usage', label: 'Kullanım' },
    { id: 'projects', label: 'Projeler' },
    { id: 'settings', label: 'Stüdyo ayarları' },
  ];

  const issuesList = (limit?: number) =>
    analytics && analytics.issues.length > 0 ? (
      <ul className="divide-y divide-[#EFEFEA]">
        {analytics.issues.slice(0, limit).map((issue) => (
          <li key={issue.projectId + issue.detail + issue.updatedAt} className="py-2.5 flex items-start justify-between gap-3">
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

  const ctx: AdminCtx = { busy, open, who, members, pending, change, promote, analytics, requests, limits, activeKeys, totalVideoReady, voice, setTab, filter, setFilter, data, importLegacy, importMessage, issuesList, projectOwner, showProjects };

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
            {t.badge ? <span className="ml-2 rounded-full bg-[#8B1E2D] text-white text-xs px-1.5 py-0.5">{t.badge}</span> : null}
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

      {tab === 'overview' && <OverviewTab ctx={ctx} />}

      {tab === 'messages' && <MessagesSection members={members} onUnread={setUnreadMessages} />}

      {tab === 'teachers' && <TeachersTab ctx={ctx} />}

      {tab === 'usage' && <UsageTab ctx={ctx} />}

      {tab === 'projects' && <ProjectsTab ctx={ctx} />}

      {tab === 'settings' && <StudioSettingsCard />}
      {!analytics && !error && busy && (
        <p className="text-sm text-[#787670] flex items-center gap-2"><ArrowClockwise size={16} className="animate-spin" /> Yönetim bilgileri yükleniyor…</p>
      )}
    </section>
  );
};
