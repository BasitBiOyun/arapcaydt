export function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

/** Audio length from metadata; 15 s if the browser cannot read it (the old upload behaviour). */
export function readAudioDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 15);
    audio.onerror = () => resolve(15);
    audio.src = url;
  });
}

/** Saves a blob or URL as a file on the teacher's computer. */
export function saveFile(source: Blob | string, name: string): void {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking at once can cancel the download in some browsers.
  if (typeof source !== 'string') setTimeout(() => URL.revokeObjectURL(url), 3000);
}
