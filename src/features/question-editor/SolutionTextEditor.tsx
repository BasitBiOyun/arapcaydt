import React from 'react';
import { 
  TextAlignLeft, 
  Clock, 
  TextT, 
  Translate, 
  Sparkle,
  ArrowCounterClockwise 
} from '@phosphor-icons/react';

interface SolutionTextEditorProps {
  solutionText: string;
  onChange: (val: string) => void;
  arabicSnippet?: string;
  onArabicSnippetChange?: (val: string) => void;
}

export const SolutionTextEditor: React.FC<SolutionTextEditorProps> = ({
  solutionText,
  onChange,
  arabicSnippet,
  onArabicSnippetChange,
}) => {
  const wordCount = solutionText.trim().length > 0 ? solutionText.trim().split(/\s+/).length : 0;
  // Academic pedagogical speaking pace: ~125 words per minute
  const estimatedSeconds = Math.max(1, Math.round((wordCount / 125) * 60));

  const insertText = (snippet: string) => {
    onChange((solutionText ? solutionText + '\n' : '') + snippet);
  };

  const loadTemplate = () => {
    onChange(`Değerli öğrenciler, bu sorumuzda ... konusu sorgulanmaktadır.

Cümle incelendiğinde; ...

Şıkları değerlendirelim:
A şıkkı: ... (Elenir)
B şıkkı: ... (Doğru Cevap)
C şıkkı: ... (Elenir)
D şıkkı: ... (Elenir)
E şıkkı: ... (Elenir)

Dolayısıyla doğru seçeneğimiz ... olacaktır.`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5">
          <TextAlignLeft size={15} weight="bold" className="text-[#8B1E2D]" />
          <span>Soru Çözüm & Açıklama Metni (Seslendirilecek)</span>
        </label>
        <div className="flex items-center gap-3 text-[11px] font-mono-code text-[#6E6D68]">
          <span title="Kelime Sayısı">{wordCount} kelime</span>
          <span>•</span>
          <span className="flex items-center gap-1" title="Tahmini Seslendirme Süresi">
            <Clock size={12} />
            <span>~{estimatedSeconds} sn</span>
          </span>
        </div>
      </div>

      {/* Quick Academic Tool Chips */}
      <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-[#ECEBE4] overflow-x-auto text-[11px]">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[#787670] text-[10px] uppercase font-semibold">Hızlı Ekle:</span>
          <button
            type="button"
            onClick={() => insertText('صلة الموصول (Sıla Cümlesi)')}
            className="px-2 py-0.5 rounded bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#33322E] border border-[#DCDCD4] cursor-pointer"
          >
            صلة الموصول
          </button>
          <button
            type="button"
            onClick={() => insertText('مضاف ومضاف إليه')}
            className="px-2 py-0.5 rounded bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#33322E] border border-[#DCDCD4] cursor-pointer"
          >
            مضاف إليه
          </button>
          <button
            type="button"
            onClick={() => insertText('مذكر / مؤنث uyuşumu')}
            className="px-2 py-0.5 rounded bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#33322E] border border-[#DCDCD4] cursor-pointer"
          >
            Uyuşum Kuralı
          </button>
        </div>
        <button
          type="button"
          onClick={loadTemplate}
          className="text-[11px] text-[#8B1E2D] hover:underline font-medium shrink-0 cursor-pointer"
        >
          Şablon Yükle
        </button>
      </div>

      {/* Main Solution Textarea */}
      <div className="relative">
        <textarea
          value={solutionText}
          onChange={(e) => onChange(e.target.value)}
          rows={7}
          placeholder="Öğretmen seslendirmesi için soru çözümünü buraya yazınız veya yapıştırınız..."
          className="w-full px-3 py-2.5 rounded bg-[#FFFFFF] border border-[#D5D4CC] focus:border-[#8B1E2D] focus:ring-1 focus:ring-[#8B1E2D] text-xs text-[#1C1917] leading-relaxed resize-y outline-none transition-colors"
        />
      </div>

      {/* Optional Arabic Question Snippet for text alignment */}
      {onArabicSnippetChange !== undefined && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-[#575652] flex items-center gap-1">
              <Translate size={13} className="text-[#8B1E2D]" />
              <span>Soru Kökü / Arapça Metin Alıntısı (Opsiyonel)</span>
            </span>
          </div>
          <input
            type="text"
            value={arabicSnippet || ''}
            onChange={(e) => onArabicSnippetChange(e.target.value)}
            placeholder="كَرَّمَتِ الجَامِعَةُ البَاحِثِينَ ......."
            className="w-full px-3 py-1.5 rounded bg-[#FFFFFF] border border-[#DCDCD4] text-xs text-[#1C1917] font-arabic outline-none focus:border-[#8B1E2D]"
          />
        </div>
      )}
    </div>
  );
};
