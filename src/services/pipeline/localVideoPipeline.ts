import { AnnotationRegion, VideoAction, NarrationWord, NarrationSource, VideoCaption } from '../../types';
import { localOcrService } from '../ocr/localOcrService';
import { detectYdtQuestionRegions } from '../ocr/ydtQuestionDetector';
import { findArabicMatchesInOcr } from '../ocr/arabicMatcher';
import { parseSolutionSemantics } from '../analysis/solutionParser';
import { alignEventsWithNarration, alignSolutionNarration } from '../analysis/timelineAligner';
import { OCRProgress } from '../ocr/ocrTypes';

export interface LocalPipelineProgress {
  stage: 'ocr' | 'detect_layout' | 'arabic_matching' | 'semantic_parsing' | 'timeline_align' | 'completed';
  progress: number;
  message: string;
}

export interface LocalPipelineResult {
  success: boolean;
  regions: AnnotationRegion[];
  actions: VideoAction[];
  stats: {
    totalEventsPlanned: number;
    actionsGenerated: number;
    actionsSkipped: number;
    groundedOptions: string[];
    arabicMatchesCount: number;
  };
  deducedCorrectAnswer?: 'A' | 'B' | 'C' | 'D' | 'E';
  duration: number;
  captions: VideoCaption[];
  timingQuality: 'word-aligned' | 'anchored' | 'approximate';
  warnings: string[];
}

export class LocalVideoPipeline {
  private static instance: LocalVideoPipeline;

  public static getInstance(): LocalVideoPipeline {
    if (!LocalVideoPipeline.instance) {
      LocalVideoPipeline.instance = new LocalVideoPipeline();
    }
    return LocalVideoPipeline.instance;
  }

  /**
   * 100% local animation-planning pipeline.
   *
   * Important: regions are intentionally rebuilt from the CURRENT image on
   * every generation. Older AI Studio versions stored guessed/fallback boxes;
   * reusing those stale regions was the main reason videos silently degraded to
   * a static image + narration.
   */
  public async executePipeline(params: {
    imageUrl: string;
    solutionText: string;
    narrationSource: NarrationSource;
    existingRegions?: AnnotationRegion[];
    suppressedRegionIds?: string[];
    onProgress?: (progress: LocalPipelineProgress) => void;
  }): Promise<LocalPipelineResult> {
    const { imageUrl, solutionText, narrationSource, onProgress } = params;

    if (!imageUrl) throw new Error('Soru görseli bulunamadı.');
    if (!solutionText || solutionText.trim().length === 0) {
      throw new Error('Çözüm metni boş olamaz.');
    }

    const words: NarrationWord[] = narrationSource?.words || [];
    const audioDuration = Math.max(2, narrationSource?.duration || 15);

    onProgress?.({
      stage: 'ocr',
      progress: 10,
      message: 'Tesseract OCR ile soru metni ve şıklar taranıyor...',
    });

    const ocrResult = await localOcrService.recognize(imageUrl, (p: OCRProgress) => {
      onProgress?.({
        stage: 'ocr',
        progress: Math.max(10, Math.min(40, Math.round(10 + p.progress * 0.3))),
        message: p.message,
      });
    });

    onProgress?.({
      stage: 'detect_layout',
      progress: 48,
      message: 'YDT Arapça şık konumları ve soru kökü tespit ediliyor...',
    });

    const layout = detectYdtQuestionRegions(ocrResult);
    const manual = (params.existingRegions || []).filter(r => r.manuallyAdjusted);
    const suppressed = new Set(params.suppressedRegionIds || []);
    const finalRegions: AnnotationRegion[] = layout.regions.filter(r => !suppressed.has(r.id));
    for (const region of manual) {
      const id = /^option-[a-e]$/.test(region.type) ? region.type : region.id;
      const index = finalRegions.findIndex(r => r.id === id);
      if (index >= 0) finalRegions[index] = { ...region, id };
      else finalRegions.push({ ...region, id });
    }
    const detectedOptions = ['A', 'B', 'C', 'D', 'E'].filter(letter => finalRegions.some(r => r.id === `option-${letter.toLowerCase()}`));


    onProgress?.({
      stage: 'arabic_matching',
      progress: 62,
      message: 'Çözümdeki Arapça ifadeler görsel üzerinde eşleştiriliyor...',
    });

    const arabicMatches = findArabicMatchesInOcr(solutionText, ocrResult.words).filter(m => !suppressed.has(m.region.id));
    for (const match of arabicMatches) {
      if (!finalRegions.some((r) => r.id === match.region.id)) {
        finalRegions.push(match.region);
      }
    }

    for (const region of manual) {
      if (region.content && !region.type.startsWith('option') && region.id !== 'question-root') {
        const existing = arabicMatches.findIndex(m => m.region.id === region.id);
        const match = { phrase: region.content, region, matchedWords: [] };
        if (existing >= 0) arabicMatches[existing] = match;
        else arabicMatches.push(match);
      }
    }

    onProgress?.({
      stage: 'semantic_parsing',
      progress: 76,
      message: 'Şık eleme, doğru cevap ve vurgu adımları çıkarılıyor...',
    });

    const parseResult = parseSolutionSemantics(solutionText, finalRegions, arabicMatches);

    onProgress?.({
      stage: 'timeline_align',
      progress: 90,
      message: 'Animasyonlar gerçek ses zamanlamalarıyla eşleştiriliyor...',
    });

    const alignment = alignSolutionNarration(solutionText, words, audioDuration);
    const actions = alignEventsWithNarration(parseResult.events, words, audioDuration, solutionText);
    const warnings: string[] = [];
    if (detectedOptions.length < 5) warnings.push(`Şu şıklar bulunamadı: ${['A', 'B', 'C', 'D', 'E'].filter(x => !detectedOptions.includes(x)).join(', ')}. Alan düzenleyicisinde eksik şıkları işaretleyip yeniden hazırlayın.`);
    if (alignment.quality !== 'word-aligned') warnings.push(alignment.quality === 'approximate'
      ? 'Ses zamanlamaları eşleştirilemedi. Süreler yaklaşık; dışa aktarmadan önce zaman çizelgesini kontrol edin.'
      : 'Bazı ifadelerin süreleri komşu ses kelimelerinden hesaplandı. Önizlemede zamanlamayı kontrol edin.');
    if (!parseResult.deducedCorrectAnswer) warnings.push('Çözüm metninde kesin doğru cevap bulunamadı. Doğru şıkkı zaman çizelgesinden işaretleyin.');

    // Never silently claim success and then export only image + audio.
    if (actions.length === 0) {
      warnings.push('Animasyon adımı bulunamadı. Kutuları ve vurguları düzenle bölümünden alan ekleyin; zaman çizelgesinden işaret ekleyebilirsiniz.');
    }

    onProgress?.({
      stage: 'completed',
      progress: 100,
      message: `${actions.length} animasyon olayı hazırlandı.`,
    });

    return {
      success: true,
      regions: finalRegions,
      actions,
      stats: {
        totalEventsPlanned: parseResult.events.length,
        actionsGenerated: actions.length,
        actionsSkipped: Math.max(0, parseResult.events.length - actions.length),
        groundedOptions: detectedOptions,
        arabicMatchesCount: arabicMatches.length,
      },
      deducedCorrectAnswer: parseResult.deducedCorrectAnswer,
      duration: audioDuration,
      captions: alignment.captions,
      timingQuality: alignment.quality,
      warnings,
    };
  }
}

export const localVideoPipeline = LocalVideoPipeline.getInstance();
