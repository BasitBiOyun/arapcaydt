import React, { useRef, useState } from 'react';
import { AnnotationRegion, RegionType } from '../../types';

interface Props {
  imageUrl: string;
  regions: AnnotationRegion[];
  selectedRegionId: string | null;
  onSelectRegion: (id: string | null) => void;
  onUpdateRegions: (regions: AnnotationRegion[]) => void;
  solutionText?: string;
}
const types: { type: RegionType; label: string }[] = [
  ...['a', 'b', 'c', 'd', 'e'].map(l => ({ type: `option-${l}` as RegionType, label: `${l.toUpperCase()} Şıkkı` })),
  { type: 'keyword', label: 'Kelime / İfade' }, { type: 'paragraph', label: 'Soru Metni' },
];
const field = 'border rounded px-2 py-1 bg-white text-xs';
const button = 'border rounded px-3 py-2 bg-white hover:bg-stone-100 text-xs cursor-pointer';

export function RegionEditorCanvas({ imageUrl, regions = [], selectedRegionId, onSelectRegion, onUpdateRegions, solutionText = '' }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const script = useRef<HTMLTextAreaElement>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [drawing, setDrawing] = useState(false);
  const [newType, setNewType] = useState<RegionType>('keyword');
  const [phrase, setPhrase] = useState('');
  const [gesture, setGesture] = useState<{ mode: 'draw' | 'move' | 'resize'; x: number; y: number; region?: AnnotationRegion } | null>(null);
  const [draft, setDraft] = useState<AnnotationRegion | null>(null);
  const selected = regions.find(r => r.id === selectedRegionId);
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
        onUpdateRegions([...regions.filter(r => r.id !== id && !(newType.startsWith('option-') && r.type === newType)), region]);
        onSelectRegion(id);
        setDrawing(false);
      } else onUpdateRegions(regions.map(r => r.id === draft.id ? { ...draft, manuallyAdjusted: true } : r));
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
    onUpdateRegions([...regions.filter(r => r.id !== selected.id && r.id !== updated.id), updated]);
    onSelectRegion(updated.id);
  };
  return <div className="space-y-3 mt-3 text-xs">
    <p>Şık seçip kutusunu çizin. Kelime vurgusu için aşağıdaki metinden ifadeyi seçin; ardından görselde yerini çizin. Çift sütundaki her şık ayrı bir kutu olmalı.</p>
    <div className="flex flex-wrap gap-2 items-center">
      <select aria-label="Çizilecek alan türü" className={field} value={newType} onChange={e => setNewType(e.target.value as RegionType)}>
        {types.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
      </select>
      <button type="button" className={button} aria-pressed={drawing} onClick={() => { setDrawing(!drawing); setGesture(null); setDraft(null); }}>{drawing ? 'Çizmeyi iptal et' : 'Yeni kutu çiz'}</button>
      <span>{drawing ? 'Görselde basılı tutup sürükleyin; mevcut kutular çizimi engellemez.' : 'Kutuyu seçip taşıyabilir, köşesinden boyutlandırabilirsiniz.'}</span>
    </div>
    {solutionText && <details>
      <summary className="cursor-pointer font-semibold">Çözüm metninden kelime / ifade seç</summary>
      <textarea aria-label="Vurgu için çözüm metni" ref={script} readOnly value={solutionText} dir="auto" rows={5} className="select-text w-full border rounded p-2 mt-2" />
      <button className={button} type="button" onClick={() => {
        const el = script.current!;
        const text = el.value.slice(el.selectionStart, el.selectionEnd).trim();
        if (text) { setPhrase(text); setNewType('keyword'); setDrawing(true); }
      }}>Seçili ifadeye kutu çiz</button>
    </details>}
    <label className="flex flex-col gap-1">Sesle eşleştirilecek ifade
      <input aria-label="Sesle eşleştirilecek ifade" dir="auto" className={field} value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="Örneğin: مُمَيِّزَاتٌ" />
    </label>
    <div ref={stage} role="group" aria-label="Bölge çizim alanı" style={{ aspectRatio: aspect, touchAction: 'none' }}
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
    <label className="flex flex-col gap-1">Düzenlenecek kutu
      <select aria-label="Düzenlenecek kutu" value={selectedRegionId || ''} className={field} onChange={e => onSelectRegion(e.target.value || null)}>
        <option value="">Kutu seçin ({regions.length})</option>
        {regions.map(r => <option key={r.id} value={r.id}>{r.label} {r.content?.slice(0,60)}</option>)}
      </select>
    </label>
    {selected && <div className="flex flex-wrap gap-2 items-center border p-3 rounded">
      <select aria-label="Seçili kutunun türü" value={selected.type} className={field} onChange={e => update({ type:e.target.value as RegionType })}>
        {!types.some(t => t.type === selected.type) && <option value={selected.type}>{selected.type}</option>}
        {types.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
      </select>
      <input aria-label="Kutunun eşleşen metni" dir="auto" className={field} value={selected.content || ''} onChange={e => update({content:e.target.value})} />
      {(['x','y','width','height'] as const).map((key,i) => <label key={key}>{['Sol %','Üst %','Genişlik %','Yükseklik %'][i]}
        <input aria-label={['Sol yüzde','Üst yüzde','Genişlik yüzde','Yükseklik yüzde'][i]} className={`${field} w-20`} type="number" min={key === 'width' || key === 'height' ? .8 : 0} max="100" step="0.1" value={Number((selected[key]*100).toFixed(1))}
          onChange={e => {
            const value = Number(e.target.value)/100;
            if (!Number.isFinite(value) || e.target.value === '') return;
            const max = key === 'x' ? 1-selected.width : key === 'y' ? 1-selected.height : key === 'width' ? 1-selected.x : 1-selected.y;
            update({[key]:Math.max(key === 'width' || key === 'height' ? .008 : 0,Math.min(max,value))});
          }} /></label>)}
      <button className={`${button} text-red-800`} type="button" onClick={() => { onUpdateRegions(regions.filter(r => r.id !== selected.id)); onSelectRegion(null); }}>Seçili kutuyu sil</button>
    </div>}
  </div>;
}
