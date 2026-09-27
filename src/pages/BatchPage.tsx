import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeaveGuard } from '../layouts/AppLayout';
import { Stack, Play, Stop, ArrowRight } from '@phosphor-icons/react';
import { QUESTION_CATEGORIES, DEFAULT_CATEGORY_ID } from '../config/categories';
import { STANDARD_VOICE_CONFIG } from '../config/voice';
import { buildBatchPlan } from '../features/batch/batchPlan';
import { runBatch, type BatchDeps, type BatchRowState } from '../features/batch/batchRunner';
import { projectRepository } from '../features/projects/projectRepository';
import { useProjects } from '../features/projects/ProjectContext';
import { exportProjectVideo, videoFileName } from '../features/video/exportProjectVideo';
import { narrationService } from '../services/narration/narrationService';
import { elevenlabsService } from '../services/elevenlabs/elevenlabsService';
import { readAudioDuration, readDataUrl } from '../services/narration/browserMedia';
import { prepareUploadedNarration } from '../services/narration/uploadedNarration';
import { localOcrService } from '../services/ocr/localOcrService';
import { localVideoPipeline } from '../services/pipeline/localVideoPipeline';
import { database } from '../services/supabase';
import { localWhisperService } from '../services/whisper/localWhisperService';

const stageLabels: Record<BatchRowState['stage'], string> = {
  waiting: 'Sırada', creating: 'Oluşturuluyor', voice: 'Ses', markers: 'İşaretler', video: 'MP4',
  done: 'Tamamlandı', failed: 'Hata', skipped: 'Atlandı', stopped: 'Durduruldu',
};
const readinessLabels = { ready: 'Yayına hazır', check: 'Kontrol önerilir', blocked: 'Düzeltme gerekli' };
const readinessTones = { ready: 'text-[#15803D]', check: 'text-[#B45309]', blocked: 'text-red-700' };

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function BatchPage({ onOpenProject, registerLeaveGuard }: { onOpenProject: (id: string) => void; registerLeaveGuard?: (guard: LeaveGuard | null) => void }) {
  const { loadProjects } = useProjects();
  const [images, setImages] = useState<File[]>([]);
  const [audios, setAudios] = useState<File[]>([]);
  const [solutions, setSolutions] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORY_ID);
  const [examName, setExamName] = useState('');
  const [examYear, setExamYear] = useState(`${new Date().getFullYear()} YDT`);
  const [generateVoice, setGenerateVoice] = useState(false);
  const [exportVideo, setExportVideo] = useState(true);
  const [rows, setRows] = useState<Record<number, BatchRowState>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  const plan = useMemo(() => buildBatchPlan(images, solutions, audios), [images, solutions, audios]);
  const runnable = plan.items.filter(i => !i.problems.length);
  const voiceChars = generateVoice ? runnable.filter(i => !i.audio).reduce((sum, i) => sum + (i.solution?.trim().length || 0), 0) : 0;

  // OCR models load while the teacher is still choosing files.
  useEffect(() => { if (images.length) localOcrService.warmUp(); }, [images.length]);
  // Leaving the page while a batch runs stops it (asked first); finished questions stay saved.
  useEffect(() => {
    if (!registerLeaveGuard) return;
    registerLeaveGuard(running ? () => {
      if (!window.confirm('Toplu üretim sürüyor. Bu sayfadan çıkarsanız durdurulur; tamamlanan sorular kayıtlı kalır. Çıkılsın mı?')) return false;
      abort.current?.abort();
      return true;
    } : null);
    return () => registerLeaveGuard(null);
  }, [running, registerLeaveGuard]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const start = async () => {
    if (!runnable.length || running) return;
    if (voiceChars > 0 && !window.confirm(`${runnable.filter(i => !i.audio).length} soru otomatik seslendirilecek. Devam edilsin mi?`)) return;
    setError('');
    setRunning(true);
    abort.current = new AbortController();
    setRows(Object.fromEntries(plan.items.map(i => [i.number, { stage: 'waiting' as const }])));
    const deps: BatchDeps<File> = {
      readDataUrl,
      createProject: p => projectRepository.create(p),
      saveProject: p => projectRepository.save(p),
      generateVoice: p => narrationService.generateNarration({ projectId: p.id, text: p.solutionText, voiceId: STANDARD_VOICE_CONFIG.voiceId,
        modelId: STANDARD_VOICE_CONFIG.modelId, outputFormat: STANDARD_VOICE_CONFIG.outputFormat }),
      alignGeneratedVoice: p => narrationService.alignGeneratedNarration(p.id),
      alignGeneratedVoiceLocal: async p => {
        const audioUrl = p.narrationSource?.audioUrl || p.audioNarration?.audioUrl;
        if (!audioUrl) throw new Error('Ses dosyası bağlantısı bulunamadı.');
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`Ses dosyası indirilemedi (HTTP ${response.status}).`);
        return (await localWhisperService.transcribeAudioLocally(await response.arrayBuffer())).words;
      },
      prepareUpload: (p, file) => prepareUploadedNarration(file, {
        readDataUrl, readDuration: readAudioDuration,
        align: (audioBase64, mimeType) => elevenlabsService.alignUploadedNarration({ projectId: p.id, text: p.solutionText.trim(), audioBase64, mimeType }),
        transcribe: async upload => localWhisperService.transcribeAudioLocally(await upload.arrayBuffer()),
      }),
      runPipeline: (p, declared) => localVideoPipeline.executePipeline({ imageUrl: p.imageUrl, solutionText: p.solutionText,
        narrationSource: p.narrationSource!, correctAnswer: declared }),
      exportVideo: (p, onPercent, signal) => exportProjectVideo(p, onPercent, signal),
      download: (blob, p) => download(blob, videoFileName(p)),
      recordExport: async p => { await database().rpc('record_video_export', { project_id: p.id }); },
      wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
      now: () => Date.now(),
    };
    try {
      await runBatch(plan.items, { category, examName: examName.trim(), examYear: examYear.trim(), generateVoice, exportVideo }, deps,
        (number, state) => setRows(previous => ({ ...previous, [number]: state })), abort.current.signal);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toplu üretim tamamlanamadı.');
    } finally {
      setRunning(false);
      void loadProjects();
    }
  };

  const field = 'block w-full border rounded p-2 mt-1 text-sm';
  return <section className="studio-library">
    <header className="library-heading">
      <div><h2>Toplu üretim</h2><p>Birden çok soru görselini, tek bir çözüm metnini ve isteğe bağlı MP3'leri soru numarasına göre eşleştirip sırayla hazırlayın.</p></div>
      {running
        ? <button className="studio-secondary" onClick={() => abort.current?.abort()}><Stop size={18} />Durdur</button>
        : <button className="studio-primary" disabled={!runnable.length} onClick={() => void start()}><Play size={18} />Başlat ({runnable.length} soru)</button>}
    </header>

    <div className="grid gap-4 md:grid-cols-2 pb-6 border-b border-[#E5E4DC]">
      <div className="space-y-4">
        <label className="block text-sm font-semibold">Soru görselleri
          <input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={running} className={field} onChange={e => setImages(Array.from(e.target.files || []))} />
          <span className="block text-xs font-normal text-[#787670] mt-1">Dosya adında soru numarası olmalı: soru_3.png, S3.jpg, 3.png.</span>
        </label>
        <label className="block text-sm font-semibold">MP3 dosyaları (isteğe bağlı)
          <input type="file" multiple accept=".mp3,audio/mpeg,audio/mp3" disabled={running} className={field} onChange={e => setAudios(Array.from(e.target.files || []))} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block text-sm font-semibold">Kategori
            <select className={field} value={category} disabled={running} onChange={e => setCategory(e.target.value)}>{QUESTION_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </label>
          <label className="block text-sm font-semibold">Koleksiyon / deneme
            <input className={field} placeholder="Örnek: Eylül Denemesi 1" value={examName} disabled={running} onChange={e => setExamName(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">Sınav / yıl
            <input className={field} value={examYear} disabled={running} onChange={e => setExamYear(e.target.value)} />
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={generateVoice} disabled={running} onChange={e => setGenerateVoice(e.target.checked)} />
          <span>MP3'ü olmayan soruları otomatik seslendir{generateVoice && voiceChars > 0 && <> · <strong>{runnable.filter(i => !i.audio).length} soru</strong></>}
            <span className="block text-xs text-[#787670]">Kapalıysa bu sorular oluşturulur ve ses için editörde bekler.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={exportVideo} disabled={running} onChange={e => setExportVideo(e.target.checked)} />
          <span>Hazır olan soruların MP4'ünü sırayla indir
            <span className="block text-xs text-[#787670]">Tarayıcı ilk dosyada birden çok indirmeye izin isteyebilir. İşlem bitene kadar bu sekmeyi açık tutun.</span></span>
        </label>
      </div>
      <label className="block text-sm font-semibold">Çözüm metinleri
        <textarea dir="auto" rows={16} disabled={running} value={solutions} onChange={e => setSolutions(e.target.value)}
          placeholder={'Soru 1\nA şıkkı … olmaz.\nDoğru cevap C.\n\nSoru 2\n…'} className={`${field} font-normal leading-relaxed`} />
        <span className="block text-xs font-normal text-[#787670] mt-1">Her soru kendi satırında "Soru 3" başlığıyla başlamalı. Metin dosyası da yükleyebilirsiniz:</span>
        <input type="file" accept=".txt,.md,text/plain" disabled={running} className={field}
          onChange={async e => { const file = e.target.files?.[0]; if (file) setSolutions(await file.text()); }} />
      </label>
    </div>

    {error && <p role="alert" className="save-alert">{error}</p>}
    {plan.unmatched.length > 0 && <p className="text-xs text-[#B45309] mt-4">Eşleşmeyen dosyalar: {plan.unmatched.join(' · ')}</p>}
    <p className="library-count" role="status">{plan.items.length ? `${plan.items.length} soru bulundu · ${runnable.length} tanesi hazırlanabilir` : 'Dosyaları seçip çözüm metnini ekleyin.'}</p>

    {plan.items.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead className="bg-[#FAF9F5]"><tr>{['Soru', 'Görsel', 'Çözüm', 'Cevap', 'Ses', 'Durum', ''].map(h => <th key={h} className="p-3 whitespace-nowrap font-semibold">{h}</th>)}</tr></thead>
      <tbody>{plan.items.map(item => {
        const row = rows[item.number];
        return <tr key={item.number} className="border-t border-[#E5E4DC] align-top">
          <td className="p-3 font-semibold">{item.number}</td>
          <td className="p-3">{item.image?.name || <span className="text-red-700">yok</span>}</td>
          <td className="p-3 max-w-xs"><span dir="auto" className="line-clamp-2 text-[#55544F]">{item.solution?.replace(/\s+/g, ' ').slice(0, 110) || <span className="text-red-700">yok</span>}</span></td>
          <td className="p-3">{item.answer || '—'}</td>
          <td className="p-3">{item.audio?.name || (generateVoice ? 'Otomatik' : 'Sonra')}</td>
          <td className="p-3 min-w-48">
            {row ? <>
              <strong className={row.stage === 'failed' ? 'text-red-700' : ''}>{stageLabels[row.stage]}{row.stage === 'video' && row.percent ? ` %${row.percent}` : ''}</strong>
              {row.readiness && <span className={`block text-xs font-semibold ${readinessTones[row.readiness]}`}>{readinessLabels[row.readiness]}</span>}
              {row.message && <span className="block text-xs text-[#787670]">{row.message}</span>}
            </> : <>
              {item.problems.map(p => <span key={p} className="block text-xs text-red-700">{p}</span>)}
              {item.notes.map(n => <span key={n} className="block text-xs text-[#B45309]">{n}</span>)}
              {!item.problems.length && !item.notes.length && <span className="text-xs text-[#15803D]">Hazır</span>}
            </>}
          </td>
          <td className="p-3">{row?.projectId && !running && <button className="studio-secondary" onClick={() => onOpenProject(row.projectId!)}>Aç<ArrowRight size={16} /></button>}</td>
        </tr>;
      })}</tbody>
    </table></div>}
    {!plan.items.length && <div className="library-empty"><Stack size={28} /><h3>Bir deneme ya da soru setini tek seferde hazırlayın</h3><p>Görsellerin adı soru numarasını içermeli; çözüm metni "Soru 1", "Soru 2" başlıklarıyla bölünmeli.</p></div>}
  </section>;
}
