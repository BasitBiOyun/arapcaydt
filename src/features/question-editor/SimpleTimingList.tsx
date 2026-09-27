import React, { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, CaretDown, CaretLeft, CaretRight, SpeakerHigh, Trash } from '@phosphor-icons/react';
import type { AnnotationRegion, VideoAction } from '../../types';
import { nudgeAction } from './workflow';

/** How far one "Biraz erken / Biraz geç" click moves a cue. */
export const NUDGE_SECONDS = 0.3;
/** "Dinle" starts this much before the cue and plays this long. */
const LEAD_IN = 1.5, LISTEN_FOR = 3.5;

const KIND: Partial<Record<VideoAction['type'], { icon: string; title: (target: string) => string; color: string }>> = {
  reject: { icon: '✗', title: t => `${t} elenir`, color: '#8B1E2D' },
  correct: { icon: '✓', title: t => `${t}: doğru cevap`, color: '#15803D' },
  focus: { icon: '◎', title: t => `Odak: ${t}`, color: '#4338CA' },
  underline: { icon: '▁', title: t => `Altı çizilir: ${t}`, color: '#0369A1' },
  highlight: { icon: '▮', title: t => `Vurgu: ${t}`, color: '#B45309' },
};

/** Cues a teacher checks by ear, in playback order (background effects such as dimming are left out). */
export function listedCues(actions: VideoAction[]): VideoAction[] {
  return actions.filter(a => KIND[a.type]).sort((a, b) => a.start - b.start);
}

export function cueTitle(action: VideoAction, regions: AnnotationRegion[]): string {
  const region = regions.find(r => r.id === action.targetRegionId);
  const option = /^option-([a-e])$/.exec(action.targetRegionId);
  const target = option ? `${option[1].toUpperCase()} şıkkı`
    : (region?.content || region?.label || 'Seçili alan').replace(/\s+/g, ' ').trim().slice(0, 40);
  return KIND[action.type]?.title(target) ?? target;
}

/** The phrase in the solution that triggers the cue ("reject: C şıkkı yanlış" → "C şıkkı yanlış"). */
/** One line for the closed list: "3 şık elenir · 1 doğru cevap · 2 vurgu". */
export function cueSummary(cues: VideoAction[]): string {
  const count = (types: VideoAction['type'][]) => cues.filter(c => types.includes(c.type)).length;
  return [
    [count(['reject']), 'şık elenir'], [count(['correct']), 'doğru cevap'],
    [count(['focus', 'underline', 'highlight']), 'vurgu'],
  ].filter(([n]) => n).map(([n, label]) => `${n} ${label}`).join(' · ');
}

const cuePhrase = (action: VideoAction) => (action.label || '').replace(/^[a-z-]+:\s*/, '').slice(0, 60);

const seconds = (t: number) => `${t.toLocaleString('tr', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sn`;

interface Props {
  actions: VideoAction[];
  regions: AnnotationRegion[];
  duration: number;
  currentTime: number;
  onUpdateActions: (actions: VideoAction[]) => void;
  onSeek: (time: number) => void;
  setPlaying: (playing: boolean) => void;
}

/**
 * Teacher-friendly timing check: one line per mark with Listen, a little
 * earlier / later and remove. The full timeline stays under "Gelişmiş".
 */
export function SimpleTimingList({ actions, regions, duration, currentTime, onUpdateActions, onSeek, setPlaying }: Props) {
  const [undo, setUndo] = useState<VideoAction[][]>([]);
  const [open, setOpen] = useState(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(stopTimer.current), []);
  const total = Math.max(1, duration);

  const listen = (at: number) => {
    clearTimeout(stopTimer.current);
    onSeek(Math.max(0, at - LEAD_IN));
    setPlaying(true);
    stopTimer.current = setTimeout(() => setPlaying(false), LISTEN_FOR * 1000);
  };
  const change = (next: VideoAction[]) => { setUndo(h => [...h.slice(-29), actions]); onUpdateActions(next); };
  const nudge = (id: string, delta: number) => {
    const moved = actions.map(a => a.id === id ? nudgeAction(a, delta, total) : a);
    change(moved);
    const cue = moved.find(a => a.id === id);
    if (cue) listen(cue.start);
  };
  const remove = (id: string) => change(actions.filter(a => a.id !== id));
  const back = () => { const previous = undo.at(-1); if (previous) { onUpdateActions(previous); setUndo(undo.slice(0, -1)); } };

  const cues = listedCues(actions);
  const button = 'px-2.5 py-1.5 rounded-lg border bg-white hover:bg-[#F2F1EB] text-xs font-semibold text-[#33322E] inline-flex items-center gap-1 transition-colors';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[#666560]">{cues.length ? `${cues.length} işaret: ${cueSummary(cues)}` : 'İşaret yok'}</p>
        <button type="button" className={button} disabled={!undo.length} onClick={back} style={{ opacity: undo.length ? 1 : .45 }}>
          <ArrowCounterClockwise size={13} /> Geri al
        </button>
      </div>
      {!cues.length && <p className="text-xs text-[#787670]">Bu soruda kontrol edilecek işaret yok.</p>}
      {cues.length > 0 && <details open={open} onToggle={e => setOpen(e.currentTarget.open)} className="group border rounded-xl bg-white overflow-hidden">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-3 py-2.5 flex items-center justify-between gap-2 text-sm font-semibold text-[#33322E] hover:bg-[#FAF9F5]">
        <span>{open ? 'Listeyi kapat' : 'İşaretleri tek tek kontrol et'}</span>
        <CaretDown size={14} weight="bold" className="transition-transform group-open:rotate-180" />
      </summary>
      <ol className="divide-y divide-[#EFEFEA] border-t border-[#EFEFEA]">
        {cues.map(cue => {
          const kind = KIND[cue.type]!;
          const title = cueTitle(cue, regions);
          const active = currentTime >= cue.start && currentTime < cue.start + Math.min(cue.duration, 1.5);
          return (
            <li key={cue.id} className={`px-3 py-2.5 space-y-2 transition-colors ${active ? 'bg-[#FAF5E6]' : ''}`}>
              <div className="flex items-start gap-2">
                <span aria-hidden className="w-5 text-center font-bold leading-5" style={{ color: kind.color }}>{kind.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1C1917] truncate">{title}</p>
                  {cuePhrase(cue) && <p className="text-xs text-[#787670] truncate">“{cuePhrase(cue)}”</p>}
                </div>
                <span className="font-mono-code text-xs text-[#55544F] whitespace-nowrap leading-5">{seconds(cue.start)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-7">
                <button type="button" className={button} onClick={() => listen(cue.start)} aria-label={`${title}: dinle`}>
                  <SpeakerHigh size={13} /> Dinle
                </button>
                <button type="button" className={button} onClick={() => nudge(cue.id, -NUDGE_SECONDS)} aria-label={`${title}: biraz erken`} title={`${NUDGE_SECONDS.toLocaleString('tr')} sn erkene al`}>
                  <CaretLeft size={13} /> Erken
                </button>
                <button type="button" className={button} onClick={() => nudge(cue.id, NUDGE_SECONDS)} aria-label={`${title}: biraz geç`} title={`${NUDGE_SECONDS.toLocaleString('tr')} sn geçe al`}>
                  Geç <CaretRight size={13} />
                </button>
                <button type="button" className={`${button} text-[#8B1E2D] ml-auto`} onClick={() => remove(cue.id)} aria-label={`${title}: kaldır`} title="İşareti kaldır">
                  <Trash size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      </details>}
    </div>
  );
}
