import React, { useState, useRef } from 'react';
import { 
  VideoAnnotation, 
  AnnotationType, 
  VideoConfig 
} from '../../types';
import { 
  Check, 
  X, 
  HighlighterCircle, 
  DeviceMobile, 
  Desktop, 
  Eye, 
  EyeSlash,
  Trash,
  Sparkle
} from '@phosphor-icons/react';

interface VideoWorkspacePreviewProps {
  imageUrl: string;
  annotations: VideoAnnotation[];
  currentTime: number;
  isPlaying: boolean;
  videoConfig: VideoConfig;
  onUpdateAnnotations: (annotations: VideoAnnotation[]) => void;
  activeTool: AnnotationType | 'select';
  onSelectAnnotation?: (id: string | null) => void;
  teacherTag?: string;
}

export const VideoWorkspacePreview: React.FC<VideoWorkspacePreviewProps> = ({
  imageUrl,
  annotations,
  currentTime,
  isPlaying,
  videoConfig,
  onUpdateAnnotations,
  activeTool,
  teacherTag,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>(videoConfig.aspectRatio || '16:9');
  const [showAllInEditMode, setShowAllInEditMode] = useState(true);

  // Handle clicking on the question stage to place an annotation
  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select' || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    let newAnnotation: VideoAnnotation;

    switch (activeTool) {
      case 'check':
        newAnnotation = {
          id: `ann_chk_${Date.now()}`,
          type: 'check',
          x: Math.round(clickX),
          y: Math.round(clickY),
          startTime: Math.max(0, parseFloat(currentTime.toFixed(1))),
          duration: 10,
          color: '#16A34A',
          label: 'Doğru Cevap',
        };
        break;
      case 'cross':
        newAnnotation = {
          id: `ann_crs_${Date.now()}`,
          type: 'cross',
          x: Math.round(clickX),
          y: Math.round(clickY),
          startTime: Math.max(0, parseFloat(currentTime.toFixed(1))),
          duration: 8,
          color: '#DC2626',
          label: 'Yanlış Şık',
        };
        break;
      case 'highlight':
        newAnnotation = {
          id: `ann_hl_${Date.now()}`,
          type: 'highlight',
          x: Math.max(2, Math.round(clickX - 10)),
          y: Math.max(2, Math.round(clickY - 3)),
          width: 20,
          height: 6,
          startTime: Math.max(0, parseFloat(currentTime.toFixed(1))),
          duration: 12,
          color: '#FDE047',
          label: 'Kilit İfade',
        };
        break;
      case 'underline':
        newAnnotation = {
          id: `ann_ul_${Date.now()}`,
          type: 'underline',
          x: Math.max(2, Math.round(clickX - 10)),
          y: Math.round(clickY),
          width: 20,
          height: 2,
          startTime: Math.max(0, parseFloat(currentTime.toFixed(1))),
          duration: 10,
          color: '#8B1E2D',
          label: 'Alt Çizgi Kuralı',
        };
        break;
      case 'rule_box':
        newAnnotation = {
          id: `ann_rule_${Date.now()}`,
          type: 'rule_box',
          x: Math.min(65, Math.round(clickX)),
          y: Math.min(75, Math.round(clickY)),
          width: 30,
          height: 14,
          startTime: Math.max(0, parseFloat(currentTime.toFixed(1))),
          duration: 15,
          color: '#1E293B',
          text: 'قاعدة نحوية: إعراب صلة الموصول',
          label: 'İrab & Kural Notu',
        };
        break;
    }

    onUpdateAnnotations([...annotations, newAnnotation]);
    setSelectedAnnotationId(newAnnotation.id);
  };

  const removeAnnotation = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onUpdateAnnotations(annotations.filter((a) => a.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  };

  // Determine if annotation is currently active according to timeline playhead
  const isAnnotationVisible = (ann: VideoAnnotation) => {
    // If playing, strictly follow narration timestamp window
    if (isPlaying) {
      return currentTime >= ann.startTime && currentTime <= (ann.startTime + ann.duration);
    }
    // When paused, honor the edit toggle
    if (showAllInEditMode) return true;
    return currentTime >= ann.startTime && currentTime <= (ann.startTime + ann.duration);
  };

  return (
    <div className="space-y-2">
      {/* Workspace Header & Aspect Ratio controls */}
      <div className="flex items-center justify-between text-xs pb-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1C1917]">Video Önizleme & Animasyon Alanı</span>
          <span className="text-[11px] font-mono-code text-[#787670]">
            ({aspectRatio === '16:9' ? '1920x1080 Yatay' : '1080x1920 Dikey'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Show All Toggle */}
          <button
            type="button"
            onClick={() => setShowAllInEditMode(!showAllInEditMode)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#FAF9F5] border border-[#DCDCD4] text-[#55544F] hover:bg-[#EFEFEA] cursor-pointer"
            title="Tüm işaretleri düzenleme modunda göster / gizle"
          >
            {showAllInEditMode ? <Eye size={13} /> : <EyeSlash size={13} />}
            <span>{showAllInEditMode ? 'Tüm İşaretler Açık' : 'Zamana Göre Filtrele'}</span>
          </button>

          {/* Aspect Ratio switcher */}
          <div className="flex items-center rounded border border-[#DCDCD4] bg-[#FAF9F5] p-0.5">
            <button
              type="button"
              onClick={() => setAspectRatio('16:9')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-code transition-colors cursor-pointer ${
                aspectRatio === '16:9' ? 'bg-[#FFFFFF] text-[#8B1E2D] font-bold shadow-xs' : 'text-[#666560]'
              }`}
              title="16:9 YouTube / Akıllı Tahta"
            >
              <Desktop size={13} />
              <span>16:9</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('9:16')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-code transition-colors cursor-pointer ${
                aspectRatio === '9:16' ? 'bg-[#FFFFFF] text-[#8B1E2D] font-bold shadow-xs' : 'text-[#666560]'
              }`}
              title="9:16 Shorts / Reels / TikTok"
            >
              <DeviceMobile size={13} />
              <span>9:16</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Video Stage Frame */}
      <div className="w-full bg-[#1A1918] rounded border border-[#D5D4CC] flex items-center justify-center p-3 relative overflow-hidden shadow-inner min-h-[460px]">
        {/* Aspect Ratio Container */}
        <div
          ref={containerRef}
          onClick={handleStageClick}
          style={{
            aspectRatio: aspectRatio === '16:9' ? '16 / 9' : '9 / 16',
            maxHeight: '520px',
          }}
          className={`relative w-full h-full bg-white rounded overflow-hidden shadow-md flex items-center justify-center select-none ${
            activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        >
          {/* Question Image Background */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="YDT Soru Görseli"
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <div className="text-center p-6 text-xs text-[#787670]">
              Lütfen sağ panelden bir soru görseli yükleyin.
            </div>
          )}

          {/* Teacher Watermark / Channel Header overlay */}
          <div className="absolute top-2 left-2.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white text-[10px] font-medium tracking-wide flex items-center gap-1 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B1E2D]"></span>
            <span>{teacherTag || 'Arapça YDT Soru Çözümü'}</span>
          </div>

          {/* Timecode overlay in video preview */}
          <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded bg-black/70 text-white font-mono-code text-[10px] pointer-events-none">
            {currentTime.toFixed(1)}s
          </div>

          {/* OVERLAY ANNOTATIONS LAYER */}
          {annotations.map((ann) => {
            const isVisible = isAnnotationVisible(ann);
            if (!isVisible) return null;

            const isSelected = selectedAnnotationId === ann.id;

            return (
              <div
                key={ann.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAnnotationId(ann.id);
                }}
                style={{
                  position: 'absolute',
                  left: `${ann.x}%`,
                  top: `${ann.y}%`,
                  width: ann.width ? `${ann.width}%` : undefined,
                  height: ann.height ? `${ann.height}%` : undefined,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`transition-all duration-150 z-20 ${
                  isSelected ? 'ring-2 ring-[#8B1E2D] ring-offset-1' : ''
                }`}
              >
                {/* 1. Correct Answer Check Marker */}
                {ann.type === 'check' && (
                  <div className="relative group">
                    <div className="w-9 h-9 rounded-full bg-[#16A34A] text-white flex items-center justify-center shadow-lg border-2 border-white animate-bounce-short">
                      <Check size={22} weight="bold" />
                    </div>
                    {ann.label && (
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.2 rounded bg-black/80 text-white text-[9px] font-mono-code">
                        {ann.label}
                      </span>
                    )}
                    {isSelected && (
                      <button
                        onClick={(e) => removeAnnotation(ann.id, e)}
                        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* 2. Wrong Answer Cross Marker */}
                {ann.type === 'cross' && (
                  <div className="relative group">
                    <div className="w-8 h-8 rounded-full bg-[#DC2626] text-white flex items-center justify-center shadow-lg border-2 border-white">
                      <X size={20} weight="bold" />
                    </div>
                    {isSelected && (
                      <button
                        onClick={(e) => removeAnnotation(ann.id, e)}
                        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* 3. Highlighter Annotation */}
                {ann.type === 'highlight' && (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'rgba(254, 240, 138, 0.45)',
                      border: '1.5px solid rgba(234, 179, 8, 0.8)',
                    }}
                    className="rounded relative"
                  >
                    {isSelected && (
                      <button
                        onClick={(e) => removeAnnotation(ann.id, e)}
                        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* 4. Underline Annotation */}
                {ann.type === 'underline' && (
                  <div
                    style={{
                      width: '100%',
                      height: '3px',
                      backgroundColor: '#8B1E2D',
                    }}
                    className="rounded shadow-xs relative"
                  >
                    {isSelected && (
                      <button
                        onClick={(e) => removeAnnotation(ann.id, e)}
                        className="absolute -top-3 -right-2 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* 5. Rule Callout Box */}
                {ann.type === 'rule_box' && (
                  <div className="p-2 rounded bg-[#1C1917]/90 text-white border border-[#44403C] shadow-lg text-[10px] space-y-1 backdrop-blur-xs min-w-[140px]">
                    <div className="font-bold text-[#E5E5DF] flex items-center justify-between pb-0.5 border-b border-stone-600">
                      <span>{ann.label || 'Kural Notu'}</span>
                      {isSelected && (
                        <button
                          onClick={(e) => removeAnnotation(ann.id, e)}
                          className="text-stone-400 hover:text-red-400"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="font-arabic text-right text-[12px] text-amber-200">
                      {ann.text || 'صلة الموصول'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Helper instruction */}
      <div className="flex items-center justify-between text-[11px] text-[#787670] px-1">
        <span>
          {activeTool !== 'select'
            ? `Aktif Araç: "${activeTool}". Soru görseli üzerinde işaret koymak istediğiniz noktaya tıklayınız.`
            : 'İşaretleri seçmek veya silmek için üzerlerine tıklayabilirsiniz.'}
        </span>
        <span>{annotations.length} aktif işaretleme</span>
      </div>
    </div>
  );
};
