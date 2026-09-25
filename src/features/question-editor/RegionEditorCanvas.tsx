import React, { useRef, useState } from 'react';
import {moveRegion} from './workflow';
import { AnnotationRegion, RegionType, VideoAction, VideoActionType } from '../../types';

interface Props {
  imageUrl: string;
  regions: AnnotationRegion[];
  selectedRegionId: string | null;
  onSelectRegion: (id: string | null) => void;
  onUpdateRegions: (regions: AnnotationRegion[]) => void;
  solutionText?: string;
  currentTime?: number;
  audioDuration?: number;
  actions?: VideoAction[];
  onUpdateActions?: (actions: VideoAction[]) => void;
  onUndo?:()=>void;
  canUndo?:boolean;
}
const types: { type: RegionType; label: string }[] = [
  ...['a', 'b', 'c', 'd', 'e'].map(l => ({ type: `option-${l}` as RegionType, label: `${l.toUpperCase()} Şıkkı` })),
  { type: 'keyword', label: 'Kelime / İfade' }, { type: 'paragraph', label: 'Soru Metni' },
];
const field = 'border rounded px-2 py-1 bg-white text-xs';
const button = 'border rounded px-3 py-2 bg-white hover:bg-stone-100 text-xs cursor-pointer';

export function RegionEditorCanvas({
  imageUrl,
  regions = [],
  selectedRegionId,
  onSelectRegion,
  onUpdateRegions,
  solutionText = '',
  currentTime = 0,
  audioDuration = 15,
  actions = [],
  onUpdateActions,
  onUndo,
  canUndo,
}: Props) {
  const [undo,setUndo]=useState<AnnotationRegion[][]>([]);
  const commit=(next:AnnotationRegion[])=>{setUndo(history=>[...history.slice(-29),regions]);onUpdateRegions(next);};
  const stage = useRef<HTMLDivElement>(null);
  const script = useRef<HTMLTextAreaElement>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [drawing, setDrawing] = useState(false);
  const [newType, setNewType] = useState<RegionType>('keyword');
  const [phrase, setPhrase] = useState('');
  const [gesture, setGesture] = useState<{ mode: 'draw' | 'move' | 'resize'; x: number; y: number; region?: AnnotationRegion } | null>(null);
  const [draft, setDraft] = useState<AnnotationRegion | null>(null);
  const selected = regions.find(r => r.id === selectedRegionId);
  const selectedActions = selected ? actions.filter(a => a.targetRegionId === selected.id) : [];
  const actionLabel: Record<VideoActionType,string> = {
    reject:'Ele',
    correct:'Doğru',
    focus:'Odaklan',
    highlight:'Vurgula',
    underline:'Altını çiz',
    'dim-others':'Diğerlerini karart',
    reset:'Sıfırla',
  };
  const toggleAction = (type: VideoActionType) => {
    if (!selected || !onUpdateActions) return;
    const existing = actions.find(a => a.targetRegionId === selected.id && a.type === type);
    if (existing) {
      onUpdateActions(actions.filter(a => a.id !== existing.id));
      return;
    }
    const conflicting = type === 'correct' ? 'reject' : type === 'reject' ? 'correct' : null;
    const related = selectedActions.find(a => !conflicting || a.type !== conflicting) || selectedActions[0];
    const start = Math.max(0, Math.min(audioDuration, related?.start ?? currentTime));
    const duration = Math.max(0.5, related?.duration ?? (type === 'underline' ? 1.4 : 1.8));
    const next: VideoAction = {
      id: `manual-${selected.id}-${type}-${Date.now()}`,
      type,
      targetRegionId: selected.id,
      start,
      duration,
      label: `${actionLabel[type]} - ${selected.label || selected.content || 'Bölge'}`,
    };
    onUpdateActions([
      ...actions.filter(a => !(conflicting && a.targetRegionId === selected.id && a.type === conflicting)),
      next,
    ].sort((a,b)=>a.start-b.start));
  };
  const hasAction = (type:VideoActionType) => selectedActions.some(a => a.type === type);
  const beginQuickDraw = (type:RegionType) => {
    setNewType(type);
    setDrawing(true);
    setGesture(null);
    setDraft(null);
  };
  const removeSelected = () => {
    if (!selected) return;
    commit(regions.filter(r => r.id !== selected.id));
    onSelectRegion(null);
  };
  const pos = (e: React.PointerEvent) => {
    const rect = stage.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
  };
  const begin = (e: React.PointerEvent, mode: 'draw' | 'move' | 'resize', region?: AnnotationRegion) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    stage.current!.setPointerCapture(e.pointerId);
    setGesture({ mode, ...pos(e), region });
    setDraft(region || null);
    if (region) onSelectRegion(region.id);
    stage.current?.focus();
  };
  const move = (e: React.PointerEvent) => {
    if (!gesture) return;
    const p = pos(e), r = gesture.region;
    if (gesture.mode === 'draw') {
      setDraft({ id: 'draft', label: '', type: newType, x: Math.min(p.x, gesture.x), y: Math.min(p.y, gesture.y), width: Math.abs(p.x - gesture.x), height: Math.abs(p.y - gesture.y) });
    } else if (r) {
      const dx = p.x - gesture.x, dy = p.y - gesture.y;
      setDraft(gesture.mode === 'move' ? { ...r, x: Math.max(0, Math.min(1-r.width,r.x+dx)), y: Math.max(0,Math.min(1-r.height,r.y+dy)) }
        : { ...r, width: Math.max(.008,Math.min(1-r.x,r.width+dx)), height: Math.max(.008,Math.min(1-r.y,r.height+dy)) });
    }
  };
  const finish = (e: React.PointerEvent) => {
    if (gesture && draft && draft.width > .008 && draft.height > .008) {
      if (gesture.mode === 'draw') {
        const id = newType.startsWith('option-') ? newType : `manual-${crypto.randomUUID()}`;
        const region = { ...draft, id, type: newType, label: types.find(t => t.type === newType)?.label || 'İfade', content: phrase.trim(), manuallyAdjusted: true };
        commit([...regions.filter(r => r.id !== id && !(newType.startsWith('option-') && r.type === newType)), region]);
        onSelectRegion(id);
        setDrawing(false);
      } else commit(regions.map(r => r.id === draft.id ? { ...draft, manuallyAdjusted: true } : r));
    }
    if (stage.current?.hasPointerCapture(e.pointerId)) stage.current.releasePointerCapture(e.pointerId);
    setGesture(null); setDraft(null);
  };
  const update = (patch: Partial<AnnotationRegion>) => {
    if (!selected) return;
    const updated = { ...selected, ...patch, manuallyAdjusted: true };
    if (patch.type) {
      updated.id = patch.type.startsWith('option-') ? patch.type : `manual-${crypto.randomUUID()}`;
      updated.label = types.find(t => t.type === patch.type)?.label || selected.label;
    }
    commit([...regions.filter(r => r.id !== selected.id && r.id !== updated.id), updated]);
    onSelectRegion(updated.id);
  };
  return <div className="space-y-3 mt-3 text-xs">
    <div className="rounded-xl border border-[#E5E4DC] bg-[#FAF9F5] p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-[#1C1917]">Görsel düzenleyici</p>
          <p className="text-[11px] text-[#787670] mt-0.5">Bir aracı seçin, sonra görsel üzerinde sürükleyerek alanı belirleyin. Mevcut kutular doğrudan taşınabilir ve boyutlandırılabilir.</p>
        </div>
        <button type="button" className={button} disabled={onUndo?!canUndo:!undo.length} onClick={()=>{if(onUndo){onUndo();return;}const previous=undo[undo.length-1];if(previous){onUpdateRegions(previous);setUndo(undo.slice(0,-1));}}}>↶ Geri al</button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-[#8C8A82] mr-1">Şık kutusu</span>
        {(['A','B','C','D','E'] as const).map(letter => {
          const type=`option-${letter.toLowerCase()}` as RegionType;
          const active=drawing && newType===type;
          return <button key={letter} type="button" aria-pressed={active} onClick={()=>beginQuickDraw(type)}
            className={`h-8 min-w-8 px-2 rounded border font-bold transition-all ${active?'bg-[#8B1E2D] border-[#8B1E2D] text-white shadow-sm':'bg-white border-[#D5D4CC] text-[#1C1917] hover:border-[#8B1E2D] hover:text-[#8B1E2D]'}`}>
            {letter}
          </button>;
        })}
        <button type="button" aria-pressed={drawing && newType==='paragraph'} onClick={()=>beginQuickDraw('paragraph')}
          className={`${button} ${drawing && newType==='paragraph'?'border-[#8B1E2D] text-[#8B1E2D] bg-[#F8EEEE]':''}`}>Soru metni</button>
        {drawing&&<button type="button" className={button} onClick={()=>{setDrawing(false);setGesture(null);setDraft(null);}}>Çizimi iptal et</button>}
      </div>

      {drawing&&<div role="status" className="rounded-lg border border-[#E7D5B2] bg-[#FFF9E8] px-3 py-2 text-[11px] text-[#6F5316]">
        {types.find(t=>t.type===newType)?.label || 'Alan'} için görselde basılı tutup sürükleyin.
      </div>}
    </div>

    {solutionText && <details className="rounded-xl border border-[#E5E4DC] bg-white p-3">
      <summary className="cursor-pointer font-semibold text-[#1C1917]">Kelime veya ifadeyi elle işaretle</summary>
      <p className="text-[11px] text-[#787670] mt-2">Çözüm metninde istediğiniz kelimeyi seçin. Ardından butona basıp görselde o kelimenin alanını çizin. Sistem mümkünse zamanı ses kaydından eşleştirir.</p>
      <textarea aria-label="Vurgu için çözüm metni" ref={script} readOnly value={solutionText} dir="auto" rows={5} className="select-text w-full border rounded-lg p-2 mt-2 leading-relaxed" />
      <div className="flex flex-wrap gap-2 mt-2 items-center">
        <button className={button} type="button" onClick={() => {
          const el = script.current!;
          const text = el.value.slice(el.selectionStart, el.selectionEnd).trim();
          if (text) { setPhrase(text); beginQuickDraw('keyword'); }
        }}>Seçili ifadeyi görselde işaretle</button>
        {phrase&&<span className="max-w-full truncate rounded bg-[#F4F3ED] px-2 py-1 text-[11px]" dir="auto">Seçili: {phrase}</span>}
      </div>
    </details>}

    {!solutionText&&<label className="flex flex-col gap-1">Sesle eşleştirilecek ifade
      <input aria-label="Sesle eşleştirilecek ifade" dir="auto" className={field} value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="Örneğin: مُمَيِّزَاتٌ" />
    </label>}
    <div ref={stage} role="group" tabIndex={0} aria-label="Bölge çizim alanı" onKeyDown={e=>{
      if(e.key==='Escape'){setDrawing(false);setGesture(null);setDraft(null);return;}
      if(selected && (e.key==='Delete'||e.key==='Backspace') && e.target===stage.current){e.preventDefault();removeSelected();return;}
      if(!selected || !["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
      e.preventDefault();const delta=e.shiftKey?.005:.001;
      commit(regions.map(r=>r.id===selected.id?moveRegion(r,e.key==="ArrowRight"?delta:e.key==="ArrowLeft"?-delta:0,e.key==="ArrowDown"?delta:e.key==="ArrowUp"?-delta:0):r));
    }} style={{ aspectRatio: aspect, touchAction: 'none' }}
      className={`relative w-full border rounded bg-white select-none ${drawing ? 'cursor-crosshair' : ''}`}
      onPointerDown={e => { if (drawing) begin(e, 'draw'); }} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={() => { setGesture(null); setDraft(null); }}>
      <img src={imageUrl} alt="Soru üzerinde düzenlenebilir alanlar" draggable={false} className="w-full h-full pointer-events-none"
        onLoad={e => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
      {regions.map(region => {
        const r = gesture?.region?.id === region.id && draft ? draft : region;
        return <div key={r.id} style={{ left: `${r.x*100}%`, top: `${r.y*100}%`, width: `${r.width*100}%`, height: `${r.height*100}%`, pointerEvents: drawing ? 'none' : 'auto', zIndex: r.id === selectedRegionId ? 20 : 1 }}
          className={`absolute border-2 cursor-move ${r.id === selectedRegionId ? 'border-red-700 bg-red-800/10' : 'border-amber-600 bg-amber-300/10'}`}
          onPointerDown={e => begin(e, 'move', r)}>
          <span className="absolute -top-4 left-0 text-[10px] bg-white text-stone-900 whitespace-nowrap">{r.label}</span>
          {r.id === selectedRegionId && <div aria-label="Kutuyu boyutlandır" className="absolute -bottom-2 -right-2 w-4 h-4 bg-red-800 cursor-nwse-resize" onPointerDown={e => begin(e,'resize',r)} />}
        </div>;
      })}
      {gesture?.mode === 'draw' && draft && <div className="absolute pointer-events-none border-2 border-red-700 bg-yellow-200/30" style={{ left:`${draft.x*100}%`, top:`${draft.y*100}%`, width:`${draft.width*100}%`, height:`${draft.height*100}%` }} />}
    </div>
    {selected ? <div className="rounded-xl border border-[#DCC9CB] bg-[#FCF7F7] p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[#1C1917]">Seçili alan: {selected.label}</p>
          <p className="text-[11px] text-[#787670] truncate max-w-xl" dir="auto">{selected.content || 'Bu alan için eşleşen metin tanımlı değil.'}</p>
        </div>
        <button className={`${button} text-red-800`} type="button" onClick={removeSelected}>Sil</button>
      </div>

      {onUpdateActions&&<div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-[#8C8A82] mr-1">Animasyon</span>
          {(selected.type.startsWith('option-')
            ? (['focus','reject','correct'] as VideoActionType[])
            : (['underline','highlight','focus'] as VideoActionType[])
          ).map(type=><button key={type} type="button" aria-pressed={hasAction(type)} onClick={()=>toggleAction(type)}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all ${hasAction(type)?'bg-[#8B1E2D] border-[#8B1E2D] text-white shadow-sm':'bg-white border-[#D5D4CC] text-[#44423D] hover:border-[#8B1E2D] hover:text-[#8B1E2D]'}`}>
            {actionLabel[type]}{hasAction(type)?' ✓':''}
          </button>)}
        </div>
        <p className="text-[10px] text-[#787670]">Yeni işaret, varsa bu alanın mevcut ses zamanını kullanır. Yoksa önizlemedeki {currentTime.toFixed(1)}. saniyeye eklenir. Zamanı daha sonra “Zamanlamayı düzelt” bölümünden ince ayarlayabilirsiniz.</p>
      </div>}

      <details>
        <summary className="cursor-pointer font-semibold text-[11px] text-[#55544F]">İnce ayar ve koordinatlar</summary>
        <div className="flex flex-wrap gap-2 items-end mt-3">
          <label className="flex flex-col gap-1">Alan türü
            <select aria-label="Seçili kutunun türü" value={selected.type} className={field} onChange={e => update({ type:e.target.value as RegionType })}>
              {!types.some(t => t.type === selected.type) && <option value={selected.type}>{selected.type}</option>}
              {types.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-52 flex-1">Eşleşen metin
            <input aria-label="Kutunun eşleşen metni" dir="auto" className={field} value={selected.content || ''} onChange={e => update({content:e.target.value})} />
          </label>
          {(['x','y','width','height'] as const).map((key,i) => <label className="flex flex-col gap-1" key={key}>{['Sol %','Üst %','Genişlik %','Yükseklik %'][i]}
            <input aria-label={['Sol yüzde','Üst yüzde','Genişlik yüzde','Yükseklik yüzde'][i]} className={`${field} w-20`} type="number" min={key === 'width' || key === 'height' ? .8 : 0} max="100" step="0.1" value={Number((selected[key]*100).toFixed(1))}
              onChange={e => {
                const value = Number(e.target.value)/100;
                if (!Number.isFinite(value) || e.target.value === '') return;
                const max = key === 'x' ? 1-selected.width : key === 'y' ? 1-selected.height : key === 'width' ? 1-selected.x : 1-selected.y;
                update({[key]:Math.max(key === 'width' || key === 'height' ? .008 : 0,Math.min(max,value))});
              }} /></label>)}
        </div>
      </details>
    </div> : <div className="rounded-lg border border-dashed border-[#D5D4CC] bg-[#FAF9F5] px-3 py-2 text-[11px] text-[#787670]">
      Düzenlemek için görselde bir kutuya tıklayın. Ok tuşlarıyla ince, Shift + ok ile daha büyük hareket yapabilirsiniz.
    </div>}

    <details className="rounded-lg border border-[#E5E4DC] bg-white p-3">
      <summary className="cursor-pointer font-semibold text-[11px]">Tüm alanlar ({regions.length})</summary>
      <label className="flex flex-col gap-1 mt-2">Düzenlenecek alan
        <select aria-label="Düzenlenecek kutu" value={selectedRegionId || ''} className={field} onChange={e => onSelectRegion(e.target.value || null)}>
          <option value="">Alan seçin</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.label} {r.content?.slice(0,60)}</option>)}
        </select>
      </label>
    </details>
  </div>;
}
