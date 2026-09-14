import { AnnotationRegion } from '../../types';
import { ArabicMatchResult } from '../ocr/arabicMatcher';

export interface SemanticParsedEvent {
  id: string;
  targetRegionId: string;
  actionType: 'focus' | 'reject' | 'correct' | 'highlight' | 'underline' | 'dim-others';
  semanticTriggerPhrase: string;
  sentenceText: string;
  targetOptionLetter?: 'A' | 'B' | 'C' | 'D' | 'E';
  order: number;
}

export interface SolutionParseResult {
  events: SemanticParsedEvent[];
  deducedCorrectAnswer?: 'A' | 'B' | 'C' | 'D' | 'E';
  optionStances: Record<'A' | 'B' | 'C' | 'D' | 'E', 'rejected' | 'correct' | 'neutral'>;
}

export const REJECTION_PATTERNS = [
  /uygun\s+değil/i,
  /uygun\s+olmaz/i,
  /eliyoruz/i,
  /eleyebiliriz/i,
  /elememiz\s+gerekir/i,
  /elenir/i,
  /elendi/i,
  /yanlış/i,
  /olamaz/i,
  /tercih\s+edemeyiz/i,
  /tercih\s+edilmez/i,
  /bu\s+seçenek\s+değil/i,
  /kullanılamaz/i,
  /kullanamayız/i,
  /hatalı/i,
  /anlamca\s+uymaz/i,
  /uymuyor/i,
  /uyuşmaz/i,
  /çelişmektedir/i,
  /geçersizdir/i,
  /doğru\s+olamaz/i,
  /bu\s+yüzden\s+.*el/i,
];

export const CORRECT_PATTERNS = [
  /doğru\s+cevap/i,
  /doğru\s+yanıt/i,
  /cevabımız/i,
  /cevap\s+olarak/i,
  /doğrudur/i,
  /doğru\s+seçenek/i,
  /doğru\s+şık/i,
  /tamamen\s+uygundur/i,
  /en\s+uygun\s+seçenek/i,
  /aradığımız\s+seçenek/i,
  /aradığımız\s+cevap/i,
  /sağlamaktadır/i,
  /karşılamaktadır/i,
  /işaretliyoruz/i,
];

export const QUESTION_ROOT_PATTERNS = [
  /soruda/i,
  /soru\s+kökünde/i,
  /boşluğa/i,
  /boşlukta/i,
  /cümlede/i,
  /parçada/i,
  /ifadeye\s+baktığımızda/i,
];

type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

function detectOptionReference(sentence: string): OptionLetter | null {
  // Covers natural Turkish inflections: "A seçeneği", "A seçeneğini",
  // "B seçeneğinde", "C şıkkına", "D şıkkını" etc.
  const namedOption = sentence.match(
    /\b([A-Ea-e])\s*(?:seçene[a-zçğıöşü]*|şı[a-zçğıöşü]*)\b/i
  );
  if (namedOption) return namedOption[1].toUpperCase() as OptionLetter;

  // Apostrophe suffixes: A'ya, B'yi, C'de, D'den...
  const apostropheOption = sentence.match(/\b([A-Ea-e])['’][a-zçğıöşü]+\b/i);
  if (apostropheOption) return apostropheOption[1].toUpperCase() as OptionLetter;

  // Explicit answer markers: (A), A), A:, A.
  const markerOption = sentence.match(/(?:^|\s|[([{])([A-Ea-e])\s*[)\].:]/);
  if (markerOption) return markerOption[1].toUpperCase() as OptionLetter;

  return null;
}

function extractStandaloneCorrectAnswer(sentence: string): OptionLetter | null {
  const patterns = [
    /(?:doğru\s+cevap|doğru\s+yanıt|cevabımız|doğru\s+seçenek|doğru\s+şık)\s*(?:ise\s*)?[:\-]?\s*([A-Ea-e])\b/i,
    /\b([A-Ea-e])\s*(?:seçeneği|şıkkı)\s+(?:doğru(?:dur)?|cevaptır)/i,
  ];

  for (const pattern of patterns) {
    const match = sentence.match(pattern);
    if (match) return match[1].toUpperCase() as OptionLetter;
  }
  return null;
}

function findTriggerPhrase(sentence: string, patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const m = sentence.match(pat);
    if (m) return m[0];
  }
  return null;
}

function findOptionMentionPhrase(sentence: string, option: OptionLetter): string {
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\b${escaped}\\s*(?:seçene[a-zçğıöşü]*|şı[a-zçğıöşü]*)`, 'i'),
    new RegExp(`\\b${escaped}['’][a-zçğıöşü]+`, 'i'),
    new RegExp(`(?:^|\\s|[([{])${escaped}\\s*[)\\].:]`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = sentence.match(pattern);
    if (match) return match[0].trim();
  }
  return `${option} seçeneği`;
}

function pushOptionEvent(
  events: SemanticParsedEvent[],
  counter: { value: number },
  option: OptionLetter,
  actionType: SemanticParsedEvent['actionType'],
  trigger: string,
  sentence: string
) {
  events.push({
    id: `event-${counter.value++}`,
    targetRegionId: `option-${option.toLowerCase()}`,
    actionType,
    semanticTriggerPhrase: trigger,
    sentenceText: sentence,
    targetOptionLetter: option,
    order: events.length + 1,
  });
}

/**
 * Local deterministic parser for the common language teachers naturally use
 * while solving YDT questions. It deliberately follows the most recently
 * mentioned option so a two-sentence explanation such as
 * "A seçeneğine bakalım. Bu yapı burada kullanılamaz, eliyoruz." still creates
 * the expected focus + reject animation sequence.
 */
export function parseSolutionSemantics(
  solutionText: string,
  availableRegions: AnnotationRegion[],
  arabicMatches: ArabicMatchResult[] = []
): SolutionParseResult {
  const events: SemanticParsedEvent[] = [];
  const optionStances: Record<OptionLetter, 'rejected' | 'correct' | 'neutral'> = {
    A: 'neutral',
    B: 'neutral',
    C: 'neutral',
    D: 'neutral',
    E: 'neutral',
  };

  let deducedCorrectAnswer: OptionLetter | undefined;
  let activeOption: OptionLetter | null = null;
  const counter = { value: 1 };
  const validRegionIds = new Set(availableRegions.map((r) => r.id));

  const sentences = solutionText
    .split(/(?:\r?\n)+|(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hasQuestionRootRegion = validRegionIds.has('question-root');
  if (sentences.length > 0 && hasQuestionRootRegion) {
    const firstSentence = sentences[0];
    const rootTrigger = findTriggerPhrase(firstSentence, QUESTION_ROOT_PATTERNS);
    if (rootTrigger || /\bsoru\b/i.test(firstSentence)) {
      events.push({
        id: `event-${counter.value++}`,
        targetRegionId: 'question-root',
        actionType: 'focus',
        semanticTriggerPhrase: rootTrigger || 'soru',
        sentenceText: firstSentence,
        order: events.length + 1,
      });
    }
  }

  for (const sentence of sentences) {
    // Arabic words/phrases that were confidently grounded by OCR.
    for (const am of arabicMatches) {
      if (sentence.includes(am.phrase) && validRegionIds.has(am.region.id)) {
        events.push({
          id: `event-${counter.value++}`,
          targetRegionId: am.region.id,
          actionType: 'underline',
          semanticTriggerPhrase: am.phrase,
          sentenceText: sentence,
          order: events.length + 1,
        });
      }
    }

    const explicitCorrect = extractStandaloneCorrectAnswer(sentence);
    const referencedOption = detectOptionReference(sentence);

    // A direct "Doğru cevap C" statement wins over incidental option text.
    if (explicitCorrect) {
      const regionId = `option-${explicitCorrect.toLowerCase()}`;
      if (validRegionIds.has(regionId)) {
        activeOption = explicitCorrect;
        deducedCorrectAnswer = explicitCorrect;
        optionStances[explicitCorrect] = 'correct';
        const trigger = sentence.match(/(?:doğru\s+cevap|doğru\s+yanıt|cevabımız|doğru\s+seçenek|doğru\s+şık)[^.!?;]*/i)?.[0]
          || `${explicitCorrect} doğru cevap`;
        pushOptionEvent(events, counter, explicitCorrect, 'focus', trigger, sentence);
        pushOptionEvent(events, counter, explicitCorrect, 'correct', trigger, sentence);
        continue;
      }
    }

    if (referencedOption) {
      const regionId = `option-${referencedOption.toLowerCase()}`;
      if (validRegionIds.has(regionId)) {
        activeOption = referencedOption;
        const focusTrigger = findOptionMentionPhrase(sentence, referencedOption);
        pushOptionEvent(events, counter, referencedOption, 'focus', focusTrigger, sentence);
      }
    }

    // Rejection/correctness may be in the same sentence OR immediately follow
    // a sentence that introduced an option. Track the active option for this.
    const targetOption = referencedOption || activeOption;
    if (!targetOption) continue;

    const targetRegionId = `option-${targetOption.toLowerCase()}`;
    if (!validRegionIds.has(targetRegionId)) continue;

    const rejectionTrigger = findTriggerPhrase(sentence, REJECTION_PATTERNS);
    if (rejectionTrigger && optionStances[targetOption] !== 'correct') {
      optionStances[targetOption] = 'rejected';
      pushOptionEvent(events, counter, targetOption, 'reject', rejectionTrigger, sentence);
    }

    const correctTrigger = findTriggerPhrase(sentence, CORRECT_PATTERNS);
    if (correctTrigger && !rejectionTrigger) {
      optionStances[targetOption] = 'correct';
      deducedCorrectAnswer = targetOption;
      pushOptionEvent(events, counter, targetOption, 'correct', correctTrigger, sentence);
    }
  }

  // Deduplicate accidental identical events while preserving order.
  const deduped = events.filter((event, index, arr) => {
    const firstIndex = arr.findIndex(
      (other) =>
        other.targetRegionId === event.targetRegionId &&
        other.actionType === event.actionType &&
        other.sentenceText === event.sentenceText &&
        other.semanticTriggerPhrase === event.semanticTriggerPhrase
    );
    return firstIndex === index;
  });

  return {
    events: deduped.map((event, index) => ({ ...event, order: index + 1 })),
    deducedCorrectAnswer,
    optionStances,
  };
}
