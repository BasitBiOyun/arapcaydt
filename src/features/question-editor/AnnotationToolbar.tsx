import React from 'react';
import { 
  Cursor, 
  CheckCircle, 
  XCircle, 
  HighlighterCircle, 
  PencilSimpleLine, 
  ChatText,
  Trash,
  Plus
} from '@phosphor-icons/react';
import { AnnotationType } from '../../types';

interface AnnotationToolbarProps {
  activeTool: AnnotationType | 'select';
  onSelectTool: (tool: AnnotationType | 'select') => void;
  annotationsCount: number;
  onClearAnnotations: () => void;
  onQuickAddMarker: (type: AnnotationType, target?: 'A' | 'B' | 'C' | 'D' | 'E') => void;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  onSelectTool,
  annotationsCount,
  onClearAnnotations,
  onQuickAddMarker,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded border border-[#E2E1D9] bg-[#FAF9F5] text-xs select-none">
      {/* Tool buttons */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase font-semibold text-[#787670] pr-1">Araçlar:</span>

        {/* Pointer / Select */}
        <button
          type="button"
          onClick={() => onSelectTool('select')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition-colors cursor-pointer ${
            activeTool === 'select'
              ? 'bg-[#1C1917] text-white font-medium'
              : 'bg-[#FFFFFF] border border-[#DCDCD4] text-[#44423D] hover:bg-[#F2F1EB]'
          }`}
          title="İşaretçi / Seç"
        >
          <Cursor size={14} weight="bold" />
          <span>Seç</span>
        </button>

        {/* Correct Check Marker */}
        <button
          type="button"
          onClick={() => onSelectTool('check')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition-colors cursor-pointer ${
            activeTool === 'check'
              ? 'bg-[#1E562A] text-white font-medium shadow-xs'
              : 'bg-[#FFFFFF] border border-[#C5DAC8] text-[#1E562A] hover:bg-[#EFF7F0]'
          }`}
          title="Doğru Cevap [ ✓ ] İşareti Koy"
        >
          <CheckCircle size={15} weight="fill" />
          <span>Doğru (✓)</span>
        </button>

        {/* Wrong Cross Marker */}
        <button
          type="button"
          onClick={() => onSelectTool('cross')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition-colors cursor-pointer ${
            activeTool === 'cross'
              ? 'bg-[#8B1E2D] text-white font-medium shadow-xs'
              : 'bg-[#FFFFFF] border border-[#DFC8CB] text-[#8B1E2D] hover:bg-[#FDF2F2]'
          }`}
          title="Yanlış Şık [ ✕ ] Çarpı İşareti Koy"
        >
          <XCircle size={15} weight="fill" />
          <span>Yanlış (✕)</span>
        </button>

        {/* Text Highlighter */}
        <button
          type="button"
          onClick={() => onSelectTool('highlight')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition-colors cursor-pointer ${
            activeTool === 'highlight'
              ? 'bg-[#B48419] text-white font-medium shadow-xs'
              : 'bg-[#FFFFFF] border border-[#E3D4A8] text-[#7A5812] hover:bg-[#FAF5E6]'
          }`}
          title="Metin / Kelime Fosforlu Vurgusu"
        >
          <HighlighterCircle size={15} weight="fill" />
          <span>Vurgu</span>
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => onSelectTool('underline')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition-colors cursor-pointer ${
            activeTool === 'underline'
              ? 'bg-[#1C1917] text-white font-medium shadow-xs'
              : 'bg-[#FFFFFF] border border-[#DCDCD4] text-[#44423D] hover:bg-[#F2F1EB]'
          }`}
          title="Altı Çizili Kural Vurgusu"
        >
          <PencilSimpleLine size={15} weight="bold" />
          <span>Alt Çizgi</span>
        </button>

        {/* Rule Box */}
        <button
          type="button"
          onClick={() => onSelectTool('rule_box')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded transition-colors cursor-pointer ${
            activeTool === 'rule_box'
              ? 'bg-[#374151] text-white font-medium shadow-xs'
              : 'bg-[#FFFFFF] border border-[#DCDCD4] text-[#44423D] hover:bg-[#F2F1EB]'
          }`}
          title="İrab / Gramer Not Kutusu Ekle"
        >
          <ChatText size={15} weight="bold" />
          <span>İrab Notu</span>
        </button>
      </div>

      {/* Right Quick Shortcuts */}
      <div className="flex items-center gap-2">
        {annotationsCount > 0 && (
          <button
            type="button"
            onClick={onClearAnnotations}
            className="p-1 text-[#8C8A82] hover:text-[#8B1E2D] rounded transition-colors cursor-pointer"
            title="Tüm İşaretleri Temizle"
          >
            <Trash size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
