import React, { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, CaretDown, CaretLeft, CaretRight, MapPin, SpeakerHigh, Trash } from '@phosphor-icons/react';
import type { AnnotationRegion, VideoAction } from '../../types';
import { clock, nudgeAction } from './workflow';
import { underlineDrawTime } from '../video/engine/timeline';

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
/** Options on the image with neither a cross nor the answer tick: candidates for "Çarpı ekle". */
export function unmarkedOptions(actions: VideoAction[], regions: AnnotationRegion[]): string[] {
  const marked = new Set(actions.filter(a => a.type === 'reject' || a.type === 'correct').map(a => a.targetRegionId));
  return regions.filter(r => /^option-[a-e]$/.test(r.id) && !marked.has(r.id)).map(r => r.id).sort();
}

/** A cross from the given moment to the end, like the ones made from the narration. */
export function manualCross(regionId: string, at: number, total: number): VideoAction {
  const start = Math.max(0, Math.min(total - .1, at));
  return { id: `manual-${regionId}-${Math.round(start * 1000)}`, type: 'reject', targetRegionId: regionId, start, startTime: start, duration: total - start, label: 'reject: elle eklendi' };
}

/** How long an underline stays, chosen by the teacher. */
export const UNDERLINE_STAYS = [1, 2, 3, 5, 8];
/** One "Yukarı / Aşağı" click moves a line by this share of its text line. */
export const LINE_STEP = .15;

/** Stays for `seconds` (never past the end); an underline is drawn over that time. */
export function withStay(action: VideoAction, seconds: number, total: number): VideoAction {
  return { ...action, duration: Math.max(.3, Math.min(seconds, total - action.start)) };
}
export const withLineOffset = (action: VideoAction, delta: number): VideoAction =>
  ({ ...action, lineOffset: Math.round(Math.max(-1.5, Math.min(1.5, (action.lineOffset ?? 0) + delta)) * 100) / 100 });

/** One line for the closed list: "3 şık elenir · 1 doğru cevap · 2 vurgu". */
export function cueSummary(cues: VideoAction[]): string {
  const count = (types: VideoAction['type'][]) => cues.filter(c => types.includes(c.type)).length;
  return [
    [count(['reject']), 'şık elenir'], [count(['correct']), 'doğru cevap'],
    [count(['focus', 'underline', 'highlight']), 'vurgu'],
  ].filter(([n]) => n).map(([n, label]) => `${n} ${label}`).join(' · ');
}

const cuePhrase = (action: VideoAction) => (action.label || '').replace(/^[a-z-]+:\s*/, '').slice(0, 60);

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
  // Show a frame without playing: moving a mark never makes the preview jump and play on its own.
  const show = (at: number) => { clearTimeout(stopTimer.current); setPlaying(false); onSeek(at); };
  const move = (id: string, delta: number) => {
    const moved = actions.map(a => a.id === id ? nudgeAction(a, delta, total) : a);
    change(moved);
    const cue = moved.find(a => a.id === id);
    if (cue) show(cue.start);
  };
  /** "Buraya al": the mark starts at the paused preview's current moment. */
  const moveHere = (cue: VideoAction) => move(cue.id, currentTime - cue.start);
  const addCross = (regionId: string) => { const cross = manualCross(regionId, currentTime, total); change([...actions, cross]); show(cross.start); };
  const unmarked = unmarkedOptions(actions, regions);
  const remove = (id: string) => change(actions.filter(a => a.id !== id));
  const update = (cue: VideoAction, next: VideoAction) => { change(actions.map(a => a.id === cue.id ? next : a)); show(cue.start + (next.type === 'underline' ? underlineDrawTime(next.duration) : Math.min(next.duration, .7))); };
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
      <p className="px-3 py-2 border-t border-[#EFEFEA] bg-[#FAF9F5] text-xs text-[#55544F] leading-relaxed">
        Önizlemeyi işaretin çıkması gereken anda durdurun ve <b>Buraya al</b>’a basın. İnce ayar için <b>Erken/Geç</b> ({NUDGE_SECONDS.toLocaleString('tr')} sn).
        <span className="block mt-0.5">Önizleme şu an: <b className="font-mono-code text-[#1C1917]">{clock(currentTime)}</b></span>
      </p>
      {unmarked.length > 0 && (
        <div className="px-3 py-2 border-t border-[#EFEFEA] flex flex-wrap items-center gap-1.5 text-xs text-[#55544F]">
          <span>İşaretsiz şık:</span>
          {unmarked.map(id => (
            <button key={id} type="button" className={`${button} text-[#8B1E2D]`} onClick={() => addCross(id)}
              title={`${clock(currentTime)} anından itibaren çarpı çiz`}>
              ✗ {id.slice(-1).toUpperCase()} şıkkına buradan çarpı ekle
            </button>
          ))}
        </div>
      )}
      <ol className="divide-y divide-[#EFEFEA] border-t border-[#EFEFEA]">
        {cues.map(cue => {
          const kind = KIND[cue.type]!;
          const title = cueTitle(cue, regions);
          const active = currentTime >= cue.start && currentTime < cue.start + Math.min(cue.duration, 1.5);
          return (
            <li key={cue.id} className={`px-3 py-2.5 space-y-2 transition-colors ${active ? 'bg-[#FAF5E6]' : ''}`}>
              <div className="flex items-start gap-2">
                <span aria-hidden className="w-5 text-center font-bold leading-5" style={{ color: kind.color }}>{kind.icon}</span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => show(cue.start)} title="Önizlemede bu işaretin anına git">
                  <p className="text-sm font-semibold text-[#1C1917] truncate">{title}</p>
                  {cuePhrase(cue) && <p className="text-xs text-[#787670] truncate">“{cuePhrase(cue)}”</p>}
                </button>
                <span className="font-mono-code text-xs text-[#55544F] whitespace-nowrap leading-5">{clock(cue.start)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-7">
                <button type="button" className={button} onClick={() => listen(cue.start)} aria-label={`${title}: dinle`}>
                  <SpeakerHigh size={13} /> Dinle
                </button>
                <button type="button" className={button} onClick={() => move(cue.id, -NUDGE_SECONDS)} aria-label={`${title}: biraz erken`} title={`${NUDGE_SECONDS.toLocaleString('tr')} sn erkene al`}>
                  <CaretLeft size={13} /> Erken
                </button>
                <button type="button" className={button} onClick={() => move(cue.id, NUDGE_SECONDS)} aria-label={`${title}: biraz geç`} title={`${NUDGE_SECONDS.toLocaleString('tr')} sn geçe al`}>
                  Geç <CaretRight size={13} />
                </button>
                <button type="button" className={button} onClick={() => moveHere(cue)} disabled={Math.abs(currentTime - cue.start) < .05}
                  style={{ opacity: Math.abs(currentTime - cue.start) < .05 ? .45 : 1 }} aria-label={`${title}: buraya al`} title={`İşareti ${clock(currentTime)} anına taşı`}>
                  <MapPin size={13} /> Buraya al
                </button>
                {cue.type === 'underline' && <>
                  <label className="inline-flex items-center gap-1 text-xs text-[#55544F]">Kalsın
                    <select className="border rounded-lg px-1.5 py-1 bg-white text-xs" value={UNDERLINE_STAYS.includes(Math.round(cue.duration)) ? Math.round(cue.duration) : ''}
                      onChange={e => update(cue, withStay(cue, Number(e.target.value), total))} aria-label={`${title}: ne kadar kalsın`}>
                      {!UNDERLINE_STAYS.includes(Math.round(cue.duration)) && <option value="">{cue.duration.toLocaleString('tr', { maximumFractionDigits: 1 })} sn</option>}
                      {UNDERLINE_STAYS.map(s => <option key={s} value={s}>{s} sn</option>)}
                    </select>
                  </label>
                  <button type="button" className={button} onClick={() => update(cue, withLineOffset(cue, -LINE_STEP))} aria-label={`${title}: çizgiyi yukarı al`} title="Çizgiyi biraz yukarı al">↑ Çizgi</button>
                  <button type="button" className={button} onClick={() => update(cue, withLineOffset(cue, LINE_STEP))} aria-label={`${title}: çizgiyi aşağı al`} title="Çizgiyi biraz aşağı al">↓ Çizgi</button>
                </>}
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
