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
  /** Offsets into the unchanged narration, so repeated phrases stay distinct. */
  sourceStart?: number;
  sourceEnd?: number;
  sentenceStart?: number;
  sentenceEnd?: number;
  sourceText?: string;
}

export interface SolutionParseResult {
  events: SemanticParsedEvent[];
  deducedCorrectAnswer?: 'A' | 'B' | 'C' | 'D' | 'E';
  optionStances: Record<'A' | 'B' | 'C' | 'D' | 'E', 'rejected' | 'correct' | 'neutral'>;
}

export const REJECTION_PATTERNS = [
  /doğru\s+(?:değil|olmaz|olamaz)/i,
  /olmaz/i,
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
  /tam\s+olarak\s+uygundur/i,
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
  if (/doğru\s+(?:cevap|yanıt|seçenek|şık)?\s*(?:[A-E]\s*)?(?:değil|olamaz|olmaz)/i.test(sentence)) return null;
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

  const sentences: Array<{ text: string; start: number; end: number }> = [];
  const boundary = /(?:\r?\n)+|(?<=[.!?;])\s+/g;
  let cursor = 0;
  const addSentence = (end: number) => {
    const raw = solutionText.slice(cursor, end);
    const text = raw.trim();
    if (text) {
      const start = cursor + raw.indexOf(text);
      sentences.push({ text, start, end: start + text.length });
    }
  };
  for (const match of solutionText.matchAll(boundary)) {
    addSentence(match.index!);
    cursor = match.index! + match[0].length;
  }
  addSentence(solutionText.length);

  for (const sentenceSpan of sentences) {
    const sentence = sentenceSpan.text;
    const eventStart = events.length;
    const attachOffsets = () => {
      for (const event of events.slice(eventStart)) {
        const localStart = sentence.toLocaleLowerCase('tr-TR').indexOf(event.semanticTriggerPhrase.toLocaleLowerCase('tr-TR'));
        event.sourceStart = sentenceSpan.start + Math.max(0, localStart);
        event.sourceEnd = Math.min(sentenceSpan.end, event.sourceStart + event.semanticTriggerPhrase.length);
        event.sentenceStart = sentenceSpan.start;
        event.sentenceEnd = sentenceSpan.end;
        event.sourceText = solutionText;
      }
    };
    // Arabic words/phrases that were confidently grounded by OCR.
    for (const am of arabicMatches) {
      if (sentence.includes(am.phrase) && validRegionIds.has(am.region.id)) {
        for (const actionType of ['highlight', 'underline'] as const) events.push({
          id: `event-${counter.value++}`,
          targetRegionId: am.region.id,
          actionType,
          semanticTriggerPhrase: am.phrase,
          sentenceText: sentence,
          order: events.length + 1,
        });
      }
    }

    const rejectionTrigger = findTriggerPhrase(sentence, REJECTION_PATTERNS);
    const explicitCorrect = rejectionTrigger ? null : extractStandaloneCorrectAnswer(sentence);
    const referencedOption = detectOptionReference(sentence);

    // A direct "Doğru cevap C" statement wins over incidental option text.
    if (explicitCorrect) {
      const regionId = `option-${explicitCorrect.toLowerCase()}`;
      if (validRegionIds.has(regionId)) {
        const alreadyCorrect = optionStances[explicitCorrect] === 'correct';
        activeOption = explicitCorrect;
        deducedCorrectAnswer = explicitCorrect;
        optionStances[explicitCorrect] = 'correct';
        const trigger = sentence.match(/(?:doğru\s+cevap|doğru\s+yanıt|cevabımız|doğru\s+seçenek|doğru\s+şık)[^.!?;]*/i)?.[0]
          || `${explicitCorrect} doğru cevap`;
        if (!alreadyCorrect) {
          pushOptionEvent(events, counter, explicitCorrect, 'focus', trigger, sentence);
          pushOptionEvent(events, counter, explicitCorrect, 'correct', trigger, sentence);
        }
        attachOffsets();
        continue;
      }
    }

    if (referencedOption) {
      const regionId = `option-${referencedOption.toLowerCase()}`;
      if (validRegionIds.has(regionId)) {
        activeOption = referencedOption;
        const focusTrigger = findOptionMentionPhrase(sentence, referencedOption);
        if (optionStances[referencedOption] === 'neutral') pushOptionEvent(events, counter, referencedOption, 'focus', focusTrigger, sentence);
      }
    }

    // Rejection/correctness may be in the same sentence OR immediately follow
    // a sentence that introduced an option. Track the active option for this.
    const targetOption = referencedOption || activeOption;
    if (!targetOption) { attachOffsets(); continue; }

    const targetRegionId = `option-${targetOption.toLowerCase()}`;
    if (!validRegionIds.has(targetRegionId)) { attachOffsets(); continue; }

    if (rejectionTrigger && optionStances[targetOption] === 'neutral') {
      optionStances[targetOption] = 'rejected';
      pushOptionEvent(events, counter, targetOption, 'reject', rejectionTrigger, sentence);
    }

    const correctTrigger = findTriggerPhrase(sentence, CORRECT_PATTERNS);
    if (correctTrigger && !rejectionTrigger && optionStances[targetOption] !== 'correct') {
      optionStances[targetOption] = 'correct';
      deducedCorrectAnswer = targetOption;
      pushOptionEvent(events, counter, targetOption, 'correct', correctTrigger, sentence);
    }
    attachOffsets();
  }

  // Root introduction was emitted before the sentence loop.
  for (const event of events) if (event.sourceStart === undefined) {
    event.sourceStart = solutionText.indexOf(event.semanticTriggerPhrase);
    event.sourceEnd = event.sourceStart + event.semanticTriggerPhrase.length;
    event.sentenceStart = 0;
    event.sentenceEnd = sentences[0]?.end ?? 0;
    event.sourceText = solutionText;
  }

  // Deduplicate accidental identical events while preserving order.
  const deduped = events.filter((event, index, arr) => {
    const firstIndex = arr.findIndex(
      (other) =>
        other.targetRegionId === event.targetRegionId &&
        other.actionType === event.actionType &&
        other.sourceStart === event.sourceStart &&
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
