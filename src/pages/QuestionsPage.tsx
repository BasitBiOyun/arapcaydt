import React, { useState } from 'react';
import { 
  MagnifyingGlass, 
  PlusCircle, 
  Trash, 
  Copy, 
  Waveform, 
  CheckCircle,
  Funnel,
  BookOpenText,
  Clock
} from '@phosphor-icons/react';
import { useProjects } from '../features/projects/ProjectContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { AppPage } from '../components/common/AppSidebar';
import { YdtCategory, ProjectStatus } from '../types';
import { QUESTION_CATEGORIES, getCategoryLabel } from '../config/categories';

interface QuestionsPageProps {
  onNavigate: (page: AppPage) => void;
  onSelectProject: (id: string) => void;
  onNewQuestion: () => void;
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: 'Tüm Kategoriler' },
  ...QUESTION_CATEGORIES.map((c) => ({ key: c.id, label: c.label })),
];

const STATUSES: { key: string; label: string }[] = [
  { key: 'all', label: 'Tüm Durumlar' },
  { key: 'draft', label: 'Taslak' },
  { key: 'audio_generated', label: 'Ses Üretildi' },
  { key: 'audio_approved', label: 'Ses Onaylandı' },
  { key: 'video_ready', label: 'Video Hazır' },
];

export const QuestionsPage: React.FC<QuestionsPageProps> = ({
  onNavigate,
  onSelectProject,
  onNewQuestion,
}) => {
  const { projects, deleteProjectById, createNewProject } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.arabicQuestionSnippet && p.arabicQuestionSnippet.includes(searchTerm)) ||
      p.examYear.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.questionNumber.toString().includes(searchTerm);

    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bu soru projesini silmek istediğinize emin misiniz?')) {
      await deleteProjectById(id);
    }
  };

  const handleDuplicate = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await createNewProject({
      title: `${p.title} (Kopya)`,
      examYear: p.examYear,
      category: p.category,
      correctAnswer: p.correctAnswer,
      imageUrl: p.imageUrl,
      solutionText: p.solutionText,
    });
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#1C1917] tracking-tight">
            Arapça YDT Soru Havuzu
          </h2>
          <p className="text-xs text-[#666560] mt-0.5">
            Kayıtlı soru projelerinizi filtreleyin, düzenleyin veya yeni bir video projesi başlatın.
          </p>
        </div>

        <button
          onClick={onNewQuestion}
          className="px-3.5 py-2 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <PlusCircle size={16} weight="bold" />
          <span>Yeni Soru Ekle</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 rounded bg-[#FFFFFF] border border-[#E5E4DC] space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <MagnifyingGlass
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787670]"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Soru başlığı, yıl veya Arapça metin ile ara..."
              className="w-full pl-9 pr-3 py-1.5 rounded border border-[#D5D4CC] bg-[#FAF9F5] focus:bg-white focus:border-[#8B1E2D] text-xs text-[#1C1917] outline-none"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelectedStatus(s.key)}
                className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer ${
                  selectedStatus === s.key
                    ? 'bg-[#1C1917] text-white font-medium'
                    : 'bg-[#FAF9F5] text-[#55544F] hover:bg-[#EFEFEA]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Chip bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-[#EFEFEA] text-xs">
          <span className="text-[11px] text-[#787670] font-semibold uppercase pr-1 shrink-0">
            Konu:
          </span>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setSelectedCategory(c.key)}
              className={`px-2 py-0.5 rounded text-[11px] whitespace-nowrap border transition-colors cursor-pointer ${
                selectedCategory === c.key
                  ? 'bg-[#F2ECEC] border-[#DFC8CB] text-[#8B1E2D] font-bold'
                  : 'bg-[#FAF9F5] border-[#E5E4DC] text-[#44423D] hover:bg-[#EFEFEA]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Questions List Card */}
      <div className="rounded bg-[#FFFFFF] border border-[#E5E4DC] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center space-y-2 text-xs text-[#787670]">
            <BookOpenText size={28} className="mx-auto text-[#8C8A82]" />
            <div className="font-medium text-[#1C1917]">Aradığınız kriterlere uygun soru bulunamadı.</div>
            <div>Arama terimini değiştirin veya yeni bir soru projesi oluşturun.</div>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5E4DC] bg-[#FAF9F5] text-[11px] font-semibold text-[#666560]">
                <th className="py-2.5 px-4">Proje Başlığı / YDT Soru</th>
                <th className="py-2.5 px-3">Konu</th>
                <th className="py-2.5 px-2 text-center">Doğru Cevap</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3">Ses Süresi</th>
                <th className="py-2.5 px-3">İşaretlemeler</th>
                <th className="py-2.5 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEFEA]">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p.id);
                    onNavigate('editor');
                  }}
                  className="hover:bg-[#FAF9F5] transition-colors group cursor-pointer"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#1C1917] group-hover:text-[#8B1E2D] transition-colors">
                      {p.title}
                    </div>
                    {p.arabicQuestionSnippet ? (
                      <div className="text-[11px] text-[#787670] font-arabic truncate max-w-sm pt-0.5">
                        {p.arabicQuestionSnippet}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#8C8A82] font-mono-code pt-0.5">
                        {p.examYear} • Soru #{p.questionNumber}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F2F1EB] text-[#44423D] border border-[#D5D4CC]">
                      {getCategoryLabel(p.category)}
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
                  <td className="py-3 px-3 text-[#666560] font-mono-code text-[11px]">
                    {p.videoConfig?.annotations?.length || 0} adet
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleDuplicate(p, e)}
                        className="p-1 text-[#6E6D68] hover:text-[#1C1917] hover:bg-[#EFEFEA] rounded transition-colors"
                        title="Projeyi Kopyala"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(p.id, e)}
                        className="p-1 text-[#8C8A82] hover:text-[#8B1E2D] hover:bg-[#FDF2F2] rounded transition-colors"
                        title="Sil"
                      >
                        <Trash size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(p.id);
                          onNavigate('editor');
                        }}
                        className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-[#8B1E2D] hover:text-white border border-[#D5D4CC] text-[#33322E] text-xs font-semibold transition-colors"
                      >
                        Düzenle
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
