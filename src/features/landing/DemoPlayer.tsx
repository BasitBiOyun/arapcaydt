import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from '@phosphor-icons/react';
import { renderQuestionVideoFrame, outroSeconds } from '../video/engine/renderer';
import { DEMO_PLAN } from './demoPlan';

const WIDTH = 1280, HEIGHT = 720;
const TOTAL = DEMO_PLAN.duration + outroSeconds(DEMO_PLAN.actions);
/** A still that shows the whole story (eliminations, underline, the check) for reduced motion. */
const STILL_AT = 50.2;
/**
 * The loop starts at "Ayrıca أَوْقَاتِهِمْ …": the Arabic underline, then every option
 * judged in turn, the check on D and the closing card, without the long introduction.
 */
const LOOP_FROM = 22;

/**
 * The studio's own renderer drawing the precomputed plan for question 3 in
 * the visitor's browser (muted; the karaoke captions carry the narration).
 * Runs only while visible; pausable; a still frame with reduced motion.
 */
export function DemoPlayer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const image = useRef<HTMLImageElement | null>(null);
  const time = useRef(LOOP_FROM);
  /** Once played, a pause freezes the current frame instead of jumping to the still. */
  const started = useRef(false);

  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.src = '/landing/soru3.webp';
    Promise.all([
      img.decode(),
      ...['500 30px Manrope', '700 30px Manrope', '400 30px Amiri'].map(f => document.fonts?.load(f, 'Aşğ عَلَى').catch(() => undefined)),
    ]).then(() => { if (alive) { image.current = img; setReady(true); } }, () => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const draw = (t: number) => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !image.current) return;
    renderQuestionVideoFrame(ctx, WIDTH, HEIGHT, image.current, DEMO_PLAN.regions, DEMO_PLAN.actions, t,
      { width: WIDTH, height: HEIGHT, aspectRatio: '16:9', captions: DEMO_PLAN.captions, duration: DEMO_PLAN.duration });
  };

  useEffect(() => {
    if (!ready) return;
    if (!playing || !visible) { draw(playing || started.current ? time.current : STILL_AT); return; }
    started.current = true;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      time.current += (now - last) / 1000;
      if (time.current >= TOTAL) time.current = LOOP_FROM;
      last = now;
      draw(time.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, playing, visible]);

  return (
    <div className="relative">
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} className="block w-full h-auto bg-white"
        role="img" aria-label="Örnek soru çözüm animasyonu: yanlış şıklar sırayla elenir, doğru cevap D işaretlenir." />
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-xs text-[#787670] bg-white">Önizleme yükleniyor…</div>}
      <button type="button" onClick={() => setPlaying(p => !p)}
        className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-[#1C1917]/75 hover:bg-[#1C1917]/90 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
        aria-label={playing ? 'Önizlemeyi duraklat' : 'Önizlemeyi oynat'}>
        {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
      </button>
    </div>
  );
}
