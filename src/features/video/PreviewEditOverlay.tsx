import React, { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, MapPin, Trash, X } from '@phosphor-icons/react';
import type { AnnotationRegion, VideoAction } from '../../types';
import type { FitRect } from './engine/types';
import { regionCanvasRect, underlineY } from './engine/renderer';
import { clock, moveRegion, nudgeAction } from '../question-editor/workflow';
import { cueTitle, withLineOffset } from '../question-editor/SimpleTimingList';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
/** A corner, or one side: 'w' / 'e' move only the left / right edge, 'n' / 's' only the top / bottom. */
type Handle = Corner | 'n' | 's' | 'e' | 'w';
const MIN_SIZE = .01;
const ICON: Partial<Record<VideoAction['type'], { icon: string; color: string; name: string }>> = {
  reject: { icon: '✗', color: '#8B1E2D', name: 'Çarpı' }, correct: { icon: '✓', color: '#15803D', name: 'Doğru işareti' },
  focus: { icon: '◎', color: '#4338CA', name: 'Çerçeve' }, underline: { icon: '▁', color: '#D97706', name: 'Altı çizgi' },
  highlight: { icon: '▮', color: '#B45309', name: 'Vurgu' },
};
/** "A şıkkı" or the phrase the box holds. */
const boxName = (region: AnnotationRegion, regions: AnnotationRegion[]) =>
  cueTitle({ type: 'reset', targetRegionId: region.id } as VideoAction, regions);

/** Boxes a teacher can pick on the picture: options and phrases, not the frame around the whole question. */
export const pickableRegions = (regions: AnnotationRegion[]) => regions.filter(r => r.id !== 'question-root' && r.height <= .5);

/** Marks of one box that are on screen at `time` (crosses and ticks stay to the end). */
export const marksAt = (actions: VideoAction[], regionId: string, time: number) =>
  actions.filter(a => a.targetRegionId === regionId && ICON[a.type] && time >= a.start - .01 && time <= a.start + a.duration + .01);

/** Drags one corner or side; the opposite edge stays put and the box never turns inside out or leaves the image. */
export function resizeRegion(region: AnnotationRegion, handle: Handle, dx: number, dy: number): AnnotationRegion {
  let left = region.x, top = region.y, right = region.x + region.width, bottom = region.y + region.height;
  if (handle.includes('w')) left = Math.max(0, Math.min(right - MIN_SIZE, left + dx));
  else if (handle.includes('e')) right = Math.min(1, Math.max(left + MIN_SIZE, right + dx));
  if (handle.includes('n')) top = Math.max(0, Math.min(bottom - MIN_SIZE, top + dy));
  else if (handle.includes('s')) bottom = Math.min(1, Math.max(top + MIN_SIZE, bottom + dy));
  return { ...region, x: left, y: top, width: right - left, height: bottom - top, manuallyAdjusted: true };
}

/** Marks a teacher can put on the picture, in toolbar order. */
export const TOOLS = ['reject', 'correct', 'focus', 'underline', 'highlight'] as const;
export type Tool = typeof TOOLS[number];

/**
 * A new mark at `time` on a box. Crosses and ticks stay to the end; frames, underlines and
 * highlights for a moment. A cross or tick replaces the box's earlier verdict.
 */
export function addMark(actions: VideoAction[], regionId: string, tool: Tool, time: number, total: number): VideoAction[] {
  const start = Math.max(0, Math.min(total - .1, time));
  const lasting = tool === 'reject' || tool === 'correct';
  const duration = lasting ? total - start : Math.min(tool === 'focus' ? 2.5 : 2, total - start);
  const mark: VideoAction = { id: `manual-${regionId}-${tool}-${Math.round(start * 1000)}-${actions.length}`, type: tool, targetRegionId: regionId,
    regionId, start, startTime: start, duration, label: `${tool}: elle eklendi`, ...(tool === 'underline' ? { drawDuration: 1.2 } : {}) };
  // A box has one verdict: a new cross or tick replaces whichever it had.
  return [...actions.filter(a => !(lasting && a.targetRegionId === regionId && (a.type === 'reject' || a.type === 'correct'))), mark]
    .sort((a, b) => a.start - b.start);
}

/** A box drawn from one corner to the other, in image coordinates (0–1), kept on the image. */
export function drawnRegion(id: string, x1: number, y1: number, x2: number, y2: number): AnnotationRegion {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const left = clamp(Math.min(x1, x2)), top = clamp(Math.min(y1, y2));
  return { id, type: 'keyword', label: 'Elle eklenen alan', x: left, y: top,
    width: clamp(Math.max(x1, x2)) - left, height: clamp(Math.max(y1, y2)) - top, manuallyAdjusted: true };
}

type Gesture =
  | { mode: 'move' | Handle; x: number; y: number; region: AnnotationRegion }
  | { mode: 'line'; x: number; y: number; action: VideoAction; heightPx: number }
  /** A new place drawn with a tool; started on a box, a plain click marks that box instead. */
  | { mode: 'draw'; x: number; y: number; ix: number; iy: number; boxId?: string };

/**
 * The place a drawn stroke becomes: a box as drawn, or, for a flat stroke drawn with the underline
 * tool, the text line it sits under (one usual text height above the stroke). Null for a stray click.
 */
export function placeFromStroke(drawn: AnnotationRegion, tool: Tool, fit: FitRect, lineHeight: number): AnnotationRegion | null {
  const wide = drawn.width * fit.width > 12, tall = drawn.height * fit.height > 8;
  if (wide && tall) return drawn;
  if (!wide || tool !== 'underline') return null;
  const bottom = drawn.y + drawn.height, top = Math.max(0, bottom - lineHeight);
  return { ...drawn, y: top, height: bottom - top };
}

/** The usual height of a text line on this question: the median phrase box, else 5% of the image. */
export function typicalLineHeight(regions: AnnotationRegion[]): number {
  const heights = regions.filter(r => r.content && !r.type.startsWith('option') && r.height > 0 && r.height <= .2).map(r => r.height).sort((a, b) => a - b);
  return heights.length ? heights[Math.floor(heights.length / 2)] : .05;
}

interface Props {
  fit: FitRect;
  canvasWidth: number;
  canvasHeight: number;
  regions: AnnotationRegion[];
  actions: VideoAction[];
  time: number;
  total: number;
  underlineOffset?: number;
  /** New boxes can carry their first mark (`add`), saved in the same step. */
  onRegions: (regions: AnnotationRegion[], add?: VideoAction[]) => void;
  onActions: (actions: VideoAction[]) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

/**
 * On-picture editing of the paused preview: click a box to select it, drag it to move,
 * drag a corner to resize, drag its underline up or down, and change its marks from the
 * small menu next to it. Every change goes through the same data the exported MP4 uses.
 */
export function PreviewEditOverlay({ fit, canvasWidth, canvasHeight, regions, actions, time, total, underlineOffset = 0, onRegions, onActions, onUndo, canUndo }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [draft, setDraft] = useState<AnnotationRegion | VideoAction | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelectedId(null); setTool(null); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const picks = pickableRegions(regions);
  const selected = picks.find(r => r.id === selectedId);
  const shown = (r: AnnotationRegion) => draft && 'x' in draft && draft.id === r.id ? draft : r;
  // Percent of the overlay for a rectangle in canvas pixels.
  const pct = (rect: FitRect) => ({ left: `${rect.x / canvasWidth * 100}%`, top: `${rect.y / canvasHeight * 100}%`,
    width: `${rect.width / canvasWidth * 100}%`, height: `${rect.height / canvasHeight * 100}%` });
  const pxPerCanvas = () => (box.current?.clientWidth || canvasWidth) / canvasWidth;
  const scale = Math.min(canvasWidth / 1920, canvasHeight / 1080);

  const begin = (e: React.PointerEvent, next: Gesture) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGesture(next);
  };
  /** Pointer position on the image, 0–1. */
  const onImage = (e: React.PointerEvent) => {
    const bounds = box.current!.getBoundingClientRect(), px = pxPerCanvas();
    return { ix: ((e.clientX - bounds.left) / px - fit.x) / fit.width, iy: ((e.clientY - bounds.top) / px - fit.y) / fit.height };
  };
  const drag = (e: React.PointerEvent) => {
    if (!gesture) return;
    const px = pxPerCanvas();
    if (gesture.mode === 'draw') {
      const { ix, iy } = onImage(e);
      setDraft(drawnRegion('drawing', gesture.ix, gesture.iy, ix, iy));
      return;
    }
    if (gesture.mode === 'line') {
      const delta = (e.clientY - gesture.y) / px / gesture.heightPx;
      setDraft(withLineOffset(gesture.action, Math.round(delta * 20) / 20));
      return;
    }
    const dx = (e.clientX - gesture.x) / px / fit.width, dy = (e.clientY - gesture.y) / px / fit.height;
    setDraft(gesture.mode === 'move' ? moveRegion(gesture.region, dx, dy) : resizeRegion(gesture.region, gesture.mode, dx, dy));
  };
  const end = () => {
    if (gesture?.mode === 'draw') {
      // A drawn place (anywhere, even over a found box) gets the chosen mark; a click on a box marks that box.
      const place = tool && draft && 'x' in draft ? placeFromStroke(draft, tool, fit, typicalLineHeight(regions)) : null;
      if (tool && place) {
        const id = `manual-box-${Date.now()}`;
        onRegions([...regions, { ...place, id }], addMark([], id, tool, time, total));
        setSelectedId(id); setTool(null);
      } else if (gesture.boxId) markBox(gesture.boxId);
    } else if (draft && 'x' in draft) onRegions(regions.map(r => r.id === draft.id ? draft : r));
    else if (draft) onActions(actions.map(a => a.id === draft.id ? draft as VideoAction : a));
    setGesture(null); setDraft(null);
  };

  const removeMark = (id: string) => onActions(actions.filter(a => a.id !== id));
  const markHere = (action: VideoAction) => onActions(actions.map(a => a.id === action.id ? nudgeAction(a, time - a.start, total) : a));
  const removeBox = (id: string) => { setSelectedId(null); onRegions(regions.filter(r => r.id !== id)); };
  const markBox = (id: string) => { if (tool) { onActions(addMark(actions, id, tool, time, total)); setSelectedId(id); setTool(null); } };

  const selectedRect = selected ? regionCanvasRect(shown(selected), fit) : null;
  const selectedMarks = selected ? actions.filter(a => a.targetRegionId === selected.id && ICON[a.type]).sort((a, b) => a.start - b.start) : [];
  const line = selected && selectedRect ? selectedMarks.find(a => a.type === 'underline') : undefined;
  const lineAction = line && draft && !('x' in draft) && draft.id === line.id ? draft as VideoAction : line;
  const menuBelow = selectedRect ? selectedRect.y + selectedRect.height < canvasHeight * .62 : true;

  return (
    <div ref={box} className={`absolute inset-0 z-10 ${tool ? 'cursor-crosshair' : ''}`} onPointerMove={drag} onPointerUp={end} onPointerCancel={end}
      onPointerDown={e => {
        setSelectedId(null);
        if (!tool) return;
        const { ix, iy } = onImage(e);
        begin(e, { mode: 'draw', x: e.clientX, y: e.clientY, ix, iy });
      }}>
      <div role="toolbar" aria-label="İşaret araçları" className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-1 rounded-xl bg-white/95 shadow-md border border-[#D5D4CC]"
        onPointerDown={e => e.stopPropagation()}>
        <button type="button" aria-pressed={!tool} onClick={() => setTool(null)} title="Seç ve taşı"
          className={`w-9 h-9 rounded-lg text-[15px] ${!tool ? 'bg-[#1C1917] text-white' : 'hover:bg-[#F2F1EB] text-[#33322E]'}`}>↖</button>
        {TOOLS.map(t => (
          <button key={t} type="button" aria-pressed={tool === t} onClick={() => { setTool(tool === t ? null : t); setSelectedId(null); }}
            title={`${ICON[t]!.name} ekle`} aria-label={`${ICON[t]!.name} ekle`}
            className={`w-9 h-9 rounded-lg text-[16px] font-bold ${tool === t ? 'text-white' : 'hover:bg-[#F2F1EB]'}`}
            style={tool === t ? { background: ICON[t]!.color } : { color: ICON[t]!.color }}>{ICON[t]!.icon}</button>
        ))}
      </div>
      <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
        <span className="px-2 py-1 rounded-md bg-black/60 text-white text-[11px]">
          {tool ? `${ICON[tool]!.name}: ${tool === 'underline' ? 'kelimelerin altına sürükleyip çizin' : 'istediğiniz yere sürükleyip alan çizin'} ya da bir kutuya tıklayın · ${clock(time)} anında eklenir` : 'Düzenlemek için bir kutuya tıklayın · soldan işaret ekleyin'}
        </span>
        {onUndo && <button type="button" disabled={!canUndo} onClick={onUndo} title="Son değişikliği geri al"
          className="px-2 py-1 rounded-md bg-white/90 text-[11px] font-semibold text-[#33322E] inline-flex items-center gap-1 disabled:opacity-40">
          <ArrowCounterClockwise size={12} /> Geri al
        </button>}
      </div>

      {picks.map(region => {
        const r = shown(region);
        const rect = regionCanvasRect(r, fit);
        const active = marksAt(actions, region.id, time);
        const isSelected = region.id === selectedId;
        const color = ICON[active[0]?.type]?.color;
        return (
          <div key={region.id} role="button" aria-label={`${boxName(region, regions)} kutusu`}
            title="Seç: taşımak için sürükleyin"
            className={`absolute rounded-[3px] ${tool ? 'cursor-crosshair border border-dashed border-[#2563EB]/60 hover:bg-[#2563EB]/10' : 'cursor-move'} transition-[border-color] ${tool ? '' : isSelected ? 'border-2 border-[#2563EB] bg-[#2563EB]/5' : color ? 'border-2' : 'border border-dashed border-white/0 hover:border-[#2563EB]/70'}`}
            style={{ ...pct(rect), ...(isSelected || !color ? {} : { borderColor: `${color}AA` }) }}
            onPointerDown={e => {
              if (tool) { setSelectedId(null); begin(e, { mode: 'draw', x: e.clientX, y: e.clientY, ...onImage(e), boxId: region.id }); return; }
              setSelectedId(region.id); begin(e, { mode: 'move', x: e.clientX, y: e.clientY, region });
            }}>
            {isSelected && (['n', 's', 'w', 'e'] as const).map(side => (
              <span key={side} aria-label="Kenardan boyutlandır" onPointerDown={e => begin(e, { mode: side, x: e.clientX, y: e.clientY, region })}
                className={`absolute ${side === 'n' || side === 's' ? `left-1.5 right-1.5 h-2 cursor-ns-resize ${side === 'n' ? '-top-1' : '-bottom-1'}` : `top-1.5 bottom-1.5 w-2 cursor-ew-resize ${side === 'w' ? '-left-1' : '-right-1'}`}`}>
                <span className={`absolute bg-white border-2 border-[#2563EB] rounded-sm ${side === 'n' || side === 's' ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-2' : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-3'}`} />
              </span>
            ))}
            {isSelected && (['nw', 'ne', 'sw', 'se'] as Corner[]).map(corner => (
              <span key={corner} aria-label="Boyutlandır" onPointerDown={e => begin(e, { mode: corner, x: e.clientX, y: e.clientY, region })}
                className={`absolute w-3 h-3 bg-white border-2 border-[#2563EB] rounded-sm ${corner.includes('n') ? '-top-1.5' : '-bottom-1.5'} ${corner.includes('w') ? '-left-1.5' : '-right-1.5'} ${corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`} />
            ))}
          </div>
        );
      })}

      {gesture?.mode === 'draw' && draft && 'x' in draft && (
        <div className="absolute border-2 border-dashed rounded-[3px] pointer-events-none" style={{ ...pct(regionCanvasRect(draft, fit)), borderColor: tool ? ICON[tool]!.color : '#2563EB' }} />
      )}

      {selected && selectedRect && lineAction && (
        <div role="slider" aria-label="Altı çizgiyi yukarı-aşağı sürükleyin" aria-valuenow={lineAction.lineOffset ?? 0} title="Çizgiyi yukarı-aşağı sürükleyin"
          className="absolute cursor-ns-resize flex items-center"
          style={{ left: pct(selectedRect).left, width: pct(selectedRect).width,
            top: `${(underlineY(selectedRect, scale, underlineOffset + (lineAction.lineOffset ?? 0)) - 8 * scale) / canvasHeight * 100}%`, height: `${16 * scale / canvasHeight * 100}%` }}
          onPointerDown={e => begin(e, { mode: 'line', x: e.clientX, y: e.clientY, action: line!, heightPx: selectedRect.height })}>
          <span className="w-full h-[3px] rounded bg-[#D97706] shadow-[0_0_0_2px_white]" />
          {(['w', 'e'] as const).map(side => (
            <span key={side} aria-label={side === 'w' ? 'Çizginin sol ucunu çekin' : 'Çizginin sağ ucunu çekin'} title="Ucundan çekerek uzatın ya da kısaltın"
              onPointerDown={e => begin(e, { mode: side, x: e.clientX, y: e.clientY, region: selected })}
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#D97706] cursor-ew-resize ${side === 'w' ? '-left-1.5' : '-right-1.5'}`} />
          ))}
        </div>
      )}

      {selected && selectedRect && !gesture && (
        <div className="absolute w-64 max-w-[70%] rounded-lg bg-white shadow-lg border border-[#D5D4CC] text-xs text-[#33322E] p-2 space-y-1.5"
          style={{ left: `${Math.min(selectedRect.x / canvasWidth * 100, 60)}%`,
            ...(menuBelow ? { top: `calc(${(selectedRect.y + selectedRect.height) / canvasHeight * 100}% + 8px)` }
              : { bottom: `calc(${(1 - selectedRect.y / canvasHeight) * 100}% + 8px)` }) }}
          onPointerDown={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <b className="truncate">{boxName(selected, regions)}</b>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Kapat" className="p-0.5 rounded hover:bg-[#F2F1EB]"><X size={12} /></button>
          </div>
          {selectedMarks.length === 0 && <p className="text-[#787670]">Bu kutuda işaret yok.</p>}
          {selectedMarks.map(mark => (
            <div key={mark.id} className="flex items-center gap-1.5">
              <span className="w-4 text-center font-bold" style={{ color: ICON[mark.type]!.color }}>{ICON[mark.type]!.icon}</span>
              <span className="flex-1 truncate">{ICON[mark.type]!.name} · <span className="font-mono-code">{clock(mark.start)}</span></span>
              <button type="button" onClick={() => markHere(mark)} disabled={Math.abs(mark.start - time) < .05} title={`${clock(time)} anına al`}
                className="p-1 rounded border hover:bg-[#F2F1EB] disabled:opacity-40" aria-label="Buraya al"><MapPin size={12} /></button>
              <button type="button" onClick={() => removeMark(mark.id)} title="İşareti sil" aria-label="İşareti sil"
                className="p-1 rounded border text-[#8B1E2D] hover:bg-red-50"><Trash size={12} /></button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 border-t border-[#EFEFEA] text-[11px] text-[#787670]">
            <span>{line ? 'Çizgi: ortası yukarı-aşağı · uçları boy' : 'Sürükle: taşı · kenar/köşe: boyut'}</span>
            <button type="button" onClick={() => removeBox(selected.id)} className="text-[#8B1E2D] hover:underline">Kutuyu kaldır</button>
          </div>
        </div>
      )}
    </div>
  );
}
