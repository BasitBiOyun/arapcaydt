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

// Extensible Dictionaries for Turkish Pedagogical Analysis
export const REJECTION_PATTERNS = [
  /uygun\s+değil/i,
  /eliyoruz/i,
  /elenir/i,
  /elendi/i,
  /yanlış/i,
  /olamaz/i,
  /tercih\s+edemeyiz/i,
  /bu\s+seçenek\s+değil/i,
  /kullanılamaz/i,
  /hatalı/i,
  /anlamca\s+uymaz/i,
  /uymuyor/i,
  /uyuşmaz/i,
  /çelişmektedir/i,
  /geçersizdir/i,
  /doğru\s+olamaz/i,
];

export const CORRECT_PATTERNS = [
  /doğru\s+cevap/i,
  /cevabımız/i,
  /doğrudur/i,
  /doğru\s+seçenek/i,
  /doğru\s+yanıt/i,
  /tamamen\s+uygundur/i,
  /en\s+uygun\s+seçenek/i,
  /aradığımız\s+seçenek/i,
  /sağlamaktadır/i,
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

function detectOptionReference(sentence: string): 'A' | 'B' | 'C' | 'D' | 'E' | null {
  // Matches "A seçeneği", "A şıkkı", "A'ya", "A da", "A şıkkında", "(A)"
  const match = sentence.match(/\b([A-Ea-e])\s*(?:seçeneği|şıkkı|şığında|seçeneğinde|'ya|'ye|'da|'de|'dan|'den)\b/i);
  if (match) {
    return match[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
  }

  // Direct letter marker check e.g. "A: uygun değil" or "B seçeneği"
  const directMatch = sentence.match(/(?:^|[^\w])([A-Ea-e])\)\s/);
  if (directMatch) {
    return directMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
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

/**
 * Deterministically parses Turkish solution text to detect:
 * 1. Target options examined
 * 2. Pedagogical rejections (Focus -> Reject X)
 * 3. Correct answer declaration (Focus -> Correct Check)
 * 4. Question root mentions (Focus / Highlight)
 * 5. Arabic keyword mentions found in OCR
 */
export function parseSolutionSemantics(
  solutionText: string,
  availableRegions: AnnotationRegion[],
  arabicMatches: ArabicMatchResult[] = []
): SolutionParseResult {
  const events: SemanticParsedEvent[] = [];
  const optionStances: Record<'A' | 'B' | 'C' | 'D' | 'E', 'rejected' | 'correct' | 'neutral'> = {
    A: 'neutral',
    B: 'neutral',
    C: 'neutral',
    D: 'neutral',
    E: 'neutral',
  };

  let deducedCorrectAnswer: 'A' | 'B' | 'C' | 'D' | 'E' | undefined = undefined;

  const validRegionIds = new Set(availableRegions.map((r) => r.id));

  // Split into sentences / meaningful clauses
  const sentences = solutionText
    .split(/(?<=[.!?;\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let eventCounter = 1;

  // 1. Check if the opening sentence references the question root
  const hasQuestionRootRegion = validRegionIds.has('question-root');
  if (sentences.length > 0 && hasQuestionRootRegion) {
    const firstSentence = sentences[0];
    const rootTrigger = findTriggerPhrase(firstSentence, QUESTION_ROOT_PATTERNS);
    if (rootTrigger || firstSentence.toLowerCase().includes('soru')) {
      events.push({
        id: `event-${eventCounter++}`,
        targetRegionId: 'question-root',
        actionType: 'focus',
        semanticTriggerPhrase: rootTrigger || 'soru',
        sentenceText: firstSentence,
        order: events.length + 1,
      });
    }
  }

  // 2. Iterate through sentences
  for (const sentence of sentences) {
    // Check for Arabic matches first
    for (const am of arabicMatches) {
      if (sentence.includes(am.phrase) && validRegionIds.has(am.region.id)) {
        events.push({
          id: `event-${eventCounter++}`,
          targetRegionId: am.region.id,
          actionType: 'underline',
          semanticTriggerPhrase: am.phrase,
          sentenceText: sentence,
          order: events.length + 1,
        });
      }
    }

    // Check for option reference
    const optionLetter = detectOptionReference(sentence);

    if (optionLetter) {
      const regionId = `option-${optionLetter.toLowerCase()}`;

      // Only generate actions if the region actually exists in the question image
      if (validRegionIds.has(regionId)) {
        // Step A: Focus on this option when mentioned
        const optionPhraseMatch = sentence.match(
          new RegExp(`\\b${optionLetter}\\s*(?:seçeneği|şıkkı|'ya|'ye|'da|'de)?`, 'i')
        );
        const focusTrigger = optionPhraseMatch ? optionPhraseMatch[0] : `${optionLetter} seçeneği`;

        events.push({
          id: `event-${eventCounter++}`,
          targetRegionId: regionId,
          actionType: 'focus',
          semanticTriggerPhrase: focusTrigger,
          sentenceText: sentence,
          targetOptionLetter: optionLetter,
          order: events.length + 1,
        });

        // Step B: Check for rejection
        const rejectionTrigger = findTriggerPhrase(sentence, REJECTION_PATTERNS);
        if (rejectionTrigger) {
          optionStances[optionLetter] = 'rejected';
          events.push({
            id: `event-${eventCounter++}`,
            targetRegionId: regionId,
            actionType: 'reject',
            semanticTriggerPhrase: rejectionTrigger,
            sentenceText: sentence,
            targetOptionLetter: optionLetter,
            order: events.length + 1,
          });
        }

        // Step C: Check for correct answer
        const correctTrigger = findTriggerPhrase(sentence, CORRECT_PATTERNS);
        if (correctTrigger) {
          optionStances[optionLetter] = 'correct';
          deducedCorrectAnswer = optionLetter;
          events.push({
            id: `event-${eventCounter++}`,
            targetRegionId: regionId,
            actionType: 'correct',
            semanticTriggerPhrase: correctTrigger,
            sentenceText: sentence,
            targetOptionLetter: optionLetter,
            order: events.length + 1,
          });
        }
      }
    } else {
      // Sentence without direct option reference, check if it declares correct answer (e.g. "Doğru cevap C.")
      const standaloneCorrectMatch = sentence.match(/(?:doğru\s+cevap|cevabımız)\s*([A-Ea-e])/i);
      if (standaloneCorrectMatch) {
        const letter = standaloneCorrectMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
        const regionId = `option-${letter.toLowerCase()}`;
        if (validRegionIds.has(regionId)) {
          optionStances[letter] = 'correct';
          deducedCorrectAnswer = letter;
          events.push({
            id: `event-${eventCounter++}`,
            targetRegionId: regionId,
            actionType: 'focus',
            semanticTriggerPhrase: standaloneCorrectMatch[0],
            sentenceText: sentence,
            targetOptionLetter: letter,
            order: events.length + 1,
          });
          events.push({
            id: `event-${eventCounter++}`,
            targetRegionId: regionId,
            actionType: 'correct',
            semanticTriggerPhrase: standaloneCorrectMatch[0],
            sentenceText: sentence,
            targetOptionLetter: letter,
            order: events.length + 1,
          });
        }
      }
    }
  }

  // If correct answer was detected and has a stance, ensure correct action exists
  if (deducedCorrectAnswer) {
    const correctRegionId = `option-${deducedCorrectAnswer.toLowerCase()}`;
    const alreadyHasCorrectAction = events.some(
      (e) => e.targetRegionId === correctRegionId && e.actionType === 'correct'
    );
    if (!alreadyHasCorrectAction && validRegionIds.has(correctRegionId)) {
      events.push({
        id: `event-${eventCounter++}`,
        targetRegionId: correctRegionId,
        actionType: 'correct',
        semanticTriggerPhrase: 'doğru cevap',
        sentenceText: 'Doğru cevap belirlendi.',
        targetOptionLetter: deducedCorrectAnswer,
        order: events.length + 1,
      });
    }
  }

  return {
    events,
    deducedCorrectAnswer,
    optionStances,
  };
}
