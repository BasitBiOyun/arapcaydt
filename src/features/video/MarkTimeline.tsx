import React, { useEffect, useRef, useState } from 'react';
import type { AnnotationRegion, VideoAction } from '../../types';
import { adjacentAction, clock, isTypingTarget, nudgeAction } from '../question-editor/workflow';
import { fitSteps } from './engine/timeline';

const MARK: Partial<Record<VideoAction['type'], { icon: string; color: string; name: string }>> = {
  reject: { icon: '✗', color: '#8B1E2D', name: 'Çarpı' }, correct: { icon: '✓', color: '#15803D', name: 'Doğru' },
  focus: { icon: '◎', color: '#4338CA', name: 'Çerçeve' }, underline: { icon: '▁', color: '#D97706', name: 'Altı çizgi' },
  highlight: { icon: '▮', color: '#B45309', name: 'Vurgu' },
};
/** Crosses and ticks stay to the end of the video: only their start moves. */
const lasting = (a: VideoAction) => a.type === 'reject' || a.type === 'correct';
const MIN_SECONDS = .3;
const LANE = 24, RULER = 16, WAVE = 36;

/** Marks shown on the strip, in time order. */
export const stripMarks = (actions: VideoAction[]) => actions.filter(a => MARK[a.type]).sort((a, b) => a.start - b.start);

const pillSeconds = (mark: VideoAction, minSeconds: number) => lasting(mark) ? minSeconds : Math.max(minSeconds, mark.duration);
/** Where a pill is drawn: at its start, pulled left near the end so it never sticks out of the strip. */
export const pillStart = (mark: VideoAction, minSeconds: number, total: number) =>
  Math.max(0, Math.min(mark.start, total - pillSeconds(mark, minSeconds)));

/** Rows so no two marks overlap on screen; a pill is at least `minSeconds` wide and stays within `total`. */
export function laneLayout(marks: VideoAction[], minSeconds: number, total = Infinity): Map<string, number> {
  const ends: number[] = [];
  const lanes = new Map<string, number>();
  for (const mark of marks) {
    const start = pillStart(mark, minSeconds, total);
    let lane = ends.findIndex(end => end <= start + 1e-9);
    if (lane < 0) { lane = ends.length; ends.push(0); }
    ends[lane] = start + pillSeconds(mark, minSeconds);
    lanes.set(mark.id, lane);
  }
  return lanes;
}

export type PillDrag = 'move' | 'start' | 'end';
/** A pill dragged by `delta` seconds: moved whole, or its start / end edge (the other edge stays). */
export function dragPill(action: VideoAction, mode: PillDrag, delta: number, total: number): VideoAction {
  if (mode === 'move' || lasting(action)) return nudgeAction(action, delta, total);
  const end = action.start + action.duration;
  if (mode === 'start') {
    const start = Math.max(0, Math.min(end - MIN_SECONDS, action.start + delta));
    return fitDraw({ ...action, start, startTime: start, duration: end - start }, start - action.start);
  }
  return fitDraw({ ...action, duration: Math.max(MIN_SECONDS, Math.min(total - action.start, action.duration + delta)) }, 0);
}
/** An underline is drawn within its own time on screen; its word steps stay on their words when the start moves. */
function fitDraw(a: VideoAction, shift: number): VideoAction {
  if (a.type !== 'underline') return a;
  const maxDraw = Math.max(.2, a.duration - .2);
  if (a.drawSteps?.length) {
    const drawSteps = fitSteps(a.drawSteps, shift, maxDraw);
    return { ...a, drawSteps, drawDuration: Math.max(.05, drawSteps.at(-1)!.at) };
  }
  return a.drawDuration !== undefined ? { ...a, drawDuration: Math.min(a.drawDuration, maxDraw) } : a;
}

const peaksCache = new Map<string, number[]>();
/** Loudness outline of the narration (200 bars), decoded once per audio file. */
function usePeaks(audioUrl?: string): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(audioUrl ? peaksCache.get(audioUrl) ?? null : null);
  useEffect(() => {
    if (!audioUrl) { setPeaks(null); return; }
    if (peaksCache.has(audioUrl)) { setPeaks(peaksCache.get(audioUrl)!); return; }
    let live = true;
    (async () => {
      try {
        const bytes = await (await fetch(audioUrl)).arrayBuffer();
        const context = new AudioContext();
        const buffer = await context.decodeAudioData(bytes);
        void context.close();
        const data = buffer.getChannelData(0), bars = 200, size = Math.max(1, Math.floor(data.length / bars));
        const values = Array.from({ length: bars }, (_, i) => {
          let peak = 0;
          for (let j = i * size; j < Math.min(data.length, (i + 1) * size); j += 8) peak = Math.max(peak, Math.abs(data[j]));
          return peak;
        });
        const top = Math.max(...values, .01);
        const result = values.map(v => v / top);
        peaksCache.set(audioUrl, result);
        if (live) setPeaks(result);
      } catch { /* the strip works without the outline */ }
    })();
    return () => { live = false; };
  }, [audioUrl]);
  return peaks;
}

interface Props {
  actions: VideoAction[];
  regions: AnnotationRegion[];
  duration: number;
  currentTime: number;
  audioUrl?: string;
  onSeek: (time: number) => void;
  onPlayPause: () => void;
  onActions: (actions: VideoAction[]) => void;
  /** Space, arrows and Delete work only while this editor is on screen. */
  keyboard?: boolean;
}

/**
 * The narration as a strip with every mark on it: click to jump, drag a mark to change
 * when it appears, drag its edge to change how long it stays. Crosses and ticks stay to
 * the end, so only their start moves.
 */
export function MarkTimeline({ actions, regions, duration, currentTime, audioUrl, onSeek, onPlayPause, onActions, keyboard }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; mode: PillDrag; x: number; moved: boolean } | null>(null);
  const [draft, setDraft] = useState<VideoAction | null>(null);
  /** The playhead follows the pointer while the strip is held down. */
  const scrubbing = useRef(false);
  const peaks = usePeaks(audioUrl);
  const total = Math.max(1, duration);
  const marks = stripMarks(actions).map(a => draft && a.id === draft.id ? draft : a);
  const minSeconds = total * .045;
  const lanes = laneLayout(marks, minSeconds, total);
  const laneCount = Math.max(1, ...[...lanes.values()].map(l => l + 1));
  const at = (t: number) => `${Math.max(0, Math.min(100, t / total * 100))}%`;
  const secondsPerPx = () => total / (strip.current?.clientWidth || 1);

  const label = (a: VideoAction) => {
    const option = /^option-([a-e])$/.exec(a.targetRegionId);
    if (option) return option[1].toUpperCase();
    const region = regions.find(r => r.id === a.targetRegionId);
    return (region?.content || region?.label || '').replace(/\s+/g, ' ').trim().slice(0, 14);
  };

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === ' ' || e.code === 'Space') {
        if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
        e.preventDefault(); onPlayPause(); return;
      }
      const selected = actions.find(a => a.id === selectedId);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault(); onActions(actions.filter(a => a.id !== selected.id)); setSelectedId(null); return;
      }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const direction = e.key === 'ArrowRight' ? 1 : -1;
      if (e.shiftKey && selected) {
        const moved = nudgeAction(selected, direction * .1, total);
        onActions(actions.map(a => a.id === selected.id ? moved : a)); onSeek(moved.start); return;
      }
      const next = adjacentAction(stripMarks(actions), currentTime, direction);
      if (next) { setSelectedId(next.id); onSeek(next.start); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const begin = (e: React.PointerEvent, id: string, mode: PillDrag) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, mode, x: e.clientX, moved: false });
  };
  const timeAt = (e: React.PointerEvent) => {
    const bounds = strip.current!.getBoundingClientRect();
    return Math.max(0, Math.min(total, (e.clientX - bounds.left) / bounds.width * total));
  };
  const move = (e: React.PointerEvent) => {
    if (scrubbing.current) { onSeek(timeAt(e)); return; }
    if (!drag) return;
    const action = actions.find(a => a.id === drag.id);
    if (!action || Math.abs(e.clientX - drag.x) < 3 && !drag.moved) return;
    if (!drag.moved) setDrag({ ...drag, moved: true });
    const delta = Math.round((e.clientX - drag.x) * secondsPerPx() * 10) / 10;
    setDraft(dragPill(action, drag.mode, delta, total));
  };
  const end = () => {
    scrubbing.current = false;
    if (!drag) return;
    const action = actions.find(a => a.id === drag.id);
    if (drag.moved && draft) { onActions(actions.map(a => a.id === draft.id ? draft : a)); onSeek(draft.start); }
    else if (action) { setSelectedId(action.id); onSeek(action.start); }
    setDrag(null); setDraft(null);
  };
  const seekAt = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrubbing.current = true;
    onSeek(timeAt(e));
    setSelectedId(null);
  };

  const step = total <= 20 ? 2 : total <= 60 ? 5 : total <= 180 ? 15 : 30;
  const selected = marks.find(a => a.id === selectedId);

  return (
    <div className="rounded-xl border border-[#E5E4DC] bg-white p-3 space-y-2 select-none">
      <div className="flex items-center justify-between gap-2 text-xs">
        <p className="text-[#55544F]">
          <b className="text-[#1C1917]">Zaman şeridi</b> · işareti sürükleyin: ne zaman çıksın · kenarından çekin: ne kadar kalsın · boş yeri basılı tutup kaydırın: sarın
        </p>
        {selected && (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span style={{ color: MARK[selected.type]!.color }} className="font-semibold">{MARK[selected.type]!.name} {label(selected)}</span>
            <span className="font-mono-code text-[#55544F]">{clock(selected.start)}{lasting(selected) ? '' : ` · ${selected.duration.toLocaleString('tr', { maximumFractionDigits: 1 })} sn`}</span>
            <button type="button" className="px-2 py-0.5 rounded border text-[#8B1E2D] hover:bg-red-50"
              onClick={() => { onActions(actions.filter(a => a.id !== selected.id)); setSelectedId(null); }}>Sil</button>
          </span>
        )}
      </div>
      <div ref={strip} className="relative cursor-pointer" style={{ height: RULER + WAVE + laneCount * LANE + 4 }}
        onPointerDown={seekAt} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step).map(t => (
          <span key={t} className={`absolute top-0 text-[10px] text-[#A8A69E] font-mono-code ${t === 0 ? "" : "-translate-x-1/2"}`} style={{ left: at(t) }}>{clock(t).replace(/,\d$/, '')}</span>
        ))}
        <div className="absolute left-0 right-0 flex items-center gap-px rounded bg-[#FAF9F5]" style={{ top: RULER, height: WAVE }}>
          {(peaks || Array.from({ length: 200 }, () => .15)).map((v, i) => (
            <span key={i} className="flex-1 rounded-full" style={{ height: `${Math.max(6, v * 100)}%`, background: i / 200 * total <= currentTime ? '#8B1E2D66' : '#D5D4CC' }} />
          ))}
        </div>
        {marks.map(mark => {
          const style = MARK[mark.type]!;
          const width = pillSeconds(mark, minSeconds);
          const isSelected = mark.id === selectedId;
          return (
            <React.Fragment key={mark.id}>
              {lasting(mark) && <span className="absolute h-px pointer-events-none" style={{ left: at(mark.start), right: 0, top: RULER + WAVE + 4 + lanes.get(mark.id)! * LANE + 10, background: `${style.color}55` }} />}
              <div role="button" aria-label={`${style.name} ${label(mark)} · ${clock(mark.start)}`} title={`${style.name} ${label(mark)} · ${clock(mark.start)} — sürükleyin`}
                className={`absolute h-5 rounded-full text-[11px] font-semibold text-white flex items-center gap-1 px-1.5 overflow-hidden cursor-grab active:cursor-grabbing shadow-xs ${isSelected ? 'ring-2 ring-offset-1 ring-[#2563EB]' : ''}`}
                style={{ left: `min(${at(pillStart(mark, minSeconds, total))}, calc(100% - max(26px, ${width / total * 100}%)))`, width: `max(26px, ${width / total * 100}%)`, top: RULER + WAVE + 4 + lanes.get(mark.id)! * LANE, background: style.color }}
                onPointerDown={e => begin(e, mark.id, 'move')}>
                {!lasting(mark) && <span className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize" onPointerDown={e => begin(e, mark.id, 'start')} />}
                <span>{style.icon}</span><span className="truncate">{label(mark)}</span>
                {!lasting(mark) && <span className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30" onPointerDown={e => begin(e, mark.id, 'end')} />}
              </div>
            </React.Fragment>
          );
        })}
        <span className="absolute top-0 bottom-0 w-0.5 -ml-px bg-[#8B1E2D] pointer-events-none" style={{ left: at(currentTime) }}>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#8B1E2D] shadow" />
        </span>
      </div>
      {keyboard && <p className="text-[10px] text-[#A8A69E]">Boşluk: oynat/durdur · ←/→: önceki/sonraki işaret · Shift+←/→: seçili işareti 0,1 sn kaydır · Delete: sil</p>}
    </div>
  );
}
