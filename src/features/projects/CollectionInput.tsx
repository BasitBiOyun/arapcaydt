import React, { useId } from 'react';
import { useProjects } from './ProjectContext';

/** The teacher's collection names, most recently used first, each once. */
export function recentCollections(projects: Array<{ examName?: string; updatedAt?: string }>): string[] {
  const latest = new Map<string, string>();
  for (const p of projects) {
    const name = p.examName?.trim();
    if (name && (latest.get(name) ?? '') < (p.updatedAt ?? '')) latest.set(name, p.updatedAt ?? '');
    else if (name && !latest.has(name)) latest.set(name, '');
  }
  return [...latest].sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0], 'tr')).map(([name]) => name);
}

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * "Koleksiyon / deneme adı" with the teacher's earlier names: a suggestion list while typing and
 * one-click chips for the most recent ones, so the same name is never typed twice. New names still work.
 */
export function CollectionInput({ value, onChange, disabled, ...input }: Props) {
  const { projects } = useProjects();
  const listId = useId();
  const names = recentCollections(projects);
  const chips = names.filter(name => name !== value.trim()).slice(0, 4);
  return (
    <>
      <input {...input} disabled={disabled} list={listId} value={value} onChange={e => onChange(e.target.value)} autoComplete="off" />
      <datalist id={listId}>{names.map(name => <option key={name} value={name} />)}</datalist>
      {chips.length > 0 && (
        <span className="flex flex-wrap items-center gap-1 mt-1.5 text-[11px] text-[#787670] font-normal">
          Önceki:
          {chips.map(name => (
            <button key={name} type="button" disabled={disabled} onClick={() => onChange(name)} title={`“${name}” koleksiyonunu seç`}
              className="px-2 py-0.5 rounded-full border border-[#D5D4CC] bg-[#FAF9F5] hover:bg-[#F2F1EB] text-[#33322E] max-w-48 truncate">
              {name}
            </button>
          ))}
        </span>
      )}
    </>
  );
}
