import { AnnotationRegion, VideoAction, NarrationWord, NarrationSource } from '../../types';
import { localOcrService } from '../ocr/localOcrService';
import { detectYdtQuestionRegions } from '../ocr/ydtQuestionDetector';
import { findArabicMatchesInOcr } from '../ocr/arabicMatcher';
import { parseSolutionSemantics } from '../analysis/solutionParser';
import { alignEventsWithNarration } from '../analysis/timelineAligner';
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
   * Executes the 100% local, deterministic video composition pipeline:
   * 1. Local browser OCR using Tesseract.js (Arabic + Turkish + English)
   * 2. Deterministic YDT layout analysis (A, B, C, D, E options + question root)
   * 3. Arabic keyword matching (no approximate guesswork)
   * 4. Local solution semantics parser (rejections, correct checks, focuses)
   * 5. Spoken narration word alignment (from ElevenLabs or local Whisper)
   */
  public async executePipeline(params: {
    imageUrl: string;
    solutionText: string;
    narrationSource: NarrationSource;
    existingRegions?: AnnotationRegion[];
    onProgress?: (progress: LocalPipelineProgress) => void;
  }): Promise<LocalPipelineResult> {
    const { imageUrl, solutionText, narrationSource, existingRegions, onProgress } = params;

    if (!imageUrl) {
      throw new Error('Soru görseli bulunamadı.');
    }

    if (!solutionText || solutionText.trim().length === 0) {
      throw new Error('Çözüm metni boş olamaz.');
    }

    const words: NarrationWord[] = narrationSource?.words || [];
    const audioDuration = narrationSource?.duration || 15;

    let finalRegions: AnnotationRegion[] = [];
    let detectedOptions: string[] = [];
    let ocrWords: any[] = [];

    // Step 1: Local OCR & Layout Detection
    if (existingRegions && existingRegions.length >= 3) {
      // Re-use already detected or approved regions
      finalRegions = [...existingRegions];
      detectedOptions = finalRegions
        .filter((r) => r.id.startsWith('option-'))
        .map((r) => r.id.replace('option-', '').toUpperCase());
      onProgress?.({
        stage: 'detect_layout',
        progress: 30,
        message: 'Mevcut soru bölgeleri kullanılıyor...',
      });
    } else {
      onProgress?.({
        stage: 'ocr',
        progress: 10,
        message: 'Tesseract OCR ile soru metni ve şıklar taranıyor...',
      });

      const ocrResult = await localOcrService.recognize(imageUrl, (p: OCRProgress) => {
        onProgress?.({
          stage: 'ocr',
          progress: Math.round(p.progress * 0.4),
          message: p.message,
        });
      });

      ocrWords = ocrResult.words;

      onProgress?.({
        stage: 'detect_layout',
        progress: 45,
        message: 'YDT Arapça şık konumları ve soru kökü tespit ediliyor...',
      });

      const layout = detectYdtQuestionRegions(ocrResult);
      finalRegions = layout.regions;
      detectedOptions = layout.detectedOptions;
    }

    // Step 2: Arabic Keyword Matching (Safe OCR matching, no hallucinations)
    onProgress?.({
      stage: 'arabic_matching',
      progress: 60,
      message: 'Çözümdeki Arapça ifadeler taranıyor...',
    });

    const arabicMatches = ocrWords.length > 0
      ? findArabicMatchesInOcr(solutionText, ocrWords)
      : [];

    for (const match of arabicMatches) {
      if (!finalRegions.some((r) => r.id === match.region.id)) {
        finalRegions.push(match.region);
      }
    }

    // Step 3: Local Semantic Solution Analysis
    onProgress?.({
      stage: 'semantic_parsing',
      progress: 75,
      message: 'Pedagojik çözüm adımları ve şık elemeleri çözümleniyor...',
    });

    const parseResult = parseSolutionSemantics(solutionText, finalRegions, arabicMatches);

    // Step 4: Alignment with Spoken Narration Words
    onProgress?.({
      stage: 'timeline_align',
      progress: 90,
      message: 'Ses zamanlamalarıyla animasyonlar senkronize ediliyor...',
    });

    const actions = alignEventsWithNarration(parseResult.events, words, audioDuration);

    onProgress?.({
      stage: 'completed',
      progress: 100,
      message: 'Video animasyon zaman çizelgesi hazırlandı!',
    });

    return {
      success: true,
      regions: finalRegions,
      actions,
      stats: {
        totalEventsPlanned: parseResult.events.length,
        actionsGenerated: actions.length,
        actionsSkipped: parseResult.events.length - actions.length,
        groundedOptions: detectedOptions,
        arabicMatchesCount: arabicMatches.length,
      },
      deducedCorrectAnswer: parseResult.deducedCorrectAnswer,
      duration: audioDuration,
    };
  }
}

export const localVideoPipeline = LocalVideoPipeline.getInstance();
