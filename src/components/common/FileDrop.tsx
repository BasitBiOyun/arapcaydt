import React, { useId, useRef, useState } from 'react';
import { UploadSimple, X } from '@phosphor-icons/react';

interface FileDropProps {
  label: string;
  hint?: string;
  /** Same format as the input's accept attribute: ".mp3,audio/mpeg,image/png". */
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
  icon?: React.ElementType;
}

/** Whether a file matches an accept list (extensions, exact types or "image/*"). */
export function acceptsFile(file: { name: string; type: string }, accept: string): boolean {
  const name = file.name.toLowerCase(), type = (file.type || '').toLowerCase();
  return accept.split(',').map(a => a.trim().toLowerCase()).filter(Boolean).some(rule =>
    rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule);
}

/**
 * A Turkish file picker: drop files or click to choose; shows what was picked and
 * why anything was left out (the browser's own input shows "Choose Files").
 */
export function FileDrop({ label, hint, accept, multiple, disabled, files, onFiles, icon: Icon = UploadSimple }: FileDropProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const take = (list: FileList | null) => {
    const all = Array.from(list || []);
    const ok = all.filter(f => acceptsFile(f, accept));
    setRejected(all.filter(f => !ok.includes(f)).map(f => f.name));
    if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
  };
  const names = files.map(f => f.name);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-[#1C1917]">{label}</label>
      <label
        htmlFor={id}
        onDragOver={e => { if (disabled) return; e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files); }}
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3.5 transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed bg-[#FAF9F5]'
            : over ? 'border-[#8B1E2D] bg-[#F8EEEE] cursor-copy'
              : 'border-[#D5D4CC] bg-white hover:border-[#8B1E2D]/60 hover:bg-[#FDFBF8] cursor-pointer'}`}
      >
        <span className="w-9 h-9 rounded-lg bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center shrink-0"><Icon size={18} weight="bold" /></span>
        <span className="min-w-0 flex-1 text-sm">
          {names.length ? (
            <>
              <span className="font-semibold text-[#1C1917]">{names.length === 1 ? names[0] : `${names.length} dosya seçildi`}</span>
              {names.length > 1 && <span className="block text-xs text-[#787670] truncate">{names.slice(0, 4).join(', ')}{names.length > 4 ? ` ve ${names.length - 4} dosya daha` : ''}</span>}
            </>
          ) : (
            <>
              <span className="text-[#33322E]">{multiple ? 'Dosyaları buraya sürükleyin ya da ' : 'Dosyayı buraya sürükleyin ya da '}<span className="font-semibold text-[#8B1E2D]">seçin</span></span>
              {hint && <span className="block text-xs text-[#787670]">{hint}</span>}
            </>
          )}
        </span>
        {names.length > 0 && !disabled && (
          <button type="button" onClick={e => { e.preventDefault(); onFiles([]); setRejected([]); if (input.current) input.current.value = ''; }}
            className="p-1.5 rounded-lg text-[#787670] hover:text-[#8B1E2D] hover:bg-[#F8EEEE]" aria-label={`${label}: temizle`} title="Temizle">
            <X size={16} weight="bold" />
          </button>
        )}
      </label>
      <input ref={input} id={id} type="file" className="sr-only" accept={accept} multiple={multiple} disabled={disabled}
        onChange={e => { take(e.target.files); e.target.value = ''; }} />
      {rejected.length > 0 && <p className="text-xs text-[#B45309]">Uygun olmayan türde olduğu için alınmadı: {rejected.join(', ')}</p>}
      {names.length > 0 && hint && <p className="text-xs text-[#787670]">{hint}</p>}
    </div>
  );
}
