/** A line block of short admin text: a paragraph line or a run of "- " list items. */
export type FormattedBlock = { kind: 'line'; text: string } | { kind: 'list'; items: string[] } | { kind: 'rule' };

const BULLET = /^\s*[-*•]\s+/;

/**
 * Splits plain text written with the light Markdown Claude and the Yardım pages use
 * ("- " list lines, "---" rules) into blocks. Bold is handled per line by `boldParts`.
 */
export function formattedBlocks(text: string): FormattedBlock[] {
  const blocks: FormattedBlock[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, '');
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') last.items.push(item); else blocks.push({ kind: 'list', items: [item] });
    } else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'rule' });
    } else {
      blocks.push({ kind: 'line', text: line });
    }
  }
  // Leading/trailing empty lines and rules add nothing around a short note.
  const empty = (b?: FormattedBlock) => b && (b.kind === 'rule' || (b.kind === 'line' && !b.text.trim()));
  while (empty(blocks[0])) blocks.shift();
  while (empty(blocks[blocks.length - 1])) blocks.pop();
  return blocks;
}

/** "**kalın**" pieces of one line: odd indexes are bold. Unpaired stars stay as typed. */
export const boldParts = (line: string) => line.split(/\*\*(.+?)\*\*/g);
