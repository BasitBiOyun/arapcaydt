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
  /bu\s+(?:yüzden|nedenle)\s+(?:onu\s+(?:da\s+)?|bunu\s+(?:da\s+)?)?el[ei]/i,
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
const LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];

/** Only spoken forms that unambiguously name one option. Lower-case "de" is a Turkish particle. */
const LETTER_SRC = String.raw`(?:[BCD]e|[A-E]|[a-e])`;
const OPTION_WORD_SRC = String.raw`(?:seçene[a-zçğıöşü]*|şı[kğ][a-zçğıöşü]*)`;
const JOIN_SRC = String.raw`\s*(?:,|ve|ile|veya|ya\s+da|&|-)\s*`;
const toLetter = (raw: string) => raw[0].toUpperCase() as OptionLetter;

interface OptionMention {
  kind: 'option' | 'answer' | 'others';
  letters: OptionLetter[];
  start: number;
  end: number;
  text: string;
}

const NEGATED_CORRECT = /doğru\s+(?:cevap\s+|yanıt\s+|seçenek\s+|şık\s+)?(?:değil|olamaz|olmaz)/i;
/** Weak acceptance words are trusted only right after an option is named. */
const LOCAL_CORRECT_PATTERNS = [...CORRECT_PATTERNS, /(?<!\p{L})uygundur/iu, /doğru\s+olan/i, /cevaptır/i, /gelmelidir/i];
const EXTRA_REJECTION_PATTERNS = [/(?<!\p{L})uymaz/iu, /elemeliyiz/i, /eleriz/i, /eliyorum/i, /uymamaktadır/i, /uymadığı/i, /uygun\s+düşmez/i,
  /uygun\s+olmadığı/i, /karşılamaz/i, /anlamı\s+boz/i, /çeldirici/i];

function findPattern(text: string, patterns: RegExp[]): { index: number; text: string } | null {
  let best: { index: number; text: string } | null = null;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && (!best || match.index! < best.index)) best = { index: match.index!, text: match[0] };
  }
  return best;
}

/** Judgment spoken in a segment: rejection wins over incidental praise ("uygundur ama anlamca uymaz"). */
function stanceIn(segment: string, local: boolean) {
  const negated = segment.match(NEGATED_CORRECT);
  if (negated) return { stance: 'rejected' as const, index: negated.index!, text: negated[0] };
  const rejection = findPattern(segment, [...REJECTION_PATTERNS, ...EXTRA_REJECTION_PATTERNS]);
  if (rejection) return { stance: 'rejected' as const, ...rejection };
  const correct = findPattern(segment, local ? LOCAL_CORRECT_PATTERNS : CORRECT_PATTERNS);
  if (correct) return { stance: 'correct' as const, ...correct };
  return null;
}

/** Every option reference in a sentence, including lists ("A ve B şıkları") and "diğer seçenekler". */
function findOptionMentions(sentence: string): OptionMention[] {
  const found: OptionMention[] = [];
  const add = (mention: OptionMention) => {
    if (found.some(other => mention.start < other.end && other.start < mention.end)) return;
    found.push(mention);
  };
  const answer = new RegExp(String.raw`(?:[Dd]oğru\s+(?:cevap|yanıt|seçenek|şık)[a-zçğıöşü]*|[Cc]evab[ıi]m[ıi]z|[Cc]evap|[Yy]anıt)\s*(?:ise\s*|da\s*|de\s*)?[:\-–]?\s*((?:[BCD]e|[A-E]))(?![\p{L}\p{N}])(?:['’][a-zçğıöşü]+)?(?:\s*${OPTION_WORD_SRC})?`, 'gu');
  for (const m of sentence.matchAll(answer)) add({ kind: 'answer', letters: [toLetter(m[1])], start: m.index!, end: m.index! + m[0].length, text: m[0] });
  const named = new RegExp(String.raw`(?<![\p{L}\p{N}])(${LETTER_SRC}(?:${JOIN_SRC}${LETTER_SRC})*)\s*(${OPTION_WORD_SRC})`, 'gu');
  for (const m of sentence.matchAll(named)) {
    const letters = [...new Set(Array.from(m[1].matchAll(new RegExp(String.raw`(?<![\p{L}])${LETTER_SRC}(?![\p{L}])`, 'gu')), x => toLetter(x[0])))];
    // "Şimdi de şıklara bakalım" is not option D; a single letter never takes a plural option word.
    if (!letters.length || (letters.length === 1 && /^(?:seçenekler|şıklar)/i.test(m[2]))) continue;
    add({ kind: 'option', letters, start: m.index!, end: m.index! + m[0].length, text: m[0] });
  }
  for (const m of sentence.matchAll(/(?<![\p{L}\p{N}])([A-E])['’][a-zçğıöşü]+/gu))
    add({ kind: 'option', letters: [m[1] as OptionLetter], start: m.index!, end: m.index! + m[0].length, text: m[0] });
  for (const m of sentence.matchAll(/(?<![\p{L}\p{N}])([A-E])\s*(?:\)|[:.](?=\s|$))/gu))
    add({ kind: 'option', letters: [m[1] as OptionLetter], start: m.index!, end: m.index! + m[0].length, text: m[0].trim() });
  for (const m of sentence.matchAll(/(?<![\p{L}])(?:diğer|geri\s+kalan|kalan|öteki)\s+(?:(?:dört|üç|iki)\s+)?(?:seçenek|şık)[a-zçğıöşü]*|(?<![\p{L}])diğerler[a-zçğıöşü]*/giu))
    add({ kind: 'others', letters: [], start: m.index!, end: m.index! + m[0].length, text: m[0] });
  return found.sort((a, b) => a.start - b.start);
}

function answerMentionNegated(sentence: string, mention: OptionMention) {
  return /^\s*[a-zçğıöşü'’]*\s*(?:değil|olamaz|olmaz)/i.test(sentence.slice(mention.end, mention.end + 30));
}

function pushOptionEvent(
  events: SemanticParsedEvent[],
  counter: { value: number },
  option: OptionLetter,
  actionType: SemanticParsedEvent['actionType'],
  trigger: string,
  sentence: string,
  offsets?: { sourceStart: number; sourceEnd: number }
) {
  events.push({
    id: `event-${counter.value++}`,
    targetRegionId: `option-${option.toLowerCase()}`,
    actionType,
    semanticTriggerPhrase: trigger,
    sentenceText: sentence,
    targetOptionLetter: option,
    order: events.length + 1,
    ...offsets,
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
  arabicMatches: ArabicMatchResult[] = [],
  declaredCorrectAnswer?: OptionLetter
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
  let activeLetters: OptionLetter[] = [];
  const declared = declaredCorrectAnswer && LETTERS.includes(declaredCorrectAnswer) ? declaredCorrectAnswer : undefined;
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
  // The last spoken, non-negated "doğru cevap X" is the text's answer, even when "diğer şıklar" comes first.
  let textAnswer: OptionLetter | undefined;
  for (const sentence of sentences) for (const mention of findOptionMentions(sentence.text))
    if (mention.kind === 'answer' && !answerMentionNegated(sentence.text, mention)) textAnswer = mention.letters[0];

  for (const sentenceSpan of sentences) {
    const sentence = sentenceSpan.text;
    const eventStart = events.length;
    const attachOffsets = () => {
      for (const event of events.slice(eventStart)) {
        const localStart = sentence.toLocaleLowerCase('tr-TR').indexOf(event.semanticTriggerPhrase.toLocaleLowerCase('tr-TR'));
        event.sourceStart ??= sentenceSpan.start + Math.max(0, localStart);
        event.sourceEnd ??= Math.min(sentenceSpan.end, event.sourceStart + event.semanticTriggerPhrase.length);
        event.sentenceStart = sentenceSpan.start;
        event.sentenceEnd = sentenceSpan.end;
        event.sourceText = solutionText;
      }
    };
    // Choose the longest phrase at EACH spoken occurrence. A later single-word
    // explanation must not also light up inside the earlier full sentence.
    const candidates = arabicMatches.flatMap(am => {
      if (!validRegionIds.has(am.region.id)) return [];
      const cx = am.region.x + am.region.width / 2, cy = am.region.y + am.region.height / 2;
      if (availableRegions.some(r => r.type.startsWith('option') && cx >= r.x && cx <= r.x+r.width && cy >= r.y && cy <= r.y+r.height)) return [];
      const escaped = am.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return Array.from(sentence.matchAll(new RegExp(escaped, 'g'))).flatMap(m => {
        const start = m.index!, end = start + m[0].length;
        if (/[\u0621-\u065F]/.test(sentence[start-1] || '') || /[\u0621-\u065F]/.test(sentence[end] || '')) return [];
        return [{ am, start, end }];
      });
    });
    for (const {am, start, end} of candidates.filter(c => !candidates.some(other =>
      other.start <= c.start && other.end >= c.end && other.end-other.start > c.end-c.start))) {
        events.push({
          id: `event-${counter.value++}`,
          targetRegionId: am.region.id,
          actionType: 'underline',
          semanticTriggerPhrase: am.phrase,
          sentenceText: sentence,
          sourceStart: sentenceSpan.start + start,
          sourceEnd: sentenceSpan.start + end,
          order: events.length + 1,
        });
    }

    const mentions = findOptionMentions(sentence);
    const at = (local: number, text: string) => ({ sourceStart: sentenceSpan.start + local, sourceEnd: sentenceSpan.start + local + text.length });
    const hasRegion = (letter: OptionLetter) => validRegionIds.has(`option-${letter.toLowerCase()}`);
    const judge = (letter: OptionLetter, stance: 'rejected' | 'correct', trigger: string, local: number) => {
      if (!hasRegion(letter) || optionStances[letter] !== 'neutral') return;
      // The spoken answer is never crossed out; a known answer blocks praise of another option.
      if (stance === 'rejected' && letter === textAnswer) return;
      if (stance === 'correct' && textAnswer && letter !== textAnswer) return;
      optionStances[letter] = stance;
      if (stance === 'correct') deducedCorrectAnswer = letter;
      pushOptionEvent(events, counter, letter, stance === 'correct' ? 'correct' : 'reject', trigger, sentence, at(local, trigger));
    };
    const currentAnswer = () => textAnswer
      || LETTERS.find(letter => optionStances[letter] === 'correct')
      || (declared && optionStances[declared] !== 'rejected' ? declared : undefined);

    mentions.forEach((mention, index) => {
      const tailEnd = mentions[index + 1]?.start ?? sentence.length;
      const tail = sentence.slice(mention.end, tailEnd);
      const headStart = index ? mentions[index - 1].end : 0;
      if (mention.kind === 'answer') {
        const letter = mention.letters[0];
        activeLetters = [letter];
        if (answerMentionNegated(sentence, mention)) { judge(letter, 'rejected', mention.text, mention.start); return; }
        if (!hasRegion(letter)) return;
        // Repeating the answer re-lights the marked option; the check itself is drawn once.
        if (optionStances[letter] === 'correct') { pushOptionEvent(events, counter, letter, 'focus', mention.text, sentence, at(mention.start, mention.text)); return; }
        pushOptionEvent(events, counter, letter, 'focus', mention.text, sentence, at(mention.start, mention.text));
        judge(letter, 'correct', mention.text, mention.start);
        return;
      }
      const tailStance = stanceIn(tail, true);
      const headStance = !tailStance && index === 0 ? stanceIn(sentence.slice(headStart, mention.start), true) : null;
      const stance = tailStance
        ? { ...tailStance, local: mention.end + tailStance.index }
        : headStance ? { ...headStance, local: headStart + headStance.index } : null;
      if (mention.kind === 'others') {
        activeLetters = [];
        const answer = currentAnswer();
        if (!stance || stance.stance !== 'rejected' || !answer) return;
        for (const letter of LETTERS) if (letter !== answer) judge(letter, 'rejected', stance.text, stance.local);
        return;
      }
      // A missing visual target must not leave the previous option active.
      activeLetters = mention.letters;
      for (const letter of mention.letters) if (hasRegion(letter) && optionStances[letter] === 'neutral') {
        pushOptionEvent(events, counter, letter, 'focus', mention.text, sentence, at(mention.start, mention.text));
      }
      if (stance) for (const letter of mention.letters) judge(letter, stance.stance, stance.text, stance.local);
    });

    // "A seçeneğine bakalım. Bu yapı burada kullanılamaz, eliyoruz." judges the option named before.
    if (!mentions.length && activeLetters.length) {
      const stance = stanceIn(sentence, false);
      if (stance) for (const letter of activeLetters) judge(letter, stance.stance, stance.text, stance.index);
    }
    attachOffsets();
  }

  // Declared/eliminated answer still gets its check when the script never says "doğru cevap".
  const finalAnswer = deducedCorrectAnswer
    || (declared && optionStances[declared] !== 'rejected' ? declared : undefined)
    || (() => {
      const open = LETTERS.filter(letter => validRegionIds.has(`option-${letter.toLowerCase()}`) && optionStances[letter] === 'neutral');
      return open.length === 1 && LETTERS.some(letter => optionStances[letter] === 'rejected') ? open[0] : undefined;
    })();
  if (finalAnswer && !LETTERS.some(letter => optionStances[letter] === 'correct') && validRegionIds.has(`option-${finalAnswer.toLowerCase()}`)) {
    let anchor: { sentence: typeof sentences[number]; mention?: OptionMention } | undefined;
    for (const sentence of sentences) {
      const mention = findOptionMentions(sentence.text).filter(m => m.letters.includes(finalAnswer)).pop();
      if (mention) anchor = { sentence, mention };
    }
    anchor ??= sentences.length ? { sentence: sentences[sentences.length - 1] } : undefined;
    if (anchor) {
      // Without a spoken mention, the check lands on the closing word rather than over the last explanation.
      const local = anchor.mention?.start ?? anchor.sentence.text.search(/\S+$/);
      const trigger = anchor.mention?.text || anchor.sentence.text.slice(local);
      const offsets = { sourceStart: anchor.sentence.start + local, sourceEnd: anchor.sentence.start + local + trigger.length,
        sentenceStart: anchor.sentence.start, sentenceEnd: anchor.sentence.end, sourceText: solutionText };
      optionStances[finalAnswer] = 'correct';
      pushOptionEvent(events, counter, finalAnswer, 'focus', trigger, anchor.sentence.text, offsets);
      pushOptionEvent(events, counter, finalAnswer, 'correct', trigger, anchor.sentence.text, offsets);
    }
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
