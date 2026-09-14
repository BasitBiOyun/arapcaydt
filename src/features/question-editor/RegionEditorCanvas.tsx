import React, { useState, useRef, useEffect } from 'react';
import { AnnotationRegion, RegionType } from '../../types';
import { 
  Plus, 
  Trash, 
  ArrowsOutCardinal, 
  Check, 
  Sparkle, 
  Cursor,
  Tag
} from '@phosphor-icons/react';

interface RegionEditorCanvasProps {
  imageUrl: string;
  regions: AnnotationRegion[];
  selectedRegionId: string | null;
  onSelectRegion: (id: string | null) => void;
  onUpdateRegions: (regions: AnnotationRegion[]) => void;
}

const REGION_TYPE_OPTIONS: { type: RegionType; label: string; color: string }[] = [
  { type: 'question', label: 'Soru Kökü', color: '#1E40AF' },
  { type: 'paragraph', label: 'Paragraf Metni', color: '#374151' },
  { type: 'keyword', label: 'Anahtar Kelime', color: '#D97706' },
  { type: 'option-a', label: 'A Şıkkı', color: '#8B1E2D' },
  { type: 'option-b', label: 'B Şıkkı', color: '#8B1E2D' },
  { type: 'option-c', label: 'C Şıkkı', color: '#8B1E2D' },
  { type: 'option-d', label: 'D Şıkkı', color: '#8B1E2D' },
  { type: 'option-e', label: 'E Şıkkı', color: '#8B1E2D' },
  { type: 'custom', label: 'Özel Bölge', color: '#4B5563' },
];

export const RegionEditorCanvas: React.FC<RegionEditorCanvasProps> = ({
  imageUrl,
  regions = [],
  selectedRegionId,
  onSelectRegion,
  onUpdateRegions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Dragging / Resizing states
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragInitialRegion, setDragInitialRegion] = useState<AnnotationRegion | null>(null);

  const selectedRegion = regions.find((r) => r.id === selectedRegionId);

  // Get normalized [0..1] coordinates from mouse event
  const getNormalizedPos = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // only left click
    const target = e.target as HTMLElement;

    // Check if clicked directly on background
    if (target === containerRef.current || target.classList.contains('region-bg-layer')) {
      const pos = getNormalizedPos(e);
      setIsDrawing(true);
      setDrawStart(pos);
      setDrawCurrent(pos);
      onSelectRegion(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pos = getNormalizedPos(e);

    if (isDrawing && drawStart) {
      setDrawCurrent(pos);
    } else if (dragMode === 'move' && dragStartPos && dragInitialRegion) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;

      const newX = Math.max(0, Math.min(1 - dragInitialRegion.width, dragInitialRegion.x + dx));
      const newY = Math.max(0, Math.min(1 - dragInitialRegion.height, dragInitialRegion.y + dy));

      const updated = regions.map((r) =>
        r.id === dragInitialRegion.id ? { ...r, x: newX, y: newY } : r
      );
      onUpdateRegions(updated);
    } else if (dragMode === 'resize' && dragStartPos && dragInitialRegion) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;

      const newW = Math.max(0.04, Math.min(1 - dragInitialRegion.x, dragInitialRegion.width + dx));
      const newH = Math.max(0.03, Math.min(1 - dragInitialRegion.y, dragInitialRegion.height + dy));

      const updated = regions.map((r) =>
        r.id === dragInitialRegion.id ? { ...r, width: newW, height: newH } : r
      );
      onUpdateRegions(updated);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.abs(drawCurrent.x - drawStart.x);
      const height = Math.abs(drawCurrent.y - drawStart.y);

      // Minimum box size
      if (width > 0.03 && height > 0.02) {
        // Automatically determine next option letter if not present
        const hasA = regions.some((r) => r.type === 'option-a');
        const hasB = regions.some((r) => r.type === 'option-b');
        const hasC = regions.some((r) => r.type === 'option-c');
        const hasD = regions.some((r) => r.type === 'option-d');
        const hasE = regions.some((r) => r.type === 'option-e');

        let nextType: RegionType = 'question';
        let nextLabel = 'Soru Metni';

        if (!hasA) {
          nextType = 'option-a';
          nextLabel = 'A Şıkkı';
        } else if (!hasB) {
          nextType = 'option-b';
          nextLabel = 'B Şıkkı';
        } else if (!hasC) {
          nextType = 'option-c';
          nextLabel = 'C Şıkkı';
        } else if (!hasD) {
          nextType = 'option-d';
          nextLabel = 'D Şıkkı';
        } else if (!hasE) {
          nextType = 'option-e';
          nextLabel = 'E Şıkkı';
        } else {
          nextType = 'keyword';
          nextLabel = `Bölge #${regions.length + 1}`;
        }

        const newRegion: AnnotationRegion = {
          id: `reg_${Date.now()}`,
          label: nextLabel,
          type: nextType,
          x: parseFloat(x.toFixed(4)),
          y: parseFloat(y.toFixed(4)),
          width: parseFloat(width.toFixed(4)),
          height: parseFloat(height.toFixed(4)),
        };

        onUpdateRegions([...regions, newRegion]);
        onSelectRegion(newRegion.id);
      }
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
    setDragMode(null);
    setDragStartPos(null);
    setDragInitialRegion(null);
  };

  const handleStartMove = (e: React.MouseEvent, region: AnnotationRegion) => {
    e.stopPropagation();
    onSelectRegion(region.id);
    setDragMode('move');
    setDragStartPos(getNormalizedPos(e));
    setDragInitialRegion(region);
  };

  const handleStartResize = (e: React.MouseEvent, region: AnnotationRegion) => {
    e.stopPropagation();
    onSelectRegion(region.id);
    setDragMode('resize');
    setDragStartPos(getNormalizedPos(e));
    setDragInitialRegion(region);
  };

  const handleDeleteRegion = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = regions.filter((r) => r.id !== id);
    onUpdateRegions(updated);
    if (selectedRegionId === id) {
      onSelectRegion(null);
    }
  };

  const handleAutoPopulateOptions = () => {
    const newOptions: AnnotationRegion[] = [
      { id: `reg_${Date.now()}_q`, label: 'Soru Kökü', type: 'question', x: 0.08, y: 0.12, width: 0.84, height: 0.28 },
      { id: `reg_${Date.now()}_a`, label: 'A Şıkkı', type: 'option-a', x: 0.1, y: 0.44, width: 0.8, height: 0.08 },
      { id: `reg_${Date.now()}_b`, label: 'B Şıkkı', type: 'option-b', x: 0.1, y: 0.54, width: 0.8, height: 0.08 },
      { id: `reg_${Date.now()}_c`, label: 'C Şıkkı', type: 'option-c', x: 0.1, y: 0.64, width: 0.8, height: 0.08 },
      { id: `reg_${Date.now()}_d`, label: 'D Şıkkı', type: 'option-d', x: 0.1, y: 0.74, width: 0.8, height: 0.08 },
      { id: `reg_${Date.now()}_e`, label: 'E Şıkkı', type: 'option-e', x: 0.1, y: 0.84, width: 0.8, height: 0.08 },
    ];
    onUpdateRegions([...regions, ...newOptions]);
    onSelectRegion(newOptions[0].id);
  };

  return (
    <div className="space-y-3 select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-white border border-[#E5E4DC] text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-[#1C1917]">
            <Cursor size={15} weight="bold" className="text-[#8B1E2D]" />
            <span>Görsel Üzerinde Alan Çizin veya Seçin</span>
          </div>
          <span className="text-[11px] text-[#787670]">
            (Soru görseline fare ile tıklayıp sürükleyerek alan belirleyin)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {regions.length === 0 && (
            <button
              type="button"
              onClick={handleAutoPopulateOptions}
              className="px-2.5 py-1 rounded border border-[#DFC8CB] bg-[#FDF2F2] hover:bg-[#F8E2E4] text-[#8B1E2D] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkle size={13} weight="bold" />
              <span>Standart Şık Alanlarını Ekle (A-E)</span>
            </button>
          )}

          {regions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Tüm tanımlı alanları temizlemek istiyor musunuz?')) {
                  onUpdateRegions([]);
                  onSelectRegion(null);
                }
              }}
              className="px-2 py-1 rounded text-[#787670] hover:text-[#8B1E2D] hover:bg-[#F2F1EB] cursor-pointer"
            >
              Temizle ({regions.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Stage Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="relative w-full aspect-video bg-[#F4F3EE] rounded border border-[#D5D4CC] overflow-hidden cursor-crosshair flex items-center justify-center region-bg-layer"
      >
        {/* Background Question Image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="YDT Soru Sayfası"
            draggable={false}
            className="max-w-full max-h-full object-contain pointer-events-none shadow-sm"
          />
        ) : (
          <div className="text-center text-xs text-[#787670] p-6 pointer-events-none">
            Soru görseli yüklenmedi
          </div>
        )}

        {/* Existing Defined Regions */}
        {regions.map((reg) => {
          const isSelected = reg.id === selectedRegionId;
          const opt = REGION_TYPE_OPTIONS.find((o) => o.type === reg.type);
          const color = opt?.color || '#8B1E2D';

          return (
            <div
              key={reg.id}
              onMouseDown={(e) => handleStartMove(e, reg)}
              style={{
                left: `${reg.x * 100}%`,
                top: `${reg.y * 100}%`,
                width: `${reg.width * 100}%`,
                height: `${reg.height * 100}%`,
                borderColor: color,
              }}
              className={`absolute border-2 rounded transition-shadow cursor-move ${
                isSelected
                  ? 'ring-2 ring-[#8B1E2D] ring-offset-1 shadow-md bg-[#8B1E2D]/10'
                  : 'border-dashed bg-black/5 hover:bg-black/10'
              }`}
            >
              {/* Region Label Badge */}
              <div
                style={{ backgroundColor: color }}
                className="absolute -top-5 left-0 px-1.5 py-0.5 rounded-t text-[10px] font-bold text-white whitespace-nowrap shadow-xs flex items-center gap-1"
              >
                <span>{reg.label}</span>
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRegion(reg.id, e)}
                    className="hover:text-red-200 ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Bottom-right Resize Handle */}
              {isSelected && (
                <div
                  onMouseDown={(e) => handleStartResize(e, reg)}
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded bg-[#8B1E2D] border border-white cursor-nwse-resize shadow-xs"
                />
              )}
            </div>
          );
        })}

        {/* Dynamic Drawing Box */}
        {isDrawing && drawStart && drawCurrent && (
          <div
            style={{
              left: `${Math.min(drawStart.x, drawCurrent.x) * 100}%`,
              top: `${Math.min(drawStart.y, drawCurrent.y) * 100}%`,
              width: `${Math.abs(drawCurrent.x - drawStart.x) * 100}%`,
              height: `${Math.abs(drawCurrent.y - drawStart.y) * 100}%`,
            }}
            className="absolute border-2 border-[#8B1E2D] border-dashed bg-[#8B1E2D]/15 rounded pointer-events-none"
          />
        )}
      </div>

      {/* Selected Region Quick Inspector Panel */}
      {selectedRegion && (
        <div className="p-3 rounded bg-white border border-[#E5E4DC] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="space-y-0.5">
              <label className="text-[10px] text-[#666560] font-semibold uppercase">
                Bölge Başlığı:
              </label>
              <input
                type="text"
                value={selectedRegion.label}
                onChange={(e) => {
                  const updated = regions.map((r) =>
                    r.id === selectedRegion.id ? { ...r, label: e.target.value } : r
                  );
                  onUpdateRegions(updated);
                }}
                className="px-2 py-1 rounded border border-[#D5D4CC] bg-[#FAF9F5] text-xs font-semibold text-[#1C1917] outline-none"
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-[10px] text-[#666560] font-semibold uppercase">
                Bölge Türü:
              </label>
              <select
                value={selectedRegion.type}
                onChange={(e) => {
                  const newType = e.target.value as RegionType;
                  const opt = REGION_TYPE_OPTIONS.find((o) => o.type === newType);
                  const updated = regions.map((r) =>
                    r.id === selectedRegion.id
                      ? { ...r, type: newType, label: opt?.label || r.label }
                      : r
                  );
                  onUpdateRegions(updated);
                }}
                className="px-2 py-1 rounded border border-[#D5D4CC] bg-[#FAF9F5] text-xs font-medium text-[#1C1917] outline-none"
              >
                {REGION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDeleteRegion(selectedRegion.id)}
              className="px-3 py-1.5 rounded border border-[#F8D7DA] bg-[#FDF2F2] hover:bg-[#F8E2E4] text-xs font-semibold text-[#8B1E2D] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash size={14} />
              <span>Bölgeyi Sil</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectRegion(null)}
              className="px-3 py-1.5 rounded bg-[#FAF9F5] hover:bg-[#EFEFEA] border border-[#D5D4CC] text-xs font-medium text-[#33322E] cursor-pointer"
            >
              Seçimi Bırak
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
