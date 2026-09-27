import React, { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, CaretLeft, CaretRight, SpeakerHigh, Trash } from '@phosphor-icons/react';
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
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();
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
  const button = 'px-2 py-1 rounded border border-[#D5D4CC] bg-white hover:bg-[#F2F1EB] text-[11px] font-semibold text-[#33322E] flex items-center gap-1 cursor-pointer';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#666560]">
          Her işareti “Dinle” ile kontrol edin. Ses ile işaret uyuşmuyorsa “Biraz erken” veya “Biraz geç” ile {NUDGE_SECONDS.toLocaleString('tr')} saniye kaydırın.
        </p>
        <button type="button" className={button} disabled={!undo.length} onClick={back} style={{ opacity: undo.length ? 1 : .5 }}>
          <ArrowCounterClockwise size={13} /> Geri al
        </button>
      </div>
      {!cues.length && <p className="text-[11px] text-[#787670]">Bu soruda kontrol edilecek işaret yok.</p>}
      <ol className="divide-y divide-[#EFEFEA] border border-[#E5E4DC] rounded-lg bg-white">
        {cues.map(cue => {
          const kind = KIND[cue.type]!;
          const active = currentTime >= cue.start && currentTime < cue.start + Math.min(cue.duration, 1.5);
          return (
            <li key={cue.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${active ? 'bg-[#FAF5E6]' : ''}`}>
              <span aria-hidden className="w-5 text-center font-bold" style={{ color: kind.color }}>{kind.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#1C1917] truncate">{cueTitle(cue, regions)}</p>
                {cuePhrase(cue) && <p className="text-[11px] text-[#787670] truncate">“{cuePhrase(cue)}”</p>}
              </div>
              <span className="font-mono-code text-[11px] text-[#55544F] w-14 text-right">{seconds(cue.start)}</span>
              <button type="button" className={button} onClick={() => listen(cue.start)} aria-label={`${cueTitle(cue, regions)}: dinle`}>
                <SpeakerHigh size={13} /> Dinle
              </button>
              <button type="button" className={button} onClick={() => nudge(cue.id, -NUDGE_SECONDS)} aria-label={`${cueTitle(cue, regions)}: biraz erken`}>
                <CaretLeft size={13} /> Biraz erken
              </button>
              <button type="button" className={button} onClick={() => nudge(cue.id, NUDGE_SECONDS)} aria-label={`${cueTitle(cue, regions)}: biraz geç`}>
                Biraz geç <CaretRight size={13} />
              </button>
              <button type="button" className={`${button} text-[#8B1E2D]`} onClick={() => remove(cue.id)} aria-label={`${cueTitle(cue, regions)}: kaldır`}>
                <Trash size={13} /> Kaldır
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
