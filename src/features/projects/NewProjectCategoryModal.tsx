import React, { useState } from 'react';
import { Sparkle, X, Check, BookOpen, GraduationCap, FileText } from 'lucide-react';
import { QUESTION_CATEGORIES, DEFAULT_CATEGORY_ID } from '../../config/categories';

interface NewProjectCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (categoryId: string) => void | Promise<void>;
}

export const NewProjectCategoryModal: React.FC<NewProjectCategoryModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(DEFAULT_CATEGORY_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await onCreate(selectedCategory);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proje oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const getCategoryIcon = (id: string) => {
    if (id === 'soru-coz') return <BookOpen className="w-[18px] h-[18px]" />;
    if (id === 'cikmis-soru') return <GraduationCap className="w-[18px] h-[18px]" />;
    if (id === 'deneme') return <FileText className="w-[18px] h-[18px]" />;
    if (id.startsWith('dkab-')) return <FileText className="w-[18px] h-[18px]" />;
    return <Sparkle className="w-[18px] h-[18px]" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="bg-[#FAF9F5] border border-[#E5E4DC] rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-[#E5E4DC] flex items-center justify-between bg-white">
          <div>
            <h3 className="text-sm font-bold text-[#1C1917]">Yeni Soru Projesi</h3>
            <p className="text-xs text-[#787670] mt-0.5">Çalışmanız için en uygun soru tipini seçin</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg text-[#787670] hover:text-[#1C1917] hover:bg-[#F0EFEA] transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 max-h-[72vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {QUESTION_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  aria-pressed={isSelected}
                  className={`group w-full min-h-[106px] text-left p-4 rounded-xl border transition-all flex items-start justify-between gap-4 cursor-pointer ${
                    isSelected
                      ? 'border-[#8B1E2D] bg-white ring-1 ring-[#8B1E2D] shadow-sm'
                      : 'border-[#E5E4DC] bg-white/80 hover:bg-white hover:border-[#C9C7BF] hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#8B1E2D]/10 text-[#8B1E2D]'
                          : 'bg-[#FAF9F5] border border-[#E5E4DC] text-[#6F6D67] group-hover:text-[#8B1E2D]'
                      }`}
                    >
                      {getCategoryIcon(cat.id)}
                    </div>

                    <div className="min-w-0 pt-0.5">
                      <div className="text-[13px] font-bold text-[#1C1917] leading-snug">
                        {cat.label}
                      </div>
                      {cat.description && (
                        <div className="text-[11.5px] text-[#787670] mt-1.5 leading-[1.45]">
                          {cat.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'border-[#8B1E2D] bg-[#8B1E2D] text-white'
                        : 'border-[#D5D4CC] bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="px-5 sm:px-6 py-4 bg-white border-t border-[#E5E4DC] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#55544F] hover:bg-[#F0EFEA] transition-colors"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[#8B1E2D] hover:bg-[#721824] disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            {busy ? 'Oluşturuluyor…' : 'Projeyi Başlat'}
          </button>
        </div>
      </div>
    </div>
  );
};
