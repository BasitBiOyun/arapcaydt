import React, { useMemo, useState } from 'react';
import { ArrowCounterClockwise, Microphone, Play, PlusCircle, Stop } from '@phosphor-icons/react';
import type { NarrationWord } from '../../types';
import { alignSolutionNarration } from '../../services/analysis/timelineAligner';
import { PART_CHARS, spokenLength } from '../../services/narration/narrationParts';
import { partRanges, sentenceRanges, spokenSpan, wholeSentences, type TextRange } from '../../services/narration/revoice';

interface Props {
  solutionText: string;
  words: NarrationWord[];
  duration: number;
  /** Passages the voice seems to have skipped (from the timing transcript). */
  skipped: Array<{ text: string; start: number }>;
  audio: React.RefObject<HTMLAudioElement | null>;
  busy: boolean;
  onRevoice: (range: TextRange) => void;
  canUndo: boolean;
  onUndo: () => void;
}

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const short = (text: string, n = 90) => (text.length > n ? `${text.slice(0, n)}…` : text);
/** "2:05", "125" or "2.05" → seconds. */
function seconds(value: string): number | null {
  const m = /^\s*(?:(\d+)\s*[:.,]\s*)?(\d{1,2}(?:[.,]\d+)?)\s*$/.exec(value);
  if (!m) return null;
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2].replace(',', '.'));
}

/**
 * "Sesi düzelt": the teacher re-voices only what went wrong — a skipped sentence, a few
 * sentences picked from the list (or by minute:second), or a whole part of a long solution.
 */
export function RevoicePanel({ solutionText, words, duration, skipped, audio, busy, onRevoice, canUndo, onUndo }: Props) {
  const sentences = useMemo(() => sentenceRanges(solutionText), [solutionText]);
  const parts = useMemo(() => (spokenLength(solutionText) > PART_CHARS ? partRanges(solutionText) : []), [solutionText]);
  const aligned = useMemo(() => alignSolutionNarration(solutionText, words, duration).words, [solutionText, words, duration]);
  const startOf = (r: TextRange) => aligned.find(w => w.sourceStart >= r.from)?.start ?? 0;
  const [pick, setPick] = useState<[number, number] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);

  const chosen: TextRange | null = pick
    ? { from: sentences[pick[0]].from, to: sentences[pick[1]].to, text: solutionText.slice(sentences[pick[0]].from, sentences[pick[1]].to) }
    : null;
  const span = (r: TextRange) => spokenSpan(solutionText, words, duration, r);

  const play = (r: TextRange, key: string) => {
    const el = audio.current, s = span(r);
    if (!el || !s) return;
    if (playing === key) { el.pause(); setPlaying(null); return; }
    el.currentTime = Math.max(0, s.start - 0.3);
    const stopAt = s.end + 0.3;
    const watch = () => { if (el.currentTime >= stopAt || el.paused) { el.pause(); el.removeEventListener('timeupdate', watch); setPlaying(null); } };
    el.addEventListener('timeupdate', watch);
    void el.play();
    setPlaying(key);
  };
  const choose = (i: number) => {
    setNote('');
    setPick(p => (!p ? [i, i] : p[0] === p[1] && p[0] === i ? null : [Math.min(p[0], i), Math.max(p[1], i)]));
  };
  const pickByTime = () => {
    const a = seconds(from), b = seconds(to);
    if (a === null || b === null || b <= a) { setNote('Başlangıç ve bitişi dakika:saniye olarak yazın, örneğin 2:00 ve 2:10.'); return; }
    const hit = sentences.map((s, i) => ({ i, t: span(s) })).filter(x => x.t && x.t.end > a && x.t.start < b).map(x => x.i);
    if (!hit.length) { setNote('Bu aralıkta cümle bulunamadı.'); return; }
    setNote('');
    setPick([hit[0], hit[hit.length - 1]]);
  };
  const tooLong = chosen && spokenLength(chosen.text) > PART_CHARS;

  return (
    <details className="revoice-panel" open={skipped.length > 0 || undefined}>
      <summary>
        <Microphone size={18} /> Sesi düzelt
        <span>Yalnız hatalı yeri yeniden seslendirin</span>
      </summary>
      <p className="revoice-intro">
        Bir cümle yanlış okunduysa ya da atlandıysa bütün sesi baştan üretmeniz gerekmez. Yalnız o yer yeniden seslendirilir
        (1 ses hakkı), sesin geri kalanı ve işaretleriniz olduğu gibi kalır.
      </p>

      {canUndo && (
        <button type="button" className="revoice-undo" disabled={busy} onClick={onUndo}>
          <ArrowCounterClockwise size={16} /> Son düzeltmeyi geri al
        </button>
      )}

      {skipped.length > 0 && (
        <section className="revoice-block revoice-warn">
          <h4>Okunmamış görünen yerler</h4>
          {skipped.map(s => {
            const at = solutionText.indexOf(s.text);
            const target = at >= 0 ? wholeSentences(solutionText, at, at + s.text.length) : null;
            return (
              <div key={`${s.start}-${s.text}`} className="revoice-row">
                <p dir="auto"><span className="revoice-time">{clock(s.start)}</span> “{short(s.text)}”</p>
                {target && (
                  <button type="button" disabled={busy} onClick={() => onRevoice(target)}>
                    <PlusCircle size={16} /> Bu yeri ekle
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {parts.length > 1 && (
        <section className="revoice-block">
          <h4>Bölümler</h4>
          <p className="revoice-hint">Uzun çözüm {parts.length} bölümde seslendirildi. Bir bölüm genel olarak kötüyse yalnız onu yeniden seslendirin.</p>
          {parts.map((p, i) => (
            <div key={p.from} className="revoice-row">
              <p dir="auto"><strong>{i + 1}. bölüm</strong> <span className="revoice-time">{clock(startOf(p))}</span> {short(p.text, 60)}</p>
              <span className="revoice-actions">
                <button type="button" onClick={() => play(p, `part${i}`)} aria-label={`${i + 1}. bölümü dinle`}>
                  {playing === `part${i}` ? <Stop size={16} /> : <Play size={16} />} Dinle
                </button>
                <button type="button" disabled={busy} onClick={() => onRevoice(p)}><Microphone size={16} /> Yeniden seslendir</button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="revoice-block">
        <h4>Cümle seçerek düzeltin</h4>
        <p className="revoice-hint">Yanlış okunan cümleye tıklayın. Birden çok cümle için ilk ve son cümleye tıklamanız yeterli.</p>
        <ol className="revoice-sentences">
          {sentences.map((s, i) => {
            const on = !!pick && i >= pick[0] && i <= pick[1];
            return (
              <li key={s.from}>
                <button type="button" aria-pressed={on} disabled={busy} onClick={() => choose(i)}>
                  <span className="revoice-time">{clock(startOf(s))}</span>
                  <span dir="auto">{s.text}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {chosen && (
          <div className="revoice-chosen" role="region" aria-label="Seçili yer">
            <p dir="auto"><strong>Seçili:</strong> “{short(chosen.text, 140)}”</p>
            {tooLong && <p className="revoice-note">Seçim çok uzun. En fazla {PART_CHARS.toLocaleString('tr')} karakter seçin ya da bölümü yeniden seslendirin.</p>}
            <span className="revoice-actions">
              <button type="button" onClick={() => play(chosen, 'chosen')}>{playing === 'chosen' ? <Stop size={16} /> : <Play size={16} />} Dinle</button>
              <button type="button" className="primary" disabled={busy || !!tooLong} onClick={() => onRevoice(chosen)}>
                <Microphone size={16} /> Seçili yeri yeniden seslendir
              </button>
              <button type="button" disabled={busy} onClick={() => setPick(null)}>Seçimi kaldır</button>
            </span>
          </div>
        )}
        <div className="revoice-time-pick">
          <span>ya da zamanla seçin:</span>
          <input aria-label="Başlangıç (dakika:saniye)" placeholder="2:00" value={from} onChange={e => setFrom(e.target.value)} />
          <span>–</span>
          <input aria-label="Bitiş (dakika:saniye)" placeholder="2:10" value={to} onChange={e => setTo(e.target.value)} />
          <button type="button" disabled={busy} onClick={pickByTime}>Seç</button>
        </div>
        {note && <p role="alert" className="revoice-note">{note}</p>}
      </section>

    </details>
  );
}
