import { ArrowSquareOut } from '@phosphor-icons/react';

/** A quiet pointer to a preparation tool, shown while the step is still empty. */
export function PrepToolHint({ text, label, url }: { text: string; label: string; url: string }) {
  return (
    <p className="text-sm text-[#787670]">
      {text}{' '}
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#8B1E2D] hover:underline">
        {label} <ArrowSquareOut size={13} />
      </a>
    </p>
  );
}
