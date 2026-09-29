import React, { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, MapPin, Trash, X } from '@phosphor-icons/react';
import type { AnnotationRegion, VideoAction } from '../../types';
import type { FitRect } from './engine/types';
import { regionCanvasRect, underlineY } from './engine/renderer';
import { clock, moveRegion, nudgeAction } from '../question-editor/workflow';
import { cueTitle, withLineOffset } from '../question-editor/SimpleTimingList';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
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

/** Drags one corner; the opposite corner stays put and the box never turns inside out or leaves the image. */
export function resizeRegion(region: AnnotationRegion, corner: Corner, dx: number, dy: number): AnnotationRegion {
  let left = region.x, top = region.y, right = region.x + region.width, bottom = region.y + region.height;
  if (corner.includes('w')) left = Math.max(0, Math.min(right - MIN_SIZE, left + dx));
  else right = Math.min(1, Math.max(left + MIN_SIZE, right + dx));
  if (corner.includes('n')) top = Math.max(0, Math.min(bottom - MIN_SIZE, top + dy));
  else bottom = Math.min(1, Math.max(top + MIN_SIZE, bottom + dy));
  return { ...region, x: left, y: top, width: right - left, height: bottom - top, manuallyAdjusted: true };
}

type Gesture =
  | { mode: 'move' | Corner; x: number; y: number; region: AnnotationRegion }
  | { mode: 'line'; x: number; y: number; action: VideoAction; heightPx: number };

interface Props {
  fit: FitRect;
  canvasWidth: number;
  canvasHeight: number;
  regions: AnnotationRegion[];
  actions: VideoAction[];
  time: number;
  total: number;
  underlineOffset?: number;
  onRegions: (regions: AnnotationRegion[]) => void;
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
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
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
  const drag = (e: React.PointerEvent) => {
    if (!gesture) return;
    const px = pxPerCanvas();
    if (gesture.mode === 'line') {
      const delta = (e.clientY - gesture.y) / px / gesture.heightPx;
      setDraft(withLineOffset(gesture.action, Math.round(delta * 20) / 20));
      return;
    }
    const dx = (e.clientX - gesture.x) / px / fit.width, dy = (e.clientY - gesture.y) / px / fit.height;
    setDraft(gesture.mode === 'move' ? moveRegion(gesture.region, dx, dy) : resizeRegion(gesture.region, gesture.mode, dx, dy));
  };
  const end = () => {
    if (draft && 'x' in draft) onRegions(regions.map(r => r.id === draft.id ? draft : r));
    else if (draft) onActions(actions.map(a => a.id === draft.id ? draft as VideoAction : a));
    setGesture(null); setDraft(null);
  };

  const removeMark = (id: string) => onActions(actions.filter(a => a.id !== id));
  const markHere = (action: VideoAction) => onActions(actions.map(a => a.id === action.id ? nudgeAction(a, time - a.start, total) : a));
  const removeBox = (id: string) => { setSelectedId(null); onRegions(regions.filter(r => r.id !== id)); };

  const selectedRect = selected ? regionCanvasRect(shown(selected), fit) : null;
  const selectedMarks = selected ? actions.filter(a => a.targetRegionId === selected.id && ICON[a.type]).sort((a, b) => a.start - b.start) : [];
  const line = selected && selectedRect ? selectedMarks.find(a => a.type === 'underline') : undefined;
  const lineAction = line && draft && !('x' in draft) && draft.id === line.id ? draft as VideoAction : line;
  const menuBelow = selectedRect ? selectedRect.y + selectedRect.height < canvasHeight * .62 : true;

  return (
    <div ref={box} className="absolute inset-0 z-10" onPointerMove={drag} onPointerUp={end} onPointerCancel={end}
      onPointerDown={() => setSelectedId(null)}>
      <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
        <span className="px-2 py-1 rounded-md bg-black/60 text-white text-[11px]">Düzenlemek için bir kutuya tıklayın</span>
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
            className={`absolute rounded-[3px] cursor-move transition-[border-color] ${isSelected ? 'border-2 border-[#2563EB] bg-[#2563EB]/5' : color ? 'border-2' : 'border border-dashed border-white/0 hover:border-[#2563EB]/70'}`}
            style={{ ...pct(rect), ...(isSelected || !color ? {} : { borderColor: `${color}AA` }) }}
            onPointerDown={e => { setSelectedId(region.id); begin(e, { mode: 'move', x: e.clientX, y: e.clientY, region }); }}>
            {isSelected && (['nw', 'ne', 'sw', 'se'] as Corner[]).map(corner => (
              <span key={corner} aria-label="Boyutlandır" onPointerDown={e => begin(e, { mode: corner, x: e.clientX, y: e.clientY, region })}
                className={`absolute w-3 h-3 bg-white border-2 border-[#2563EB] rounded-sm ${corner.includes('n') ? '-top-1.5' : '-bottom-1.5'} ${corner.includes('w') ? '-left-1.5' : '-right-1.5'} ${corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`} />
            ))}
          </div>
        );
      })}

      {selected && selectedRect && lineAction && (
        <div role="slider" aria-label="Altı çizgiyi yukarı-aşağı sürükleyin" aria-valuenow={lineAction.lineOffset ?? 0} title="Çizgiyi yukarı-aşağı sürükleyin"
          className="absolute cursor-ns-resize flex items-center"
          style={{ left: pct(selectedRect).left, width: pct(selectedRect).width,
            top: `${(underlineY(selectedRect, scale, underlineOffset + (lineAction.lineOffset ?? 0)) - 8 * scale) / canvasHeight * 100}%`, height: `${16 * scale / canvasHeight * 100}%` }}
          onPointerDown={e => begin(e, { mode: 'line', x: e.clientX, y: e.clientY, action: line!, heightPx: selectedRect.height })}>
          <span className="w-full h-[3px] rounded bg-[#D97706] shadow-[0_0_0_2px_white]" />
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
            <span>{line ? 'Çizgiyi sürükleyerek taşıyın' : 'Sürükle: taşı · köşe: boyut'}</span>
            <button type="button" onClick={() => removeBox(selected.id)} className="text-[#8B1E2D] hover:underline">Kutuyu kaldır</button>
          </div>
        </div>
      )}
    </div>
  );
}
