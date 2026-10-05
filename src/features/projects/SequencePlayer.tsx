import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CaretLeft, CaretRight, Flag, PencilSimple, X } from '@phosphor-icons/react';
import type { QuestionProject } from '../../types';
import { VideoPreviewCanvas } from '../video/VideoPreviewCanvas';
import { outroSeconds } from '../video/engine/renderer';
import { projectRepository } from './projectRepository';

/** Seconds between one finished video and the next. */
const GAP_MS = 1200;

/**
 * "Arka arkaya izle": the chosen questions play one after another as their videos will look,
 * so a whole deneme is checked in one sitting. A question can be flagged "Düzeltilecek"; the
 * flagged ones are listed at the end, each with a button that opens it in the editor.
 */
export function SequencePlayer({ ids, titles, onClose, onOpen }: {
  ids: string[];
  titles: Record<string, string>;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [project, setProject] = useState<QuestionProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** Playing starts with the teacher's click (browsers allow sound only then); afterwards each video starts by itself. */
  const [started, setStarted] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const timeRef = useRef(0);
  timeRef.current = time;

  const id = ids[index];
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(''); setProject(null); setTime(0); setPlaying(false);
    projectRepository.getById(id)
      .then(p => { if (!active) return; if (!p) setFailed('Soru açılamadı.'); setProject(p); })
      .catch(() => { if (active) setFailed('Soru yüklenemedi. İnternet bağlantınızı kontrol edin.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const audio = project ? project.narrationSource || project.audioNarration : undefined;
  const playable = !!(project?.imageUrl && audio?.audioUrl && project.videoConfig.timelineActions?.length);
  const duration = audio?.duration || 0;
  const total = project ? duration + outroSeconds(project.videoConfig.timelineActions, project.videoConfig.showOutro !== false) : 0;

  const go = useCallback((next: number) => {
    if (next >= ids.length) { setPlaying(false); setFinished(true); return; }
    setIndex(Math.max(0, next));
  }, [ids.length]);
  // Each video starts by itself once the teacher has pressed play.
  useEffect(() => { if (started && playable && !loading) setPlaying(true); }, [started, playable, loading, id]);
  // A question that cannot play is skipped after a moment while the sequence is running.
  useEffect(() => {
    if (!started || loading || playable) return;
    const timer = setTimeout(() => go(index + 1), GAP_MS * 2);
    return () => clearTimeout(timer);
  }, [started, loading, playable, index, go]);

  const ended = useRef(false);
  const playPause = () => {
    // The preview stops itself at the end: that is the cue for the next question.
    if (playing && timeRef.current >= total - .3) { ended.current = true; setPlaying(false); return; }
    // The narration's own end while the closing card is still to come: keep playing.
    if (playing && total > duration && timeRef.current >= duration - .3) return;
    if (!started) setStarted(true);
    setPlaying(p => !p);
  };
  useEffect(() => {
    if (!ended.current || playing) return;
    ended.current = false;
    const timer = setTimeout(() => go(index + 1), GAP_MS);
    return () => clearTimeout(timer);
  }, [playing, index, go]);

  const toggleFlag = () => setFlagged(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const list = ids.filter(i => flagged.has(i));
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="sequence-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl p-4 sm:p-5 space-y-3 max-h-[96vh] overflow-y-auto">
        <header className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 id="sequence-title" className="text-lg font-bold truncate">
              {finished ? 'İzleme bitti' : `${index + 1} / ${ids.length} · ${project?.title || titles[id] || ''}`}
            </h3>
            {!finished && <p className="text-xs text-[#787670]">Videolar indirileceği gibi oynar; biri bitince sıradaki kendiliğinden başlar. Hatalı gördüğünüz soruyu “Düzeltilecek” diye işaretleyin.</p>}
          </div>
          <button type="button" className="studio-secondary" onClick={onClose} aria-label="Kapat"><X size={16} /> Kapat</button>
        </header>

        {finished ? (
          <div className="space-y-3 text-sm">
            <p>{ids.length} soru izlendi. {list.length ? `${list.length} soru düzeltilecek:` : 'Düzeltilecek soru işaretlemediniz.'}</p>
            {list.length > 0 && (
              <ul className="divide-y divide-[#EFEFEA] border border-[#EFEFEA] rounded">
                {list.map(i => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1 min-w-0 truncate">{titles[i] || 'Soru'}</span>
                    <button type="button" className="studio-secondary" onClick={() => onOpen(i)}>Aç <ArrowRight size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="studio-secondary" onClick={() => { setFinished(false); setStarted(false); setIndex(0); }}>Baştan izle</button>
          </div>
        ) : (
          <>
            {loading ? <div className="aspect-video rounded-xl bg-[#F2F1EB] flex items-center justify-center text-sm text-[#787670]">Soru yükleniyor…</div>
              : failed ? <div className="aspect-video rounded-xl bg-[#F2F1EB] flex items-center justify-center text-sm text-red-700">{failed}</div>
              : !playable || !project ? (
                <div className="aspect-video rounded-xl bg-[#F2F1EB] flex flex-col gap-2 items-center justify-center text-sm text-[#55544F] p-4 text-center">
                  <p>Bu sorunun {!audio?.audioUrl ? 'sesi' : 'işaretleri'} henüz hazır değil; izlenecek video yok.</p>
                  {started && <p className="text-xs text-[#787670]">Sıradaki soruya geçiliyor…</p>}
                </div>
              ) : (
                <VideoPreviewCanvas key={project.id} imageUrl={project.imageUrl} regions={project.videoConfig.regions || []}
                  actions={project.videoConfig.timelineActions} currentTime={time} duration={duration} isPlaying={playing}
                  onPlayPause={playPause} onSeek={setTime} videoConfig={project.videoConfig} audioUrl={audio!.audioUrl} />
              )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button type="button" className="studio-secondary" disabled={index === 0} onClick={() => go(index - 1)}><CaretLeft size={14} /> Önceki</button>
              <button type="button" className="studio-secondary" onClick={() => go(index + 1)}>{index + 1 === ids.length ? 'Bitir' : 'Sonraki'} <CaretRight size={14} /></button>
              <button type="button" aria-pressed={flagged.has(id)} onClick={toggleFlag}
                className={`px-3 py-1.5 rounded-lg border font-semibold inline-flex items-center gap-1.5 ${flagged.has(id) ? 'bg-[#8B1E2D] border-[#8B1E2D] text-white' : 'border-[#D5D4CC] hover:border-[#8B1E2D] text-[#8B1E2D]'}`}>
                <Flag size={15} weight={flagged.has(id) ? 'fill' : 'regular'} /> {flagged.has(id) ? 'Düzeltilecek' : 'Düzeltilecek olarak işaretle'}
              </button>
              <button type="button" className="studio-secondary ml-auto" onClick={() => onOpen(id)} title="İzlemeyi bırakıp bu soruyu düzenlemeye açar">
                <PencilSimple size={15} /> Bu soruyu aç
              </button>
            </div>
            {list.length > 0 && <p className="text-xs text-[#787670]">Düzeltilecek: {list.map(i => titles[i] || 'Soru').join(', ')}</p>}
          </>
        )}
      </div>
    </div>
  );
}
