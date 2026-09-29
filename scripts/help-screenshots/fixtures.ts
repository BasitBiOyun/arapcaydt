import { DEMO_PLAN } from '../../src/features/landing/demoPlan';
import { CURRENT_PIPELINE_VERSION } from '../../src/features/question-editor/readiness';

/**
 * Sample questions for the help screenshots: question 3 of the landing demo (a real picture, its
 * solution, voice timings and marks) plus a few questions at earlier steps, so every list looks lived in.
 */
export const TEACHER = { id: 'teacher-1', email: 'ayse.ogretmen@example.com', name: 'Ayşe Öğretmen' };

const solution = DEMO_PLAN.captions.map(c => c.text).join(' ').replace(/ (?=Şimdi|A şıkkı|B ve E|C şıkkı|D şıkkı|Doğru cevap)/g, '\n');
const words = DEMO_PLAN.captions.flatMap(c =>
  ((c as any).words as Array<{ from: number; to: number; start: number; end: number }>).map(w => ({ text: c.text.slice(w.from, w.to), start: w.start, end: w.end })));

const day = (n: number) => new Date(Date.UTC(2026, 8, 29 - n, 9 + n, 15)).toISOString();
const image = (id: string) => ({ assetPath: `${TEACHER.id}/${id}/soru.webp` });
const voice = (id: string) => ({ assetPath: `${TEACHER.id}/${id}/ses.wav` });
const videoConfig = (full: boolean) => ({
  aspectRatio: '16:9', fps: 30, backgroundColor: '#FFFFFF', showWatermark: true, teacherTag: 'Soru Çözümü', annotations: [],
  showCaptions: true, captionY: 0.88, showOutro: true,
  ...(full ? { regions: DEMO_PLAN.regions, timelineActions: DEMO_PLAN.actions, captions: DEMO_PLAN.captions, timingQuality: 'word-aligned', pipelineVersion: CURRENT_PIPELINE_VERSION } : {}),
});

function question(id: string, n: number, title: string, step: 0 | 1 | 2 | 3 | 4, extra: Record<string, unknown> = {}, voice_ = true) {
  const narration = step >= 2 && voice_ ? {
    narrationSource: { type: 'gemini', audioUrl: voice(id), duration: DEMO_PLAN.duration, words, isApproved: step >= 3, spokenText: solution, timingSource: 'gemini-transcribe', voiceName: 'Achernar', generatedAt: day(n) },
    audioNarration: { audioUrl: voice(id), duration: DEMO_PLAN.duration, isApproved: step >= 3, voiceId: 'Achernar', voiceName: 'Achernar', modelId: 'gemini', generatedAt: day(n), mode: 'live' },
  } : {};
  return {
    id, owner_id: TEACHER.id, created_at: day(n + 3), updated_at: day(n),
    data: {
      title, examName: '2026 YDT Deneme 1', examYear: '2026 YDT', questionNumber: n, category: 'deneme', correctAnswer: 'D',
      status: step >= 4 ? 'video_ready' : step >= 3 ? 'audio_approved' : 'draft',
      imageUrl: step >= 1 ? image(id) : '', imageFileName: `soru_${n}.webp`, imageDimensions: { width: 1600, height: 900 },
      arabicQuestionSnippet: 'يَقْرَأُ الطُّلَّابُ الْكُتُبَ الْمُفِيدَةَ فِي أَوْقَاتِهِمْ',
      solutionText: step >= 2 ? solution : '', audioApproved: step >= 3, videoReady: step >= 4,
      videoConfig: videoConfig(step >= 3), notes: '', ...narration, ...extra,
    },
  };
}

export function sampleProjects() {
  return [
    question('ornek-3', 3, 'Soru 3 – Sıfat uyumu', 4),
    question('ornek-4', 4, 'Soru 4 – İsim cümlesi', 3),
    question('ornek-5', 5, 'Soru 5 – Mazi fiil', 2),
    question('ornek-6', 6, 'Soru 6 – Harf-i cer', 1),
    question('ornek-2', 2, 'Soru 2 – Kelime bilgisi', 4, { examName: '2026 YDT Deneme 2' }),
    question('ornek-1', 1, 'Soru 1 – Okuma parçası', 4, { examName: '2026 YDT Deneme 2' }),
    question('ornek-8', 8, 'Soru 8 – Zamir', 2, {}, false),
    question('ornek-7', 7, 'Yeni Soru Projesi #7', 0),
    question('ornek-9', 9, 'Soru 9 – Eski deneme sorusu', 4, { examName: '2025 YDT', deletedAt: day(4) }),
  ];
}
