import React from 'react';
import { 
  PlusCircle, 
  ListDashes, 
  Waveform, 
  CheckCircle, 
  CircleDashed, 
  VideoCamera,
  ArrowRight,
  BookOpenText,
  Calendar
} from '@phosphor-icons/react';
import { useProjects } from '../features/projects/ProjectContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { AppPage } from '../components/common/AppSidebar';

interface DashboardPageProps {
  onNavigate: (page: AppPage) => void;
  onSelectProject: (id: string) => void;
  onNewQuestion: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onSelectProject,
  onNewQuestion,
}) => {
  const { projects } = useProjects();

  const totalCount = projects.length;
  const approvedCount = projects.filter((p) => p.status === 'audio_approved').length;
  const readyCount = projects.filter((p) => p.status === 'video_ready').length;
  const draftCount = projects.filter((p) => p.status === 'draft').length;
  const audioGenCount = projects.filter((p) => p.status === 'audio_generated').length;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Banner / Quick Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded bg-[#FFFFFF] border border-[#E5E4DC]">
        <div>
          <h2 className="text-base font-bold text-[#1C1917] tracking-tight">
            Arapça YDT Soru & Video Çalışma Alanı
          </h2>
          <p className="text-xs text-[#666560] mt-0.5">
            ÖSYM Arapça Yabancı Dil Testi soru incelemeleri ve ElevenLabs seslendirme projelerinizi yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigate('questions')}
            className="px-3 py-2 rounded border border-[#D5D4CC] bg-[#FAF9F5] hover:bg-[#F2F1EB] text-xs font-semibold text-[#33322E] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ListDashes size={15} />
            <span>Tüm Sorular ({totalCount})</span>
          </button>

          <button
            onClick={onNewQuestion}
            className="px-3.5 py-2 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle size={16} weight="bold" />
            <span>Yeni Soru Ekle</span>
          </button>
        </div>
      </div>

      {/* Academic Compact Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded bg-[#FFFFFF] border border-[#E5E4DC] space-y-1">
          <div className="flex items-center justify-between text-[#666560]">
            <span className="text-xs font-medium">Toplam Soru Projesi</span>
            <BookOpenText size={16} className="text-[#8B1E2D]" />
          </div>
          <div className="text-xl font-bold font-mono-code text-[#1C1917]">
            {totalCount}
          </div>
          <div className="text-[11px] text-[#787670]">Havuzdaki kayıtlı sorular</div>
        </div>

        <div className="p-3.5 rounded bg-[#FFFFFF] border border-[#E5E4DC] space-y-1">
          <div className="flex items-center justify-between text-[#666560]">
            <span className="text-xs font-medium">Seslendirme Onaylı</span>
            <CheckCircle size={16} weight="fill" className="text-[#1E562A]" />
          </div>
          <div className="text-xl font-bold font-mono-code text-[#1E562A]">
            {approvedCount + readyCount}
          </div>
          <div className="text-[11px] text-[#787670]">Video montajına hazır</div>
        </div>

        <div className="p-3.5 rounded bg-[#FFFFFF] border border-[#E5E4DC] space-y-1">
          <div className="flex items-center justify-between text-[#666560]">
            <span className="text-xs font-medium">Ses İnceleme Bekleyen</span>
            <Waveform size={16} className="text-[#B48419]" />
          </div>
          <div className="text-xl font-bold font-mono-code text-[#B48419]">
            {audioGenCount}
          </div>
          <div className="text-[11px] text-[#787670]">Onay bekleyen ses kayıtları</div>
        </div>

        <div className="p-3.5 rounded bg-[#FFFFFF] border border-[#E5E4DC] space-y-1">
          <div className="flex items-center justify-between text-[#666560]">
            <span className="text-xs font-medium">Taslak Sorular</span>
            <CircleDashed size={16} className="text-[#73726C]" />
          </div>
          <div className="text-xl font-bold font-mono-code text-[#55544F]">
            {draftCount}
          </div>
          <div className="text-[11px] text-[#787670]">Çözüm metni hazırlanıyor</div>
        </div>
      </div>

      {/* Recent Projects Table Section */}
      <div className="rounded bg-[#FFFFFF] border border-[#E5E4DC] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E4DC] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
              Son Çalışılan Soru Projeleri
            </h3>
            <span className="text-[11px] text-[#787670] font-mono-code">
              ({projects.slice(0, 5).length} / {totalCount})
            </span>
          </div>

          <button
            onClick={() => onNavigate('questions')}
            className="text-xs font-semibold text-[#8B1E2D] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Tümünü Gör</span>
            <ArrowRight size={13} weight="bold" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5E4DC] bg-[#FAF9F5] text-[11px] font-semibold text-[#666560]">
                <th className="py-2.5 px-4">Soru / Sınav</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-2 text-center">Doğru Şık</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3">Seslendirme</th>
                <th className="py-2.5 px-3">Güncelleme</th>
                <th className="py-2.5 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEFEA]">
              {projects.slice(0, 6).map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-[#FAF9F5] transition-colors group cursor-pointer"
                  onClick={() => {
                    onSelectProject(p.id);
                    onNavigate('editor');
                  }}
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#1C1917] group-hover:text-[#8B1E2D] transition-colors">
                      {p.title}
                    </div>
                    {p.arabicQuestionSnippet && (
                      <div className="text-[11px] text-[#787670] font-arabic truncate max-w-sm">
                        {p.arabicQuestionSnippet}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-code uppercase bg-[#F2F1EB] text-[#44423D] border border-[#D5D4CC]">
                      {p.category}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="w-5 h-5 rounded-full bg-[#8B1E2D]/10 text-[#8B1E2D] font-bold font-mono-code inline-flex items-center justify-center text-[11px]">
                      {p.correctAnswer}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-3 px-3 text-[#666560]">
                    {p.audioNarration ? (
                      <div className="flex items-center gap-1 text-[11px] font-mono-code">
                        <Waveform size={12} className="text-[#8B1E2D]" />
                        <span>{p.audioNarration.duration} sn</span>
                      </div>
                    ) : (
                      <span className="text-[#8C8A82] text-[11px]">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[#787670] text-[11px] font-mono-code">
                    {formatDate(p.updatedAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(p.id);
                        onNavigate('editor');
                      }}
                      className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-[#8B1E2D] hover:text-white border border-[#D5D4CC] text-[#33322E] text-xs font-medium transition-colors cursor-pointer"
                    >
                      Editörde Aç
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
