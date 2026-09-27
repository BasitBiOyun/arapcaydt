import React from 'react';
import { ArrowRight, BookOpenText, CheckCircle, CircleDashed, FilmStrip, Plus, Waveform } from '@phosphor-icons/react';
import { useProjects } from '../features/projects/ProjectContext';
import { useAuth } from '../features/auth/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { AppPage } from '../components/common/AppSidebar';
import { getCategoryLabel } from '../config/categories';

interface DashboardPageProps {
  onNavigate: (page: AppPage) => void;
  onSelectProject: (id: string) => void;
  onNewQuestion: () => void;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
};
const formatDuration = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onSelectProject, onNewQuestion }) => {
  const { projects } = useProjects();
  const { user } = useAuth();

  const stats = [
    { label: 'Toplam soru', value: projects.length, icon: BookOpenText, tone: 'text-[#1C1917]', iconTone: 'text-[#8B1E2D]' },
    { label: 'Video hazır', value: projects.filter(p => p.status === 'video_ready' || p.videoReady).length, icon: FilmStrip, tone: 'text-[#8B1E2D]', iconTone: 'text-[#8B1E2D]' },
    { label: 'Ses onaylı', value: projects.filter(p => p.status === 'audio_approved').length, icon: CheckCircle, tone: 'text-[#1E562A]', iconTone: 'text-[#1E562A]' },
    { label: 'Taslak', value: projects.filter(p => p.status === 'draft').length, icon: CircleDashed, tone: 'text-[#55544F]', iconTone: 'text-[#787670]' },
  ];
  const recent = projects.slice(0, 6);
  const firstName = (user?.name || '').trim();

  return (
    <section className="studio-library">
      <header className="library-heading">
        <div>
          <h2>{firstName ? `Merhaba, ${firstName}` : 'Merhaba'}</h2>
          <p>Kaldığınız yerden devam edin ya da yeni bir soru ekleyin.</p>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <h3 className="text-lg font-bold">İlk sorunuzu ekleyin</h3>
          <p className="text-sm text-[#666560] mt-2">Bir soru görseliyle başlayın; metin, ses ve işaretleri adım adım tamamlayın.</p>
          <button className="studio-primary mt-5" onClick={onNewQuestion}><Plus size={18} /> Yeni soru</button>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="resume-project">
            <div>
              <h3>Kaldığınız yerden devam edin</h3>
              <p>{projects[0].title}</p>
              <span>{projects[0].examName || projects[0].examYear}</span>
            </div>
            <button className="studio-primary" onClick={() => onSelectProject(projects[0].id)}>Çalışmaya devam et <ArrowRight size={18} /></button>
          </section>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map(s => (
              <div key={s.label} className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between text-sm text-[#666560]">
                  <span>{s.label}</span>
                  <s.icon size={18} weight="bold" className={s.iconTone} />
                </div>
                <div className={`mt-2 text-3xl font-bold tabular-nums tracking-tight ${s.tone}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold">Son çalıştığınız sorular</h3>
              <button onClick={() => onNavigate('questions')} className="text-sm font-semibold text-[#8B1E2D] hover:underline flex items-center gap-1">
                Tüm sorular <ArrowRight size={14} weight="bold" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-[#FAF9F5] text-xs font-semibold text-[#666560]">
                    <th className="py-2.5 px-5">Soru</th>
                    <th className="py-2.5 px-3">Tür</th>
                    <th className="py-2.5 px-3 text-center">Cevap</th>
                    <th className="py-2.5 px-3">Durum</th>
                    <th className="py-2.5 px-3">Ses</th>
                    <th className="py-2.5 px-3">Güncelleme</th>
                    <th className="py-2.5 px-5" aria-label="İşlem" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEFEA]">
                  {recent.map(p => (
                    <tr key={p.id} className="hover:bg-[#FAF9F5] transition-colors group cursor-pointer" onClick={() => onSelectProject(p.id)}>
                      <td className="py-3 px-5">
                        <div className="font-semibold group-hover:text-[#8B1E2D] transition-colors">{p.title}</div>
                        {p.arabicQuestionSnippet && <div className="text-xs text-[#787670] font-arabic truncate max-w-sm">{p.arabicQuestionSnippet}</div>}
                      </td>
                      <td className="py-3 px-3 text-[#55544F]">{getCategoryLabel(p.category)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="w-6 h-6 rounded-full bg-[#8B1E2D]/10 text-[#8B1E2D] font-bold inline-flex items-center justify-center text-xs">{p.correctAnswer}</span>
                      </td>
                      <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                      <td className="py-3 px-3 text-[#666560] tabular-nums">
                        {p.narrationSource?.duration || p.audioNarration?.duration
                          ? <span className="inline-flex items-center gap-1.5"><Waveform size={14} className="text-[#8B1E2D]" />{formatDuration(p.narrationSource?.duration || p.audioNarration?.duration || 0)}</span>
                          : <span className="text-[#A8A69E]">—</span>}
                      </td>
                      <td className="py-3 px-3 text-[#787670] whitespace-nowrap">{formatDate(p.updatedAt)}</td>
                      <td className="py-3 px-5 text-right">
                        <button onClick={e => { e.stopPropagation(); onSelectProject(p.id); }}
                          className="px-3 py-1.5 rounded-lg border bg-white hover:bg-[#8B1E2D] hover:text-white hover:border-[#8B1E2D] text-xs font-semibold transition-colors">
                          Aç
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
