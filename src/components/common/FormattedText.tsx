import { Fragment } from 'react';
import { boldParts, formattedBlocks } from './formattedText';

function Bold({ line }: { line: string }) {
  return <>{boldParts(line).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}</>;
}

/** Shows short admin text with **kalın** and "- " madde lines formatted; never renders HTML. */
export function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div dir="auto" className={`break-words ${className}`}>
      {formattedBlocks(text).map((b, i) => (
        b.kind === 'list'
          ? <ul key={i} className="list-disc ps-5 my-1 space-y-0.5">{b.items.map((item, j) => <li key={j}><Bold line={item} /></li>)}</ul>
          : b.kind === 'rule'
            ? <hr key={i} className="my-2 border-current opacity-20" />
            : b.text.trim() ? <p key={i}><Bold line={b.text} /></p> : <div key={i} className="h-2" aria-hidden />
      ))}
    </div>
  );
}
