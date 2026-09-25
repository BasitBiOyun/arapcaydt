import {shiftAction} from '../question-editor/workflow';
import React, { useState } from 'react';
import { 
  VideoAction, 
  VideoActionType, 
  AnnotationRegion, 
  NarrationWord, 
  AudioNarration 
} from '../../types';
import { generateAutomaticTimeline } from './engine/timeline';
import { 
  Clock, 
  Play, 
  Pause, 
  Plus, 
  Trash, 
  Sparkle, 
  Waveform, 
  X, 
  Check, 
  HighlighterCircle, 
  PencilSimpleLine, 
  Crosshair, 
  Sliders,
  EyeSlash,
  ArrowCounterClockwise
} from '@phosphor-icons/react';

interface EditableTimelineUIProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  actions: VideoAction[];
  regions: AnnotationRegion[];
  onUpdateActions: (actions: VideoAction[]) => void;
  solutionText?: string;
  audioNarration?: AudioNarration;
  correctAnswer?: 'A' | 'B' | 'C' | 'D' | 'E';
  onRequestAutoGenerate?: () => void;
}

const ACTION_TYPES: { type: VideoActionType; label: string; icon: any; color: string }[] = [
  { type: 'reject', label: 'Şık Eleme (X)', icon: X, color: '#8B1E2D' },
  { type: 'correct', label: 'Doğru Cevap (✓)', icon: Check, color: '#15803D' },
  { type: 'focus', label: 'Bölgeye Odaklan', icon: Crosshair, color: '#4338CA' },
  { type: 'highlight', label: 'Vurgula (Highlighter)', icon: HighlighterCircle, color: '#D97706' },
  { type: 'underline', label: 'Altını Çiz (RTL)', icon: PencilSimpleLine, color: '#0369A1' },
  { type: 'dim-others', label: 'Diğerlerini Karart', icon: EyeSlash, color: '#4B5563' },
  { type: 'reset', label: 'Sıfırla', icon: ArrowCounterClockwise, color: '#6B7280' },
];

export const EditableTimelineUI: React.FC<EditableTimelineUIProps> = ({
  duration = 15,
  currentTime,
  isPlaying,
  onPlayPause,
  onSeek,
  actions = [],
  regions = [],
  onUpdateActions,
  solutionText = '',
  audioNarration,
  correctAnswer = 'C',
  onRequestAutoGenerate,
}) => {
  const [undo,setUndo]=useState<VideoAction[][]>([]);
  const commit=(next:VideoAction[])=>{setUndo(h=>[...h.slice(-29),actions]);onUpdateActions(next);};
  const effectiveDuration = Math.max(2, duration);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showDebugTools, setShowDebugTools] = useState(false);

  // New action form fields
  const [newType, setNewType] = useState<VideoActionType>('reject');
  const [newTargetId, setNewTargetId] = useState<string>(regions[0]?.id || '');
  const [newStart, setNewStart] = useState<number>(parseFloat(currentTime.toFixed(1)));
  const [newDuration, setNewDuration] = useState<number>(2.5);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(parseFloat((ratio * effectiveDuration).toFixed(1)));
  };

  const handleCreateAction = () => {
    if (!newTargetId && newType !== 'reset') {
      alert('Lütfen eylemin uygulanacağı bir soru bölgesi seçiniz.');
      return;
    }

    const reg = regions.find((r) => r.id === newTargetId);
    const actionLabel = `${newType.toUpperCase()} - ${reg?.label || 'Bölge'}`;

    const newAct: VideoAction = {
      id: `act_${Date.now()}`,
      start: Math.max(0, Math.min(effectiveDuration, newStart)),
      duration: Math.max(0.5, newDuration),
      targetRegionId: newTargetId,
      type: newType,
      label: actionLabel,
    };

    const updated = [...actions, newAct].sort((a, b) => a.start - b.start);
    commit(updated);
    setIsAdding(false);
    setSelectedActionId(newAct.id);
  };

  const handleDeleteAction = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = actions.filter((a) => a.id !== id);
    commit(updated);
    if (selectedActionId === id) setSelectedActionId(null);
  };

  const handleAutoGenerate = () => {
    if (onRequestAutoGenerate) {
      onRequestAutoGenerate();
      return;
    }

    if (regions.length === 0) {
      alert('Otomatik zaman çizelgesi oluşturabilmek için lütfen "Videoyu Otomatik Oluştur" butonunu kullanınız.');
      return;
    }

    const words = audioNarration?.words || (audioNarration?.wordAlignments as any) || [];
    const generated = generateAutomaticTimeline(
      solutionText,
      words,
      regions,
      correctAnswer,
      effectiveDuration
    );

    if (generated.length === 0) {
      return;
    }

    commit(generated);
  };

  // Keep ruler labels tied to real seconds even on long narrations.
  const tickStep =
    effectiveDuration <= 20 ? 1 :
    effectiveDuration <= 60 ? 5 :
    effectiveDuration <= 180 ? 10 :
    effectiveDuration <= 360 ? 30 : 60;
  const ticks = Array.from(
    { length: Math.floor(effectiveDuration / tickStep) + 1 },
    (_, i) => i * tickStep
  );
  if (ticks[ticks.length - 1] < effectiveDuration) ticks.push(effectiveDuration);
  const formatRulerTime = (seconds:number) => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return mins ? `${mins}:${secs.toString().padStart(2,'0')}` : `${secs}s`;
  };

  return (
    <div className="p-3.5 rounded bg-white border border-[#E5E4DC] space-y-3 select-none">
      <div className="space-y-3">
        <label className="block text-sm font-semibold">Düzenlenecek işaret<select className="block w-full border rounded-lg p-2 mt-2" value={selectedActionId||''} onChange={e=>{setSelectedActionId(e.target.value);const action=actions.find(a=>a.id===e.target.value);if(action)onSeek(action.start);}}><option value="">Bir kelime veya şık seçin</option>{actions.map(a=><option key={a.id} value={a.id}>{a.start.toFixed(1)} sn · {regions.find(r=>r.id===a.targetRegionId)?.content || regions.find(r=>r.id===a.targetRegionId)?.label} · {ACTION_TYPES.find(t=>t.type===a.type)?.label}</option>)}</select></label>
        <div className="flex flex-wrap gap-2">{[-.2,.2].map(delta=><button className="studio-secondary" key={delta} disabled={!selectedActionId} onClick={()=>{commit(actions.map(a=>a.id===selectedActionId?shiftAction(a,delta,effectiveDuration):a));const a=actions.find(a=>a.id===selectedActionId);if(a)onSeek(shiftAction(a,delta,effectiveDuration).start);}}>{delta<0?'0,2 sn erken':'0,2 sn geç'}</button>)}
          <button className="studio-secondary" disabled={!selectedActionId} onClick={()=>{const a=actions.find(a=>a.id===selectedActionId);if(a){onSeek(Math.max(0,a.start-.5));if(!isPlaying)onPlayPause();}}}>Bu anı dinle</button>
          <button className="studio-secondary" disabled={!undo.length} onClick={()=>{if(undo.length){onUpdateActions(undo[undo.length-1]);setUndo(undo.slice(0,-1));}}}>Geri al</button>
        </div>
      </div>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#EFEFEA]">
        <div className="flex items-center gap-2">
          <Clock size={16} weight="bold" className="text-[#8B1E2D]" />
          <h3 className="font-bold text-xs text-[#1C1917]">
            İşaretlerin zamanlaması
          </h3>
          <span className="text-[11px] font-mono-code text-[#787670]">
            ({actions.length} Otomatik Eylem)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary Automatic Action Button */}
          <button
            type="button"
            onClick={handleAutoGenerate}
            className="px-3 py-1.5 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Mevcut ses ve görsel üzerinden işaretleri yeniden hazırlar"
          >
            <Sparkle size={14} weight="fill" />
            <span>Videoyu Otomatik Senkronize Et</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDebugTools(!showDebugTools)}
            className="px-2 py-1 text-[11px] text-[#787670] hover:text-[#1C1917] rounded hover:bg-[#FAF9F5] border border-transparent hover:border-[#E5E4DC] cursor-pointer"
            title="Gelişmiş manuel inceleme araçları"
          >
            {showDebugTools ? 'Ayarları Gizle' : 'İnce Ayar'}
          </button>
        </div>
      </div>

      {/* Main Interactive Timeline Ruler & Track Area */}
      <div
        onClick={handleTimelineClick}
        className="relative w-full bg-[#FAF9F5] border border-[#E5E4DC] rounded p-2.5 cursor-pointer overflow-hidden"
      >
        <div
          className="absolute left-0 top-0 h-1 bg-[#8B1E2D]/25 pointer-events-none"
          style={{ width: `${Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))}%` }}
        />

        {/* Playhead Scrubber Line */}
        <div
          style={{
            left: `${(currentTime / effectiveDuration) * 100}%`,
          }}
          className="absolute top-0 bottom-0 w-0.5 bg-[#8B1E2D] z-30 pointer-events-none transition-all duration-75"
        >
          <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-[#8B1E2D] shadow-xs border border-white" />
        </div>

        {/* 1. Time Ruler Ticks */}
        <div className="relative h-6 border-b border-[#E5E4DC] text-[9px] font-mono-code text-[#8C8A82]">
          {ticks.map((t, index) => {
            const left = Math.min(100, (t / effectiveDuration) * 100);
            const edgeClass = index === 0 ? 'translate-x-0' : index === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2';
            return (
              <div key={`${t}-${index}`} className={`absolute bottom-0 flex flex-col items-center ${edgeClass}`} style={{ left: `${left}%` }}>
                <span className="h-1.5 w-px bg-[#D5D4CC]" />
                <span className="whitespace-nowrap">{formatRulerTime(t)}</span>
              </div>
            );
          })}
        </div>

        {/* 2. Track A: ElevenLabs Narration Audio Track */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-[10px] font-medium text-[#787670] pb-1">
            <div className="flex items-center gap-1">
              <Waveform size={13} className="text-[#8B1E2D]" />
              <span>ElevenLabs Seslendirme Dalgası & Kelime Hizalaması:</span>
            </div>
            {audioNarration && (
              <span className="font-mono-code text-[10px] text-[#8B1E2D] font-bold">
                {audioNarration.voiceName} ({audioNarration.duration}s)
              </span>
            )}
          </div>

          <div className="h-7 w-full bg-[#F5EFEF] border border-[#DFC8CB] rounded flex items-center px-2 relative overflow-hidden">
            {/* Waveform bars simulation */}
            <div className="flex items-center gap-0.5 w-full h-full opacity-60">
              {Array.from({ length: 70 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: `${25 + (Math.sin(i * 0.45) * 35 + 35)}%`,
                  }}
                  className="flex-1 bg-[#8B1E2D] rounded-full"
                />
              ))}
            </div>

            {/* Word Alignment markers */}
            {audioNarration?.words && (
              <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden">
                {audioNarration.words.slice(0, 10).map((w, idx) => (
                  <span
                    key={idx}
                    style={{
                      left: `${(w.start / effectiveDuration) * 100}%`,
                      position: 'absolute',
                    }}
                    className="text-[9px] font-mono-code text-[#1C1917] bg-white/80 px-1 py-0.5 rounded shadow-xs"
                  >
                    {w.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Track B: Visual Action Cues Track */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-[10px] font-medium text-[#787670] pb-1">
            <span>Görsel Animasyon Eylemleri:</span>
            <span className="text-[10px] font-mono-code text-[#787670]">
              Mevcut An: <strong className="text-[#8B1E2D]">{currentTime.toFixed(1)}s</strong>
            </span>
          </div>

          <div className="h-9 w-full bg-[#FFFFFF] border border-[#E5E4DC] rounded relative flex items-center px-1">
            {actions.length === 0 ? (
              <span className="text-[10px] text-[#8C8A82] italic px-2">
                Henüz zaman çizelgesi eylemi eklenmedi. "Zaman Çizelgesini Otomatik Üret" butonuna basarak oluşturabilirsiniz.
              </span>
            ) : (
              actions.map((act) => {
                const leftPercent = (act.start / effectiveDuration) * 100;
                const widthPercent = Math.max(6, (act.duration / effectiveDuration) * 100);
                const reg = regions.find((r) => r.id === act.targetRegionId);
                const isSelected = act.id === selectedActionId;

                const actInfo = ACTION_TYPES.find((a) => a.type === act.type);
                const Icon = actInfo?.icon || Sparkle;

                return (
                  <div
                    key={act.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedActionId(act.id);
                      onSeek(act.start);
                    }}
                    style={{
                      left: `${Math.min(94, leftPercent)}%`,
                      width: `${Math.min(28, widthPercent)}%`,
                    }}
                    className={`absolute h-7 rounded px-1.5 flex items-center gap-1 text-[10px] font-semibold truncate z-10 border transition-all cursor-pointer shadow-xs ${
                      isSelected ? 'ring-2 ring-[#8B1E2D] scale-105 z-20' : ''
                    } ${
                      act.type === 'reject'
                        ? 'bg-[#FDF2F2] border-[#DFC8CB] text-[#8B1E2D]'
                        : act.type === 'correct'
                        ? 'bg-[#EFF7F0] border-[#C5DAC8] text-[#15803D]'
                        : act.type === 'highlight'
                        ? 'bg-[#FAF5E6] border-[#E3D4A8] text-[#B45309]'
                        : act.type === 'underline'
                        ? 'bg-[#F0F9FF] border-[#BAE6FD] text-[#0369A1]'
                        : 'bg-[#F5F3FF] border-[#DDD6FE] text-[#4338CA]'
                    }`}
                    title={`${act.type}: ${reg?.label || act.targetRegionId} (${act.start}s)`}
                  >
                    <Icon size={12} weight="bold" className="shrink-0" />
                    <span className="truncate">
                      {reg?.label || act.label || act.type}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Collapsed Debug & Manual Fine-tuning Panel (Hidden by default, optional) */}
      {showDebugTools && (
        <div className="p-3 rounded bg-[#FAF9F5] border border-[#E5E4DC] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1C1917]">Hata Ayıklama & Manuel Ayarlar</span>
            <button
              type="button"
              onClick={() => {
                setNewStart(parseFloat(currentTime.toFixed(1)));
                setNewTargetId(regions[0]?.id || '');
                setIsAdding(!isAdding);
              }}
              className="px-2 py-1 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} weight="bold" />
              <span>Manuel Eylem Ekle</span>
            </button>
          </div>

          {/* Inline Action Creator Form */}
          {isAdding && (
            <div className="p-3 rounded bg-white border border-[#DFC8CB] space-y-2.5 text-xs">
              <div className="flex items-center justify-between font-bold text-[#1C1917] pb-1 border-b border-[#EFEFEA]">
                <span>Yeni Animasyon Eylemi Tanımla</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-[#787670] hover:text-[#1C1917] cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] text-[#666560] font-semibold block mb-0.5">
                    Eylem Türü:
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as VideoActionType)}
                    className="w-full px-2 py-1 rounded bg-white border border-[#D5D4CC] text-xs font-semibold text-[#1C1917] outline-none"
                  >
                    {ACTION_TYPES.map((at) => (
                      <option key={at.type} value={at.type}>
                        {at.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#666560] font-semibold block mb-0.5">
                    Hedef Soru Bölgesi:
                  </label>
                  <select
                    value={newTargetId}
                    onChange={(e) => setNewTargetId(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-white border border-[#D5D4CC] text-xs font-semibold text-[#1C1917] outline-none"
                  >
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} ({r.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#666560] font-semibold block mb-0.5">
                    Başlangıç Saniyesi:
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={effectiveDuration}
                    value={newStart}
                    onChange={(e) => setNewStart(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-white border border-[#D5D4CC] text-xs font-mono-code"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#666560] font-semibold block mb-0.5">
                    Süre (sn):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="30"
                    value={newDuration}
                    onChange={(e) => setNewDuration(parseFloat(e.target.value) || 2.5)}
                    className="w-full px-2 py-1 rounded bg-white border border-[#D5D4CC] text-xs font-mono-code"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1 rounded border border-[#D5D4CC] bg-white text-xs text-[#55544F] cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleCreateAction}
                  className="px-3.5 py-1 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus size={13} weight="bold" />
                  <span>Eylemi Kaydet</span>
                </button>
              </div>
            </div>
          )}

          {/* Actions Table / List Details */}
          {actions.length > 0 && (
            <div className="border border-[#E5E4DC] rounded overflow-hidden bg-white">
              <div className="max-h-36 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E4DC] bg-[#FAF9F5] text-[10px] font-semibold text-[#666560]">
                      <th className="py-1.5 px-3">Zaman</th>
                      <th className="py-1.5 px-3">Eylem</th>
                      <th className="py-1.5 px-3">Hedef Bölge</th>
                      <th className="py-1.5 px-3">Süre</th>
                      <th className="py-1.5 px-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEFEA]">
                    {actions.map((act) => {
                      const reg = regions.find((r) => r.id === act.targetRegionId);
                      const isSelected = act.id === selectedActionId;

                      return (
                        <tr
                          key={act.id}
                          onClick={() => {
                            setSelectedActionId(act.id);
                            onSeek(act.start);
                          }}
                          className={`hover:bg-[#FAF9F5] cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#FDF2F2]' : ''
                          }`}
                        >
                          <td className="py-1.5 px-3 font-mono-code font-bold text-[#8B1E2D]">
                            {act.start.toFixed(1)}s
                          </td>
                          <td className="py-1.5 px-3">
                            <span className="font-semibold text-[#1C1917]">
                              {ACTION_TYPES.find(t=>t.type===act.type)?.label || act.type}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-[#55544F]">
                            {reg?.label || act.targetRegionId}
                          </td>
                          <td className="py-1.5 px-3 font-mono-code text-[#787670]">
                            {act.duration}s
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteAction(act.id, e)}
                              className="p-1 text-[#8C8A82] hover:text-[#8B1E2D] hover:bg-white rounded cursor-pointer transition-colors"
                              title="Eylemi Sil"
                            >
                              <Trash size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
