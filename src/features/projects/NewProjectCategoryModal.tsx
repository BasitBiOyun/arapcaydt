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

  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const create=async()=>{setBusy(true);setError('');try{await onCreate(selectedCategory);onClose();}catch(e){setError(e instanceof Error?e.message:'Proje oluşturulamadı.');}finally{setBusy(false);}};

  if (!isOpen) return null;

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'soru-coz':
        return <BookOpen className="w-4 h-4 text-[#8B1E2D]" />;
      case 'cikmis-soru':
        return <GraduationCap className="w-4 h-4 text-[#B45309]" />;
      case 'deneme':
        return <FileText className="w-4 h-4 text-[#2563EB]" />;
      default:
        return <Sparkle className="w-4 h-4 text-[#8B1E2D]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="bg-[#FAF9F5] border border-[#E5E4DC] rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E4DC] flex items-center justify-between bg-white">
          <div>
            <h3 className="text-sm font-bold text-[#1C1917]">Yeni Soru Projesi</h3>
            <p className="text-xs text-[#787670] mt-0.5">Soru kategorisini seçin</p>
          </div>
          <button
            onClick={onClose} disabled={busy} aria-label="Kapat"
            className="p-1 rounded text-[#787670] hover:text-[#1C1917] hover:bg-[#F0EFEA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Cards */}
        <div className="p-5 space-y-2.5 max-h-[68vh] overflow-y-auto">
          {QUESTION_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'border-[#8B1E2D] bg-white ring-1 ring-[#8B1E2D] shadow-xs'
                    : 'border-[#E5E4DC] bg-white/70 hover:bg-white hover:border-[#D5D4CC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-[#8B1E2D]/10' : 'bg-[#FAF9F5] border border-[#E5E4DC]'
                    }`}
                  >
                    {getCategoryIcon(cat.id)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1C1917]">{cat.label}</div>
                    {cat.description && (
                      <div className="text-[11px] text-[#787670] mt-0.5">{cat.description}</div>
                    )}
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'border-[#8B1E2D] bg-[#8B1E2D] text-white'
                      : 'border-[#D5D4CC] bg-white'
                  }`}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        {error&&<p role="alert" className="px-5 pb-3 text-sm text-red-700">{error}</p>}
        {/* Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-[#E5E4DC] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose} disabled={busy} aria-label="Kapat"
            className="px-3.5 py-1.5 rounded text-xs font-semibold text-[#55544F] hover:bg-[#F0EFEA] transition-colors"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={()=>void create()} disabled={busy}
            className="px-4 py-2 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white text-xs font-semibold transition-colors shadow-xs"
          >
            {busy?'Oluşturuluyor…':'Projeyi Başlat'}
          </button>
        </div>
      </div>
    </div>
  );
};
