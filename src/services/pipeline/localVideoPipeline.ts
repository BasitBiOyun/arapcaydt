import { AnnotationRegion, VideoAction, NarrationWord, NarrationSource, VideoCaption } from '../../types';
import { localOcrService } from '../ocr/localOcrService';
import { detectYdtQuestionRegions } from '../ocr/ydtQuestionDetector';
import { findBestArabicMatches, extractArabicPhrases, normalizeArabic } from '../ocr/arabicMatcher';
import { findPassageMatches, findPassages, withPassageReferences } from '../ocr/passageMatcher';
import { parseSolutionSemantics } from '../analysis/solutionParser';
import { alignEventsWithNarration, alignSolutionNarration } from '../analysis/timelineAligner';
import { OCRProgress } from '../ocr/ocrTypes';
import { learnTemplate, matchProfile, stripTemplateWords } from '../ocr/templateProfile';
import { imageSignature, loadTemplateProfiles, saveTemplateProfiles } from '../ocr/templateStore';

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
  ocrEngine?: 'vision' | 'tesseract';
  ocrNote?: string;
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
    /** Teacher-selected answer: used when the script never names it, never to cross it out. */
    correctAnswer?: 'A' | 'B' | 'C' | 'D' | 'E';
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
      message: 'Soru metni ve şıklar okunuyor...',
    });

    // Fixed template text (header, instruction box, footer) learned from earlier slides is ignored.
    const signature = await imageSignature(imageUrl);
    const templates = loadTemplateProfiles();
    const template = signature ? matchProfile(templates, signature) : undefined;
    const rawOcr = await localOcrService.recognize(imageUrl, (p: OCRProgress) => {
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

    const ocrResult = stripTemplateWords(rawOcr, template);
    const layout = detectYdtQuestionRegions(ocrResult);
    const manual = (params.existingRegions || []).filter(r => r.manuallyAdjusted);
    const suppressed = new Set(params.suppressedRegionIds || []);
    const finalRegions: AnnotationRegion[] = layout.regions.filter(r => !suppressed.has(r.id));
    for (const region of manual) {
      const id = /^option-[a-e]$/.test(region.type) ? region.type : region.id;
      const index = finalRegions.findIndex(r => r.id === id);
      if (index >= 0) {
        const original = finalRegions[index];
        const anchor = original.markerAnchor;
        const y = anchor ? (original.y + anchor.y*original.height - region.y)/region.height : -1;
        finalRegions[index] = { ...region, id,
          ...(!region.markerAnchor && anchor && y>=0 && y<=1 ? {markerAnchor:{x:0,y}} : {}) };
      }
      else finalRegions.push({ ...region, id });
    }
    const detectedOptions = ['A', 'B', 'C', 'D', 'E'].filter(letter => finalRegions.some(r => r.id === `option-${letter.toLowerCase()}`));
    if (signature && detectedOptions.length >= 4)
      saveTemplateProfiles(learnTemplate(templates, signature, rawOcr.words, finalRegions));


    onProgress?.({
      stage: 'arabic_matching',
      progress: 62,
      message: 'Çözümdeki Arapça ifadeler görsel üzerinde eşleştiriliyor...',
    });

    const options = finalRegions.filter(r => r.type.startsWith('option'));
    const stemWords = ocrResult.words.filter(w => !options.some(r => w.x+w.width/2 >= r.x && w.x+w.width/2 <= r.x+r.width && w.y+w.height/2 >= r.y && w.y+w.height/2 <= r.y+r.height));
    // A passage read in full is found as a whole (one underline per printed line); the shorter
    // phrases are looked for without it, and a later mention of its words points into it.
    const passageMatches = findPassageMatches(solutionText, stemWords, ocrResult.arabicStemWords);
    const passages = findPassages(solutionText);
    const missedPassages = passages.filter(p => !passageMatches.some(m => m.passageEnd === p[p.length - 1].to));
    const passageRanges = [...new Map(passageMatches.map(m => [m.passageEnd, m])).values()]
      .map(m => [Math.min(...passageMatches.filter(o => o.passageEnd === m.passageEnd).map(o => o.sourceStart)), m.passageEnd] as const);
    const withoutPassages = passageRanges.reduce((text, [from, to]) => text.slice(0, from) + ' '.repeat(to - from) + text.slice(to), solutionText);
    const arabicMatches = [
      ...passageMatches,
      ...withPassageReferences(withoutPassages,
        findBestArabicMatches(withoutPassages, stemWords, ocrResult.arabicStemWords, passageMatches.flatMap(m => m.matchedWords)), passageMatches),
    ].filter(m => !suppressed.has(m.region.id));
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

    const parseResult = parseSolutionSemantics(solutionText, finalRegions, arabicMatches, params.correctAnswer);

    onProgress?.({
      stage: 'timeline_align',
      progress: 90,
      message: 'Animasyonlar gerçek ses zamanlamalarıyla eşleştiriliyor...',
    });

    const alignment = alignSolutionNarration(solutionText, words, audioDuration);
    const actions = alignEventsWithNarration(parseResult.events, words, audioDuration, solutionText);
    const warnings: string[] = [];
    const covered = new Set([...arabicMatches.map(m => m.phrase), ...options.map(r => r.content || '')].flatMap(p => normalizeArabic(p).split(' ')));
    const unread = [...new Set(extractArabicPhrases(solutionText).flatMap(p => p.split(/\s+/)).filter(w => !covered.has(normalizeArabic(w))))];
    if (unread.length) warnings.push(`Görselde eşleştirilemeyen Arapça kelimeler: ${unread.slice(0,8).join('، ')}${unread.length>8?'…':''}. Bu kelimelere tahmini vurgu eklenmedi; gerekirse önizlemede ▁ aracıyla altlarını çizin.`);
    for (const passage of missedPassages) {
      const start = solutionText.slice(passage[0].from, passage[Math.min(4, passage.length - 1)].to);
      const read = stemWords.filter(w => /[\u0621-\u064A]/.test(w.text)).length;
      warnings.push(`Çözümdeki Arapça paragraf (“${start}…”, ${passage.length} kelime) görselde bulunamadı; görselde ${read} Arapça kelime okundu (${rawOcr.engine === 'vision' ? 'Google Vision' : 'tarayıcıdaki okuyucu'}). Altını ▁ aracıyla satır satır çizebilirsiniz.`);
    }
    if (detectedOptions.length < 5) warnings.push(`Şu şıklar bulunamadı: ${['A', 'B', 'C', 'D', 'E'].filter(x => !detectedOptions.includes(x)).join(', ')}. Önizlemede o şıkkın kutusuna tıklayıp harfini seçin ya da kutusunu çizin.`);
    if (alignment.quality !== 'word-aligned') warnings.push(alignment.quality === 'approximate'
      ? 'Ses zamanlamaları eşleştirilemedi. Süreler yaklaşık; dışa aktarmadan önce zaman çizelgesini kontrol edin.'
      : 'Bazı ifadelerin süreleri komşu ses kelimelerinden hesaplandı. Önizlemede zamanlamayı kontrol edin.');
    if (parseResult.deducedCorrectAnswer && params.correctAnswer && parseResult.deducedCorrectAnswer !== params.correctAnswer)
      warnings.push(`Çözüm metni ${parseResult.deducedCorrectAnswer} diyor; seçili cevap ${params.correctAnswer} idi. Video sesle uyumlu olması için ${parseResult.deducedCorrectAnswer} şıkkını işaretler.`);
    if (!parseResult.deducedCorrectAnswer && !actions.some(a => a.type === 'correct')) warnings.push('Çözüm metninde kesin doğru cevap bulunamadı. Doğru şıkkı zaman çizelgesinden işaretleyin.');

    // Never silently claim success and then export only image + audio.
    if (actions.length === 0) {
      warnings.push('Animasyon adımı bulunamadı. Önizlemede soldaki araçlarla görsele işaret ekleyebilirsiniz.');
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
      ocrEngine: rawOcr.engine,
      ocrNote: rawOcr.cloudIssue,
    };
  }
}

export const localVideoPipeline = LocalVideoPipeline.getInstance();
