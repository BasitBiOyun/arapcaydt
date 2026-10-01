import React, { useEffect, useRef, useState } from 'react';
import Moveable from 'react-moveable';
import { ArrowCounterClockwise, MapPin, Trash, X } from '@phosphor-icons/react';
import type { AnnotationRegion, VideoAction } from '../../types';
import type { FitRect } from './engine/types';
import { regionCanvasRect, underlineY } from './engine/renderer';
import { clock, moveRegion, nudgeAction } from '../question-editor/workflow';
import { cueTitle, withLineOffset } from './markLabels';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
/** A corner, or one side: 'w' / 'e' move only the left / right edge, 'n' / 's' only the top / bottom. */
type Handle = Corner | 'n' | 's' | 'e' | 'w';
const MIN_SIZE = .01;
const ICON: Partial<Record<VideoAction['type'], { icon: string; color: string; name: string }>> = {
  reject: { icon: '✗', color: '#8B1E2D', name: 'Çarpı' }, correct: { icon: '✓', color: '#15803D', name: 'Doğru işareti' },
  focus: { icon: '◎', color: '#4338CA', name: 'Çerçeve' }, circle: { icon: '◯', color: '#DC2626', name: 'Daire' },
  underline: { icon: '▁', color: '#D97706', name: 'Altı çizgi' },
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

/** Underline colours: the studio's orange first, then colours that read well on a printed page. */
export const LINE_COLORS = [
  { color: '#D97706', name: 'Turuncu' }, { color: '#DC2626', name: 'Kırmızı' }, { color: '#2563EB', name: 'Mavi' },
  { color: '#16A34A', name: 'Yeşil' }, { color: '#7C3AED', name: 'Mor' }, { color: '#DB2777', name: 'Pembe' },
  { color: '#0891B2', name: 'Turkuaz' }, { color: '#CA8A04', name: 'Hardal' }, { color: '#92400E', name: 'Kahverengi' },
  { color: '#1C1917', name: 'Siyah' },
] as const;
const LINE_COLOR_KEY = 'studio-line-color';
const savedLineColor = () => { try { return localStorage.getItem(LINE_COLOR_KEY) || LINE_COLORS[0].color; } catch { return LINE_COLORS[0].color; } };

/** Ten colour dots; the chosen one is ringed. */
function ColorDots({ value, onPick, label }: { value: string; onPick: (color: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
      {LINE_COLORS.map(c => (
        <button key={c.color} type="button" role="radio" aria-checked={value === c.color} aria-label={c.name} title={c.name}
          onClick={() => onPick(c.color)}
          className={`w-6 h-6 rounded-full border-2 ${value === c.color ? 'border-[#1C1917] ring-2 ring-white' : 'border-white/80 hover:scale-110'} transition-transform`}
          style={{ background: c.color }} />
      ))}
    </div>
  );
}

/** Marks a teacher can put on the picture, in toolbar order. */
export const TOOLS = ['reject', 'correct', 'focus', 'circle', 'underline', 'highlight'] as const;
export type Tool = typeof TOOLS[number];

/**
 * A new mark at `time` on a box. Crosses and ticks stay to the end; frames, underlines and
 * highlights for a moment. A cross or tick replaces the box's earlier verdict.
 */
export function addMark(actions: VideoAction[], regionId: string, tool: Tool, time: number, total: number): VideoAction[] {
  const start = Math.max(0, Math.min(total - .1, time));
  const lasting = tool === 'reject' || tool === 'correct';
  const duration = lasting ? total - start : Math.min(tool === 'focus' || tool === 'circle' ? 2.5 : 2, total - start);
  const mark: VideoAction = { id: `manual-${regionId}-${tool}-${Math.round(start * 1000)}-${actions.length}`, type: tool, targetRegionId: regionId,
    regionId, start, startTime: start, duration, label: `${tool}: elle eklendi` };
  // A box has one verdict: a new cross or tick replaces whichever it had.
  return [...actions.filter(a => !(lasting && a.targetRegionId === regionId && (a.type === 'reject' || a.type === 'correct'))), mark]
    .sort((a, b) => a.start - b.start);
}

/**
 * A copy of a box (Ctrl+V): a little down and to the right so it can be seen and dragged, with the
 * box's marks starting at the paused moment (crosses and ticks still last to the end).
 */
export function pastedBox(region: AnnotationRegion, marks: VideoAction[], id: string, time: number, total: number) {
  const nudge = (v: number, size: number) => Math.max(0, Math.min(1 - size, v + .02));
  const copy: AnnotationRegion = { ...region, id, type: 'keyword', label: 'Kopya', content: undefined, x: nudge(region.x, region.width), y: nudge(region.y, region.height), manuallyAdjusted: true };
  const first = marks.length ? Math.min(...marks.map(m => m.start)) : time;
  const copiedMarks = marks.map((m, i) => {
    const start = Math.max(0, Math.min(total - .1, time + (m.start - first)));
    const lasting = m.type === 'reject' || m.type === 'correct';
    return { ...m, id: `manual-${id}-${m.type}-${i}`, targetRegionId: id, regionId: id, start, startTime: start,
      duration: lasting ? total - start : Math.max(.3, Math.min(m.duration, total - start)), label: `${m.type}: kopya` };
  });
  return { region: copy, marks: copiedMarks };
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

/**
 * A line dropped close under printed text sits exactly under it: the nearest text box (a phrase,
 * an option, a line found earlier) whose bottom is within half a line of the stroke and which
 * overlaps it sideways lends the line its top and bottom. Otherwise the line stays where it was drawn.
 */
export function snapToText(place: AnnotationRegion, regions: AnnotationRegion[], lineHeight: number): AnnotationRegion {
  const bottom = place.y + place.height;
  const near = regions
    .filter(r => r.id !== 'question-root' && r.height <= .2 && r.x < place.x + place.width && r.x + r.width > place.x)
    .map(r => ({ r, gap: Math.abs(r.y + r.height - bottom) }))
    .filter(n => n.gap <= lineHeight * .5)
    .sort((a, b) => a.gap - b.gap)[0];
  return near ? { ...place, y: near.r.y, height: near.r.height } : place;
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
  /** The teacher says a box is option `letter` (the system then knows where "C şıkkı" is). */
  onAssignOption?: (boxId: string, letter: string) => void;
  /** A missing option to show on the picture: draw its box, or click the box that is it. */
  drawOption?: string | null;
  onDrawOptionDone?: () => void;
  /** A box to select at once ("Burada hata var" on the mark strip). */
  focusBox?: { id: string } | null;
}

/** The copied box lives outside the overlay, which is rebuilt every time the preview pauses. */
let copied: { region: AnnotationRegion; marks: VideoAction[] } | null = null;

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * On-picture editing of the paused preview: click a box to select it, drag it to move,
 * drag a corner to resize, drag its underline up or down, and change its marks from the
 * small menu next to it. Every change goes through the same data the exported MP4 uses.
 */
export function PreviewEditOverlay({ fit, canvasWidth, canvasHeight, regions, actions, time, total, underlineOffset = 0, onRegions, onActions, onUndo, canUndo, onAssignOption, drawOption, onDrawOptionDone, focusBox }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [draft, setDraft] = useState<AnnotationRegion | VideoAction | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [hasCopy, setHasCopy] = useState(!!copied);
  // The colour new underlines get, kept on this device.
  const [lineColor, setLineColor] = useState(savedLineColor);
  const pickLineColor = (color: string) => { setLineColor(color); try { localStorage.setItem(LINE_COLOR_KEY, color); } catch { /* per-device only */ } };
  useEffect(() => { if (focusBox && !tool && !drawOption) setSelectedId(focusBox.id); }, [focusBox]); // eslint-disable-line react-hooks/exhaustive-deps
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  const onPicture = useRef(false);
  /** The underlines drawn one after another at this paused moment: where the next one starts. */
  const lineSeries = useRef<{ time: number; end: number } | null>(null);
  useEffect(() => {
    // Capture: runs before the page's Esc (leaving full screen), so Esc first lets go of a box or tool.
    const key = (e: KeyboardEvent) => keys.current(e);
    // Delete and copy act on the picture only when the teacher last clicked there (not on the strip's marks).
    const click = (e: PointerEvent) => { onPicture.current = !!box.current?.contains(e.target as Node); };
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', click, true);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', click, true); };
  }, []);
  // Showing a missing option puts the tools aside.
  useEffect(() => { if (drawOption) { setTool(null); setSelectedId(null); } }, [drawOption]);
  const drawing = !!tool || !!drawOption;

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
      // The underline tool draws a flat line of fixed thickness: only its length follows the pointer.
      setDraft(drawnRegion('drawing', gesture.ix, gesture.iy, ix, tool === 'underline' ? gesture.iy : iy));
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
    if (gesture?.mode === 'draw' && drawOption) {
      // A box drawn for the missing option, or a click on the box that is it.
      const drawn = draft && 'x' in draft ? placeFromStroke(draft, 'focus', fit, 0) : null;
      if (drawn) {
        const id = `option-${drawOption.toLowerCase()}`;
        onRegions([...regions.filter(r => r.id !== id), { ...drawn, id, type: id as AnnotationRegion['type'], label: `${drawOption} Şıkkı` }]);
        setSelectedId(id); onDrawOptionDone?.();
      } else if (gesture.boxId && onAssignOption) {
        onAssignOption(gesture.boxId, drawOption);
        setSelectedId(`option-${drawOption.toLowerCase()}`); onDrawOptionDone?.();
      }
    } else if (gesture?.mode === 'draw') {
      // A drawn place (anywhere, even over a found box) gets the chosen mark; a click on a box marks that box.
      const lineHeight = typicalLineHeight(regions);
      const stroke = tool && draft && 'x' in draft ? placeFromStroke(draft, tool, fit, lineHeight) : null;
      const place = stroke && tool === 'underline' ? snapToText(stroke, regions, lineHeight) : stroke;
      if (tool && place) {
        const id = `manual-box-${Date.now()}`;
        // Underlines are drawn line after line with the tool kept: each new line follows the
        // previous one in time (while the preview stays at the same moment).
        const series = tool === 'underline';
        const at = series && lineSeries.current && Math.abs(lineSeries.current.time - time) < .01 ? lineSeries.current.end : time;
        // The line flows the way it was dragged (left-to-right or, as Arabic is read, right-to-left).
        const fromLeft = series && draft && 'x' in draft && gesture.ix <= draft.x + draft.width / 2;
        const marks = addMark([], id, tool, at, total).map(m => ({ ...m, ...(fromLeft ? { fromLeft: true } : {}),
          ...(tool === 'underline' && lineColor !== LINE_COLORS[0].color ? { color: lineColor } : {}) }));
        onRegions([...regions, { ...place, id }], marks);
        if (series) lineSeries.current = { time, end: Math.min(total - .1, at + marks[0].duration) };
        else { setSelectedId(id); setTool(null); }
      } else if (gesture.boxId) markBox(gesture.boxId);
    } else if (gesture && draft && 'x' in draft) onRegions(regions.map(r => r.id === draft.id ? draft : r));
    else if (gesture && draft) onActions(actions.map(a => a.id === draft.id ? draft as VideoAction : a));
    // A box moved with the selection frame (react-moveable) is saved by its own end handlers.
    if (gesture) { setGesture(null); setDraft(null); }
  };

  /** The selected box on screen, which the selection frame (react-moveable) moves and resizes. */
  const boxes = useRef(new Map<string, HTMLDivElement>());
  const latest = useRef<AnnotationRegion | null>(null);
  /** The box's own size styles while react-moveable resizes it on screen. */
  const resizing = useRef<{ width: string; height: string } | null>(null);
  /** A box from its on-screen position and size (overlay pixels), kept on the image. */
  const fromScreen = (region: AnnotationRegion, left: number, top: number, width: number, height: number): AnnotationRegion => {
    const px = pxPerCanvas();
    const x = (left / px - fit.x) / fit.width, y = (top / px - fit.y) / fit.height;
    const w = width / px / fit.width, h = height / px / fit.height;
    const clampedX = Math.max(0, Math.min(1 - Math.min(1, w), x)), clampedY = Math.max(0, Math.min(1 - Math.min(1, h), y));
    return { ...region, x: clampedX, y: clampedY, width: Math.min(1, w), height: Math.min(1, h), manuallyAdjusted: true };
  };
  const preview = (next: AnnotationRegion) => { latest.current = next; setDraft(next); };
  const commit = () => {
    const next = latest.current;
    latest.current = null; setDraft(null);
    if (next) onRegions(regions.map(r => r.id === next.id ? next : r));
  };

  const removeMark = (id: string) => onActions(actions.filter(a => a.id !== id));
  const markHere = (action: VideoAction) => onActions(actions.map(a => a.id === action.id ? nudgeAction(a, time - a.start, total) : a));
  const removeBox = (id: string) => { setSelectedId(null); onRegions(regions.filter(r => r.id !== id)); };
  const markBox = (id: string) => {
    if (!tool) return;
    const added = addMark(actions, id, tool, time, total)
      .map(m => tool === 'underline' && m.targetRegionId === id && !actions.includes(m) && lineColor !== LINE_COLORS[0].color ? { ...m, color: lineColor } : m);
    onActions(added); setSelectedId(id); setTool(null);
  };
  /** A selected box's underlines take the colour (and new lines get it too). */
  const recolorLines = (id: string, color: string) => {
    pickLineColor(color);
    onActions(actions.map(a => a.targetRegionId === id && a.type === 'underline' ? { ...a, color: color === LINE_COLORS[0].color ? undefined : color } : a));
  };
  const copy = (region: AnnotationRegion) => {
    copied = { region, marks: actions.filter(a => a.targetRegionId === region.id && ICON[a.type]) };
    setHasCopy(true);
  };
  const paste = () => {
    const source = copied;
    if (!source) return;
    const pasted = pastedBox(source.region, source.marks, `manual-box-${Date.now()}`, time, total);
    onRegions([...regions, pasted.region], pasted.marks);
    setSelectedId(pasted.region.id);
  };
  keys.current = e => {
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
      if (selectedId || tool || drawOption) { e.preventDefault(); setSelectedId(null); setTool(null); onDrawOptionDone?.(); }
      return;
    }
    if (!ctrl && (e.key === 'Delete' || e.key === 'Backspace') && selected && onPicture.current) { e.preventDefault(); removeBox(selected.id); return; }
    if (!ctrl || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && onUndo && canUndo) { e.preventDefault(); onUndo(); return; }
    if (k === 'c' && selected && onPicture.current && !window.getSelection()?.toString()) {
      e.preventDefault();
      copy(selected);
      return;
    }
    if (k === 'v' && copied) { e.preventDefault(); paste(); }
  };

  const selectedRect = selected ? regionCanvasRect(shown(selected), fit) : null;
  const selectedMarks = selected ? actions.filter(a => a.targetRegionId === selected.id && ICON[a.type]).sort((a, b) => a.start - b.start) : [];
  const line = selected && selectedRect ? selectedMarks.find(a => a.type === 'underline') : undefined;
  const lineAction = line && draft && !('x' in draft) && draft.id === line.id ? draft as VideoAction : line;
  const menuBelow = selectedRect ? selectedRect.y + selectedRect.height < canvasHeight * .62 : true;

  return (
    <div ref={box} className={`absolute inset-0 z-10 ${drawing ? 'cursor-crosshair' : ''}`} onPointerMove={drag} onPointerUp={end} onPointerCancel={end}
      onPointerDown={e => {
        // The selection frame's handles sit on this layer: pressing one keeps the box selected.
        if ((e.target as HTMLElement).closest('.moveable-control-box')) return;
        setSelectedId(null);
        if (!drawing) return;
        const { ix, iy } = onImage(e);
        begin(e, { mode: 'draw', x: e.clientX, y: e.clientY, ix, iy });
      }}>
      <div role="toolbar" aria-label="İşaret araçları" className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-1 rounded-xl bg-white/95 shadow-md border border-[#D5D4CC]"
        onPointerDown={e => e.stopPropagation()}>
        <button type="button" aria-pressed={!tool} onClick={() => setTool(null)} title="Seç ve taşı"
          className={`w-9 h-9 rounded-lg text-[15px] ${!tool ? 'bg-[#1C1917] text-white' : 'hover:bg-[#F2F1EB] text-[#33322E]'}`}>↖</button>
        {TOOLS.map(t => (
          <button key={t} type="button" aria-pressed={tool === t} onClick={() => { setTool(tool === t ? null : t); setSelectedId(null); onDrawOptionDone?.(); }}
            title={`${ICON[t]!.name} ekle`} aria-label={`${ICON[t]!.name} ekle`}
            className={`w-9 h-9 rounded-lg text-[16px] font-bold ${tool === t ? 'text-white' : 'hover:bg-[#F2F1EB]'}`}
            style={tool === t ? { background: ICON[t]!.color } : { color: ICON[t]!.color }}>{ICON[t]!.icon}</button>
        ))}
      </div>
      {tool === 'underline' && (
        <div className="absolute left-14 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/95 shadow-md border border-[#D5D4CC] space-y-1.5"
          onPointerDown={e => e.stopPropagation()}>
          <p className="text-[11px] font-semibold text-[#55544F]">Çizgi rengi</p>
          <ColorDots value={lineColor} onPick={pickLineColor} label="Yeni çizgilerin rengi" />
        </div>
      )}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
        <span className={`px-2 py-1 rounded-md text-white text-xs ${drawOption ? 'bg-[#8B1E2D] font-semibold' : 'bg-black/60'}`}>
          {drawOption ? `${drawOption} şıkkı: kutusunu görselde sürükleyerek çizin ya da onu gösteren kutuya tıklayın · Esc: vazgeç` : tool === 'underline' ? 'Alt çizgi: başlangıca basın, sağa ya da sola sürükleyip bırakın · yazının altına bırakırsanız satıra oturur · bitince Esc'
            : tool ? `${ICON[tool]!.name}: istediğiniz yere sürükleyip alan çizin ya da bir kutuya tıklayın · ${clock(time)} anında eklenir` : 'Düzenlemek için bir kutuya tıklayın · soldan işaret ekleyin'}
        </span>
        {onUndo && <button type="button" disabled={!canUndo} onClick={onUndo} title="Son değişikliği geri al"
          className="px-2 py-1 rounded-md bg-white/90 text-xs font-semibold text-[#33322E] inline-flex items-center gap-1 disabled:opacity-40">
          <ArrowCounterClockwise size={12} /> Geri al
        </button>}
        {hasCopy && !selected && !drawing && <button type="button" onClick={paste} title="Kopyalanan kutuyu buraya yapıştır (Ctrl+V)"
          className="px-2 py-1 rounded-md bg-white/90 text-xs font-semibold text-[#33322E]">Yapıştır</button>}
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
            className={`absolute rounded-[3px] ${drawing ? 'cursor-crosshair border border-dashed border-[#2563EB]/60 hover:bg-[#2563EB]/10' : 'cursor-move'} transition-[border-color] ${drawing ? '' : isSelected ? 'border-2 border-[#2563EB] bg-[#2563EB]/5' : color ? 'border-2' : 'border border-dashed border-white/0 hover:border-[#2563EB]/70'}`}
            style={{ ...pct(rect), ...(isSelected || !color ? {} : { borderColor: `${color}AA` }) }}
            ref={el => { if (el) boxes.current.set(region.id, el); else boxes.current.delete(region.id); }}
            onPointerDown={e => {
              if (drawing) { setSelectedId(null); begin(e, { mode: 'draw', x: e.clientX, y: e.clientY, ...onImage(e), boxId: region.id }); return; }
              // The selected box is moved by its selection frame; another box is picked and dragged at once.
              if (isSelected) { e.stopPropagation(); return; }
              setSelectedId(region.id); begin(e, { mode: 'move', x: e.clientX, y: e.clientY, region });
            }} />
        );
      })}

      {selected && !drawing && boxes.current.get(selected.id) && (
        <Moveable key={selected.id} target={boxes.current.get(selected.id)!} draggable resizable origin={false} keepRatio={false}
          // A box that only carries an underline is lengthened or shortened from its ends.
          renderDirections={selectedMarks.length && selectedMarks.every(m => m.type === 'underline') ? ['w', 'e'] : ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']} throttleDrag={0} throttleResize={0}
          snappable snapThreshold={6} isDisplaySnapDigit={false} elementGuidelines={[...boxes.current.entries()].filter(([id]) => id !== selected.id).map(([, el]) => el)}
          onDrag={e => preview(fromScreen(selected, e.left, e.top, e.width, e.height))}
          onDragEnd={commit}
          // Resizing follows react-moveable's own pattern: the box is sized on screen, then saved once.
          onResizeStart={e => { resizing.current = { width: e.target.style.width, height: e.target.style.height }; }}
          onResize={e => { e.target.style.width = `${e.width}px`; e.target.style.height = `${e.height}px`; e.target.style.transform = e.drag.transform; }}
          onResizeEnd={e => {
            const el = e.target as HTMLElement, rect = el.getBoundingClientRect(), frame = box.current!.getBoundingClientRect();
            Object.assign(el.style, resizing.current ?? {}, { transform: '' });
            resizing.current = null;
            if (e.lastEvent) preview(fromScreen(selected, rect.left - frame.left, rect.top - frame.top, rect.width, rect.height));
            commit();
          }} />
      )}

      {gesture?.mode === 'draw' && draft && 'x' in draft && tool === 'underline' && (() => {
        const rect = regionCanvasRect(draft, fit);
        return <div className="absolute rounded-full pointer-events-none bg-[#D97706] shadow-[0_0_0_2px_white]"
          style={{ left: `${rect.x / canvasWidth * 100}%`, width: `${Math.max(rect.width, 2) / canvasWidth * 100}%`,
            top: `${(rect.y - Math.max(2, 2.5 * scale)) / canvasHeight * 100}%`, height: `${Math.max(4, 5 * scale) / canvasHeight * 100}%` }} />;
      })()}
      {gesture?.mode === 'draw' && draft && 'x' in draft && tool !== 'underline' && (
        <div className="absolute border-2 border-dashed rounded-[3px] pointer-events-none" style={{ ...pct(regionCanvasRect(draft, fit)), borderColor: tool ? ICON[tool]!.color : drawOption ? '#8B1E2D' : '#2563EB' }} />
      )}

      {selected && selectedRect && lineAction && (
        <div role="slider" aria-label="Altı çizgiyi yukarı-aşağı sürükleyin" aria-valuenow={lineAction.lineOffset ?? 0} title="Çizgiyi yukarı-aşağı sürükleyin"
          className="absolute cursor-ns-resize flex items-center"
          style={{ left: pct(selectedRect).left, width: pct(selectedRect).width,
            top: `${(underlineY(selectedRect, scale, underlineOffset + (lineAction.lineOffset ?? 0)) - 8 * scale) / canvasHeight * 100}%`, height: `${16 * scale / canvasHeight * 100}%` }}
          onPointerDown={e => begin(e, { mode: 'line', x: e.clientX, y: e.clientY, action: line!, heightPx: selectedRect.height })}>
          <span className="w-full h-[3px] rounded shadow-[0_0_0_2px_white]" style={{ background: lineAction.color || '#D97706' }} />
        </div>
      )}

      {selected && selectedRect && !gesture && !draft && (
        <div className="absolute w-64 max-w-[70%] rounded-lg bg-white shadow-lg border border-[#D5D4CC] text-xs text-[#33322E] p-2 space-y-1.5"
          style={{ left: `${Math.min(selectedRect.x / canvasWidth * 100, 60)}%`,
            ...(menuBelow ? { top: `calc(${(selectedRect.y + selectedRect.height) / canvasHeight * 100}% + 8px)` }
              : { bottom: `calc(${(1 - selectedRect.y / canvasHeight) * 100}% + 8px)` }) }}
          onPointerDown={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <b className="truncate">{boxName(selected, regions)}</b>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Kapat" className="p-0.5 rounded hover:bg-[#F2F1EB]"><X size={12} /></button>
          </div>
          {onAssignOption && (selected.type.startsWith('option-') || !selected.content) && (
            <div className="flex items-center gap-1" role="group" aria-label="Bu kutu hangi şık?">
              <span className="text-[#787670] mr-auto">Hangi şık?</span>
              {LETTERS.map(letter => {
                const current = selected.id === `option-${letter.toLowerCase()}`;
                return (
                  <button key={letter} type="button" aria-pressed={current} disabled={current}
                    onClick={() => { onAssignOption(selected.id, letter); setSelectedId(`option-${letter.toLowerCase()}`); }}
                    title={current ? `Bu kutu ${letter} şıkkı` : `Bu kutu ${letter} şıkkı: çarpısı ya da tiki sese göre kendiliğinden gelsin`}
                    className={`w-6 h-6 rounded border font-bold ${current ? 'bg-[#8B1E2D] border-[#8B1E2D] text-white' : 'bg-white hover:border-[#8B1E2D] hover:text-[#8B1E2D]'}`}>
                    {letter}
                  </button>
                );
              })}
            </div>
          )}
          {line && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#787670]">Çizgi rengi</span>
              <ColorDots value={line.color || LINE_COLORS[0].color} onPick={color => recolorLines(selected.id, color)} label="Bu çizginin rengi" />
            </div>
          )}
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
          <div className="flex items-center justify-between pt-1 border-t border-[#EFEFEA] text-xs text-[#787670]">
            <span>{line ? 'Çizgiyi yukarı-aşağı sürükleyin · boyu için uçlarındaki tutamakları çekin' : 'Sürükle: taşı · kenar/köşe: boyut'}</span>
            <button type="button" onClick={() => removeBox(selected.id)} className="text-[#8B1E2D] hover:underline shrink-0" title="Delete tuşu">Kutuyu kaldır</button>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => copy(selected)} title="Ctrl+C" className="flex-1 px-2 py-1 rounded border hover:bg-[#F2F1EB] font-semibold">Kopyala</button>
            <button type="button" onClick={paste} disabled={!hasCopy} title="Ctrl+V: kopya biraz yanda çıkar, işaretleri şu andan başlar"
              className="flex-1 px-2 py-1 rounded border hover:bg-[#F2F1EB] font-semibold disabled:opacity-40">Yapıştır</button>
          </div>
        </div>
      )}
    </div>
  );
}
